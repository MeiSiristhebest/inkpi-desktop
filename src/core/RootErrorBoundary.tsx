import { Component, type ReactNode, type ErrorInfo } from 'react'

interface RootErrorBoundaryProps {
  children: ReactNode
}

interface RootErrorBoundaryState {
  error: Error | null
}

/**
 * 全局兜底错误边界（最终安全网）。
 *
 * 与组件级 ErrorBoundary 互补分工：
 *   - 组件级边界（Engine / PluginSettingsView / 各插件主视图）：捕获「渲染期」抛错，
 *     按视图隔离，单个模块崩溃不影响整体其余功能；
 *   - 本边界：额外捕获「渲染期之外」的未捕获异常——
 *       · 事件处理器（onClick 等）中抛出的错误（React 错误边界抓不到）；
 *       · Promise 未处理拒绝（unhandledrejection，例如 IndexedDB 读写 / 网络异步失败）。
 *     这类异常过去没有任何兜底，会直接卸载整棵 React 树 → 表现为「点一下某功能就全白」。
 *
 * 捕获后展示可读错误卡片 + 重试 / 重新加载，而不是无声白屏。
 */
export class RootErrorBoundary extends Component<RootErrorBoundaryProps, RootErrorBoundaryState> {
  state: RootErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 输出到控制台，便于排查（不再是无声白屏）
    console.error('[InkPi] 全局捕获到未处理错误:', error, info)
  }

  componentDidMount() {
    window.addEventListener('error', this.handleWindowError)
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection)
  }

  componentWillUnmount() {
    window.removeEventListener('error', this.handleWindowError)
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection)
  }

  // 仅处理真正未捕获的 JS 运行时错误（事件处理器抛错等）；
  // 过滤掉资源加载错误（<img> / <script> 404 等，其 error 为 null，不应触发白屏兜底）。
  private handleWindowError = (e: ErrorEvent) => {
    if (e.error instanceof Error) {
      this.setState({ error: e.error })
    }
  }

  // 异步 Promise 拒绝：例如 IndexedDB 读写失败且未被 try/catch 捕获。
  private handleUnhandledRejection = (e: PromiseRejectionEvent) => {
    const reason = e.reason
    this.setState({
      error: reason instanceof Error ? reason : new Error(`未处理的异步错误: ${String(reason)}`),
    })
  }

  private softReset = () => {
    this.setState({ error: null })
  }

  private hardReload = () => {
    window.location.reload()
  }

  render() {
    const { error } = this.state
    if (error) {
      return (
        <div className="h-screen w-screen flex items-center justify-center p-6 bg-[var(--ink-bg)] text-[var(--ink-text)]">
          <div className="max-w-md w-full rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-card)] p-6 space-y-3">
            <div className="text-[15px] font-semibold text-red-500">应用遇到未捕获的错误</div>
            <p className="text-[12px] text-[var(--ink-text-muted)] leading-relaxed">
              已为你保留界面，可先「重试」恢复；若反复异常，请「重新加载」。完整错误已输出到浏览器控制台（DevTools）。
            </p>
            <pre className="text-[11px] bg-[var(--ink-bg-sidebar)] border border-[var(--ink-border)] rounded p-2 overflow-auto max-h-52 text-red-400 whitespace-pre-wrap">
              {error.stack || error.message}
            </pre>
            <div className="flex gap-2">
              <button
                onClick={this.softReset}
                className="px-3 py-1.5 rounded-md bg-[var(--ink-accent)] text-white text-[12px] font-medium hover:opacity-90 transition-opacity"
              >
                重试
              </button>
              <button
                onClick={this.hardReload}
                className="px-3 py-1.5 rounded-md border border-[var(--ink-border)] text-[var(--ink-text-muted)] text-[12px] hover:bg-[var(--ink-bg-hover)] transition-colors"
              >
                重新加载
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default RootErrorBoundary
