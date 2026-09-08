import { useState, useEffect, useRef, useCallback } from 'react'
import { connectToDaemon } from '../core/daemonConnection'
import { inkpiDaemonGateway } from '../adapters/inkpiDaemonGateway'
import type { AiAssistant } from '../ports/aiGateway'
import type { ModelConfig } from '../core/settings'
import { DEFAULT_DAEMON_URL } from '../config'
import type { AiTask, TaskResult } from '@inkpi/protocol'
import { semanticDocumentFromText } from '../domain/content'
import { createAssistantTask, createContinueTask, taskResultText } from '../ai'
import { idGenerator } from '../adapters/idGenerator'

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
  runAiTask: (task: AiTask) => Promise<TaskResult | null>
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

  const requestGhost = useCallback(
    async (chapterId: string, text: string): Promise<string | null> => {
      if (!clientRef.current || !isConnected || !clientRef.current.runTask) return null
      try {
        const document = semanticDocumentFromText(chapterId, text)
        const task = createContinueTask({
          taskId: idGenerator.generate(`ghost-${chapterId}`),
          document,
          selection: { from: document.text.length, to: document.text.length },
          metadata: { modelId: aiModel?.id },
        })
        return taskResultText(await clientRef.current.runTask(task))
      } catch {
        return null
      }
    },
    [aiModel?.id, isConnected],
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
        if (!clientRef.current.runTask) throw new Error('Task runtime is unavailable')
        const document = semanticDocumentFromText(chapterId || 'assistant', '')
        const task = createAssistantTask({
          taskId: idGenerator.generate('assistant'),
          document,
          question: trimmed,
          metadata: { modelId: aiModel?.id },
        })
        const result = await clientRef.current.runTask(task)
        const text = taskResultText(result) || (result?.error?.message ?? '')
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
    [aiBusy, aiModel?.id, isConnected],
  )

  const reconnect = useCallback(() => {
    initConnection(wsUrl)
  }, [initConnection, wsUrl])

  const runAiTask = useCallback(
    async (task: AiTask): Promise<TaskResult | null> => {
      if (!clientRef.current || !isConnected || !clientRef.current.runTask) return null
      return clientRef.current.runTask(task)
    },
    [isConnected],
  )

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
    runAiTask,
  }
}
