/**
 * AI 网关端口（抽象）。
 *
 * 视图层 / 根组件不直接依赖具体的 InkRpcClient（@inkpi/client），而是依赖此端口。
 * 真实实现（InkpiDaemonGateway）封装 WebSocket JSON-RPC 的细节；测试可注入假实现。
 */

export interface RpcClient {
  request<T = unknown>(method: string, params?: unknown): Promise<T>
  close(): Promise<void>
}

export interface AiGateway {
  connect(url: string): Promise<RpcClient>
}

/**
 * 语义化 AI 助手端口（DIP / ISP，§14.4）。
 *
 * 把 daemon 的 JSON-RPC 方法名（`session.create` / `session.ghost.suggest` /
 * `session.prompt` / `daemon.status`）封进适配器，视图层与根组件只依赖这套
 * 语义方法，不出现传输层字符串。便于注入假实现做单测。
 */
export interface AiAssistant {
  /** 按章节/会话维度建立并复用 daemon session（幂等：已存在不报错） */
  openSession(sessionId: string, opts?: { model?: unknown }): Promise<void>
  /** 行内 Ghost Text 续写建议，返回续写文本或 null */
  suggestContinuation(sessionId: string, text: string): Promise<string | null>
  /** 发送一条指令给 AI 副驾驶，返回最新一条消息 */
  prompt(sessionId: string, prompt: string): Promise<{ lastMessage?: unknown }>
  /** daemon 存活状态 */
  status(): Promise<{ running: boolean }>
  close(): Promise<void>
}
