import { useState, useEffect, useRef, useCallback } from 'react'
import { connectToDaemon } from '../core/daemonConnection'
import { inkpiDaemonGateway } from '../adapters/inkpiDaemonGateway'
import type { AiAssistant } from '../ports/aiGateway'
import type { ModelConfig } from '../core/settings'
import { DEFAULT_DAEMON_URL } from '../config'

/**
 * AI 副驾驶会话状态机（§7.3，从 App.tsx 组合根抽离）。
 *
 * 职责：daemon 连接生命周期、按章节的 session 管理、行内续写（Ghost Text）、
 * 自由对话状态机。仅依赖注入的端口（AiGateway / daemonConnection），不直接编排业务以外的副作用。
 * App.tsx 作为组合根只负责把本 hook 的输出接到 <Engine> / <AiAssistantPanel>。
 */

const isTauriContext = (): boolean =>
  typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)

interface AiMessage {
  role: 'user' | 'assistant'
  text: string
}

const messageToText = (msg: unknown): string => {
  if (!msg) return ''
  const m = msg as { content?: unknown }
  if (typeof m.content === 'string') return m.content
  if (Array.isArray(m.content))
    return m.content.map((b: { text?: string }) => b?.text ?? '').join('')
  return ''
}

export interface AiConversation {
  isConnected: boolean
  isReconnecting: boolean
  aiPanelOpen: boolean
  setAiPanelOpen: (open: boolean) => void
  aiMessages: AiMessage[]
  aiInput: string
  setAiInput: (value: string) => void
  aiBusy: boolean
  reconnect: () => void
  requestGhost: (chapterId: string, text: string) => Promise<string | null>
  sendAiPrompt: (prompt: string, chapterId?: string) => void
}

export interface UseAiConversationOptions {
  /** 初始右侧 AI 面板是否开启（默认关闭，保持专注写作） */
  initialPanelOpen?: boolean
}

export function useAiConversation(
  wsUrl: string,
  aiModel: ModelConfig | null,
  options: UseAiConversationOptions = {},
): AiConversation {
  const { initialPanelOpen = false } = options
  const [isConnected, setIsConnected] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const clientRef = useRef<AiAssistant | null>(null)
  const mountedRef = useRef(false)

  const [aiPanelOpen, setAiPanelOpen] = useState(initialPanelOpen)
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([])
  const [aiInput, setAiInput] = useState('')
  const [aiBusy, setAiBusy] = useState(false)

  const initConnection = useCallback(async (url: string = DEFAULT_DAEMON_URL) => {
    setIsReconnecting(true)
    const result = await connectToDaemon(inkpiDaemonGateway, url, {
      isTauri: isTauriContext(),
      shouldAbort: () => !mountedRef.current,
    })
    if (!mountedRef.current) {
      result.client?.close().catch(() => {})
      return
    }
    clientRef.current = result.client
    setIsConnected(result.connected)
    setIsReconnecting(false)
    if (!result.connected) {
      console.warn('[InkPi Desktop] Daemon 连接失败，进入离线沙盒模式')
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    initConnection(wsUrl)
    return () => {
      mountedRef.current = false
      if (clientRef.current) clientRef.current.close().catch(() => {})
    }
    // 仅在挂载时连接；wsUrl 变化由 reconnect 显式触发（与原 App 行为一致）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ensureSession = useCallback(
    async (chapterId: string): Promise<string | null> => {
      const client = clientRef.current
      if (!client) return null
      const sessionId = `desk-${chapterId}`
      try {
        await client.openSession(sessionId, { model: aiModel || undefined })
      } catch (e: unknown) {
        if (!String((e as { message?: string })?.message || e).includes('already exists')) throw e
      }
      return sessionId
    },
    [aiModel],
  )

  const requestGhost = useCallback(
    async (chapterId: string, text: string): Promise<string | null> => {
      if (!clientRef.current || !isConnected) return null
      try {
        const sessionId = await ensureSession(chapterId)
        if (!sessionId) return null
        return await clientRef.current.suggestContinuation(sessionId, text)
      } catch {
        return null
      }
    },
    [ensureSession, isConnected],
  )

  const sendAiPrompt = useCallback(
    async (prompt: string, chapterId?: string) => {
      const trimmed = prompt.trim()
      if (!trimmed || aiBusy) return

      setAiPanelOpen(true)
      setAiMessages((prev) => [...prev, { role: 'user', text: trimmed }])
      setAiInput('')

      if (!clientRef.current || !isConnected) {
        setAiMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: '（离线沙盒模式：请先启动 `inkpi daemon` 并点击左下角重连后再使用 AI 功能）',
          },
        ])
        return
      }

      setAiBusy(true)
      try {
        const sessionId =
          (chapterId && (await ensureSession(chapterId))) || (await ensureSession('main'))
        const res = await clientRef.current.prompt(sessionId ?? 'main', trimmed)
        const text = messageToText(res?.lastMessage) || JSON.stringify(res)
        setAiMessages((prev) => [...prev, { role: 'assistant', text }])
      } catch (err: unknown) {
        setAiMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: `⚠️ RPC 错误：${String((err as { message?: string })?.message || err)}`,
          },
        ])
      } finally {
        setAiBusy(false)
      }
    },
    [aiBusy, ensureSession, isConnected],
  )

  const reconnect = useCallback(() => {
    initConnection(wsUrl)
  }, [initConnection, wsUrl])

  return {
    isConnected,
    isReconnecting,
    aiPanelOpen,
    setAiPanelOpen,
    aiMessages,
    aiInput,
    setAiInput,
    aiBusy,
    reconnect,
    requestGhost,
    sendAiPrompt,
  }
}
