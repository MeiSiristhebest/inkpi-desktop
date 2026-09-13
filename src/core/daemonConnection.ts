import type { AiGateway, AiAssistant } from '../ports/aiGateway'
import { createDaemonAiAssistant } from '../adapters/daemonAiAssistant'
import { createDaemonSkillRuntime } from '../adapters/daemonSkillRuntime'
import { CONNECT_TIMEOUT_MS, WEB_CONNECT_TIMEOUT_MS } from '../config'

export type ConnectionStateListener = (connected: boolean) => void

export interface ConnectionAwareAiAssistant extends AiAssistant {
  subscribeToConnectionState?: (listener: ConnectionStateListener) => () => void
}

export interface ConnectOptions {
  isTauri: boolean
  maxAttempts?: number
  retryDelayMs?: number
  /** 返回 true 时中止重试（如组件已卸载），避免悬空状态更新 */
  shouldAbort?: () => boolean
}

export interface ConnectResult {
  client: ConnectionAwareAiAssistant | null
  connected: boolean
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const withTimeout = <T>(fn: () => Promise<T>, ms: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`WebSocket connection timed out after ${ms}ms`)), ms)
  })
  // 关键：clearTimeout 必须挂在 race 完成之后，不能放在 try/finally 里同步执行，
  // 否则 finally 会在 race 返回的那一刻（计时器尚未触发）就清掉计时器，导致超时永不生效、连接永远挂起。
  return Promise.race([fn(), timeout]).finally(() => clearTimeout(timer))
}

/**
 * 连接 InkPi Daemon（纯逻辑、可单测，不依赖 React / 全局状态）。
 *
 * daemon 由 Tauri 作为 externalBin sidecar 拉起（冷启动 4~6s），故自动重试；
 * 纯网页内没有 Tauri 去启动 daemon，只快速试 1 次即进入离线沙盒。
 * 通过 AiGateway 端口解耦具体 WebSocket 实现，便于测试注入假网关。
 */
export async function connectToDaemon(
  gateway: AiGateway,
  url: string,
  opts: ConnectOptions,
): Promise<ConnectResult> {
  const maxAttempts = opts.maxAttempts ?? (opts.isTauri ? 15 : 1)
  const timeoutMs = opts.isTauri ? CONNECT_TIMEOUT_MS : WEB_CONNECT_TIMEOUT_MS

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (opts.shouldAbort?.()) return { client: null, connected: false }
    try {
      const raw = await withTimeout(() => gateway.connect(url), timeoutMs)
      const assistant = createDaemonAiAssistant(raw)
      try {
        await createDaemonSkillRuntime(raw).ensureFirstPartySkillsActivated()
        const status = await assistant.status()
        if (!status?.running) throw new Error('daemon not running')
        if (opts.shouldAbort?.()) {
          await assistant.close().catch(() => {})
          return { client: null, connected: false }
        }
        return { client: addConnectionStateSubscription(assistant, raw), connected: true }
      } catch (error) {
        await raw.close().catch(() => {})
        throw error
      }
    } catch {
      if (attempt === maxAttempts - 1) return { client: null, connected: false }
      await delay(opts.retryDelayMs ?? 1000)
      if (opts.shouldAbort?.()) return { client: null, connected: false }
    }
  }
  return { client: null, connected: false }
}

function addConnectionStateSubscription(
  assistant: AiAssistant,
  raw: unknown,
): ConnectionAwareAiAssistant {
  const source = raw as {
    onConnectionStateChange?: (listener: ConnectionStateListener) => () => void
    transport?: { transport?: { ws?: ConnectionEventSource } }
  }

  if (source.onConnectionStateChange) {
    return Object.assign(assistant, {
      subscribeToConnectionState: source.onConnectionStateChange.bind(source),
    })
  }

  const socket = source.transport?.transport?.ws
  return Object.assign(assistant, {
    subscribeToConnectionState: (listener: ConnectionStateListener) => {
      if (!socket?.addEventListener) return () => {}
      let active = true
      const onDisconnected = () => {
        if (active) listener(false)
      }
      socket.addEventListener('close', onDisconnected)
      socket.addEventListener('error', onDisconnected)
      return () => {
        active = false
        socket.removeEventListener?.('close', onDisconnected)
        socket.removeEventListener?.('error', onDisconnected)
      }
    },
  })
}

interface ConnectionEventSource {
  addEventListener(type: 'close' | 'error', listener: () => void): void
  removeEventListener?(type: 'close' | 'error', listener: () => void): void
}
