import { Component, type ReactNode, type ErrorInfo } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  /** 错误发生时展示的上下文标签（例如插件名），便于定位 */
  label?: string
  /** 自定义兜底 UI（接收 error 与重置函数） */
  fallback?: (error: Error, reset: () => void) => ReactNode
  /** 错误上报 / 日志钩子 */
  onError?: (error: Error, info: ErrorInfo) => void
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * 全局错误边界：任何子组件渲染期抛错都不会再导致整页白屏，
 * 而是展示可读的错误卡片与「重试」按钮，并保留其余功能可用。
 *
 * 这是「点击某功能直接进全白页面」这类问题的根因修复——
 * 之前应用没有任何错误边界，一次未捕获的异常就会卸载整棵 React 树。
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 输出到控制台，便于排查（不再是无声白屏）
    console.error(`[InkPi] 渲染错误已被错误边界捕获${this.props.label ? `（${this.props.label}）` : ''}:`, error, info)
    this.props.onError?.(error, info)
  }

  private reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (error) {
      if (this.props.fallback) return this.props.fallback(error, this.reset)
      return (
        <div className="h-full w-full flex items-center justify-center p-6 bg-[var(--ink-bg)] text-[var(--ink-text)]">
          <div className="max-w-md w-full rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-card)] p-6 space-y-3">
            <div className="text-[14px] font-semibold text-red-500">
              页面渲染出错{this.props.label ? `（${this.props.label}）` : ''}
            </div>
            <p className="text-[12px] text-[var(--ink-text-muted)] leading-relaxed">
              该模块发生了未预期的错误，已被安全隔离，不会影响其他功能。详细错误已输出到浏览器控制台。
            </p>
            <pre className="text-[11px] bg-[var(--ink-bg-sidebar)] border border-[var(--ink-border)] rounded p-2 overflow-auto max-h-40 text-red-400 whitespace-pre-wrap">
              {error.message}
            </pre>
            <button
              onClick={this.reset}
              className="px-3 py-1.5 rounded-md bg-[var(--ink-accent)] text-white text-[12px] font-medium hover:opacity-90 transition-opacity"
            >
              重试
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
