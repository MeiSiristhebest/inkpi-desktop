import type { FC } from 'react'
import { AlertTriangle, CircleX, Sparkles } from 'lucide-react'
import type { PluginAiTaskView } from '../../core/usePluginAiTask'
import { openActivityCenter } from '../../core/defaultCommands'
import type { PluginWorkflowProvenance } from '../../types/pluginHost'

export interface PluginAiTaskPanelProps {
  view: PluginAiTaskView
  /** 失败时重新发出同一次请求；没有可重试的请求时不渲染按钮。 */
  onRetry?: () => void
}

const SOURCE_KIND_LABELS: Record<NonNullable<PluginWorkflowProvenance['sourceKind']>, string> = {
  workspace: '工作区',
  manual: '手动输入',
  'saved-chapter': '已保存章节',
  'edited-copy': '编辑副本',
}

/**
 * 插件视图的 AI 任务回执（§P1.12）。
 *
 * 每个插件的 AI 按钮都曾经把结果丢进 console，所以这块面板的职责就是把「一次付费调用之后
 * 到底发生了什么」显示出来：执行中、结果、或者可以被用户重试的失败。
 */
export const PluginAiTaskPanel: FC<PluginAiTaskPanelProps> = ({ view, onRetry }) => {
  if (view.kind === 'idle') return null

  if (view.kind === 'running') {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="plugin-ai-task-state"
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] text-[12px] text-[var(--ink-text-muted)]"
      >
        <Sparkles className="w-3.5 h-3.5 shrink-0 animate-pulse text-[var(--ink-accent)]" />
        <div className="min-w-0">
          <p>AI 任务执行中，结果会显示在这里…</p>
          {view.taskId && <p className="mt-1 truncate font-mono text-[10px]">{view.taskId}</p>}
          {view.provenance && <ProvenanceLine provenance={view.provenance} />}
        </div>
      </div>
    )
  }

  if (view.kind === 'cancelled') {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid="plugin-ai-task-state"
        className="flex items-start gap-2 px-3 py-2 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] text-[12px] text-[var(--ink-text-muted)]"
      >
        <CircleX className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">AI 任务已取消</p>
          <p className="break-words">{view.message}</p>
          <ProvenanceLine provenance={view.provenance} />
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 px-2 py-1 rounded border border-[var(--ink-border)] text-[11px] font-medium text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] cursor-pointer"
          >
            重新运行
          </button>
        )}
      </div>
    )
  }

  if (view.kind === 'failed') {
    return (
      <div
        role="alert"
        data-testid="plugin-ai-task-state"
        className="flex items-start gap-2 px-3 py-2 rounded-lg border border-rose-500/40 bg-rose-500/5 text-[12px] text-rose-600 dark:text-rose-400"
      >
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">AI 任务失败</p>
          <p className="break-words text-[var(--ink-text-muted)]">{view.message}</p>
          {view.taskId && <p className="mt-1 break-all font-mono text-[10px]">{view.taskId}</p>}
          {view.provenance && <ProvenanceLine provenance={view.provenance} />}
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 px-2 py-1 rounded border border-[var(--ink-border)] text-[11px] font-medium text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] cursor-pointer"
          >
            重试
          </button>
        )}
      </div>
    )
  }

  const provenance = view.provenance ?? {}

  return (
    <section
      aria-label="AI 任务结果"
      data-testid="plugin-ai-task-state"
      className="rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] overflow-hidden"
    >
      <header className="flex items-center gap-2 px-3 py-2 border-b border-[var(--ink-border)] bg-[var(--ink-bg-elevated)]">
        <Sparkles className="w-3.5 h-3.5 shrink-0 text-[var(--ink-accent)]" />
        <span className="text-[12px] font-semibold text-[var(--ink-text)]">AI 结果</span>
        <span className="ml-auto text-[10px] text-[var(--ink-text-faint)]">未写入正文</span>
        {view.artifactId && (
          <button
            type="button"
            onClick={() => openActivityCenter(view.artifactId)}
            className="shrink-0 text-[10px] text-[var(--ink-accent)] hover:underline"
          >
            查看活动中心
          </button>
        )}
      </header>
      <div
        aria-label="AI 任务来源与保存状态"
        className="flex flex-wrap gap-x-3 gap-y-1 border-b border-[var(--ink-border)] px-3 py-2 text-[10px] text-[var(--ink-text-faint)]"
      >
        <span>任务 {view.taskId}</span>
        {provenance.workspaceId && <span>作品 {provenance.workspaceId}</span>}
        {provenance.documentId ? (
          <span>
            来源 {provenance.documentId}
            {provenance.documentRevision === undefined
              ? ''
              : ` · 修订 ${provenance.documentRevision}`}
          </span>
        ) : (
          provenance.sourceKind && <span>来源 {SOURCE_KIND_LABELS[provenance.sourceKind]}</span>
        )}
        {(provenance.provider || provenance.model) && (
          <span>模型 {[provenance.provider, provenance.model].filter(Boolean).join(' / ')}</span>
        )}
        {view.artifactId && <span>结果记录 {view.artifactId}</span>}
      </div>
      <div className="px-3 py-2.5 max-h-64 overflow-y-auto text-[12px] leading-relaxed text-[var(--ink-text)] whitespace-pre-wrap break-words">
        {view.text}
      </div>
    </section>
  )
}

function ProvenanceLine({ provenance }: { provenance: PluginWorkflowProvenance }) {
  const source = provenance.documentId
    ? `来源 ${provenance.documentId}${provenance.documentRevision === undefined ? '' : ` · 修订 ${provenance.documentRevision}`}`
    : provenance.sourceKind
      ? `来源 ${SOURCE_KIND_LABELS[provenance.sourceKind]}`
      : undefined
  const model = [provenance.provider, provenance.model].filter(Boolean).join(' / ')
  const details = [source, model ? `模型 ${model}` : undefined].filter(Boolean)
  return details.length > 0 ? (
    <p className="mt-1 break-words text-[10px] text-[var(--ink-text-faint)]">
      {details.join(' · ')}
    </p>
  ) : null
}
