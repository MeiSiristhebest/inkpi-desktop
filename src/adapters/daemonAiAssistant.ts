import type { AiAssistant, RpcClient } from '../ports/aiGateway'

/**
 * 把底层 RpcClient（字符串方法 JSON-RPC）封装成语义化 AiAssistant。
 * 传输层方法名集中在此处，视图层 / 根组件不再出现 'session.create' 等字符串（§14.4）。
 */
export const createDaemonAiAssistant = (client: RpcClient): AiAssistant => ({
  openSession: async (sessionId, opts) => {
    try {
      await client.request('session.create', { sessionId, initialText: '', model: opts?.model })
    } catch (e: any) {
      // session 已存在属正常幂等路径，忽略
      if (!String(e?.message || e).includes('already exists')) throw e
    }
  },

  suggestContinuation: (sessionId, text) =>
    client
      .request<{ text?: string; ghostText?: string }>('session.ghost.suggest', {
        sessionId,
        text,
      })
      .then((res) => res?.text || res?.ghostText || null),

  prompt: (sessionId, prompt) =>
    client.request<{ lastMessage?: unknown }>('session.prompt', { sessionId, prompt }),

  status: () => client.request<{ running: boolean }>('daemon.status'),

  close: () => client.close(),
})
