import { type FC } from 'react'
import type { NarrativeConflict } from '../types'
import { AlertCircle, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react'

interface ConflictPanelProps {
  conflicts: NarrativeConflict[]
}

export const ConflictPanel: FC<ConflictPanelProps> = ({ conflicts }) => {
  const errors = conflicts.filter((c) => c.severity === 'error')
  const warnings = conflicts.filter((c) => c.severity === 'warning')

  return (
    <div className="w-80 h-full border-l border-[var(--ink-border)] bg-[var(--ink-bg-panel)] flex flex-col text-xs text-[var(--ink-text)]">
      <div className="p-3 border-b border-[var(--ink-border)] bg-[var(--ink-bg-elevated)]/40 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-[var(--ink-text)]">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            <span>时空因果质检门禁</span>
          </div>
          <div className="flex items-center gap-1.5">
            {errors.length > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-500 text-[10px] font-bold">
                {errors.length} 致命
              </span>
            )}
            {warnings.length > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 text-[10px] font-bold">
                {warnings.length} 警告
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {conflicts.length === 0 ? (
          <div className="text-center py-12 text-[var(--ink-text-muted)]">
            <CheckCircle2 className="w-7 h-7 mx-auto text-emerald-500 mb-2 opacity-80" />
            <p className="font-medium text-emerald-500">当前检查未发现冲突</p>
            <p className="text-[10px] text-[var(--ink-text-faint)] mt-1">
              章节位置不能单独验证故事内的时间顺序
            </p>
          </div>
        ) : (
          conflicts.map((c, i) => (
            <div
              key={i}
              className={`p-3 rounded-lg border ${
                c.severity === 'error'
                  ? 'border-rose-500/40 bg-rose-500/10'
                  : 'border-amber-500/40 bg-amber-500/10'
              } space-y-1`}
            >
              <div className="flex items-center gap-1.5 font-semibold">
                {c.severity === 'error' ? (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                )}
                <span className={c.severity === 'error' ? 'text-rose-500' : 'text-amber-500'}>
                  {c.type === 'causal_cycle'
                    ? '因果死锁循环'
                    : c.type === 'temporal_paradox'
                      ? '因果顺序需核对'
                      : c.type === 'missing_prerequisite'
                        ? '前置事件缺失'
                        : c.type === 'invalid_definition'
                          ? '事件定义无效'
                          : '同线章节需复核'}
                </span>
              </div>
              <p className="text-[11px] text-[var(--ink-text-muted)] leading-relaxed">
                {c.description}
              </p>
              {c.sources?.map((source) => (
                <div
                  key={`${source.eventTitle}:${source.sourceDocumentId ?? ''}:${source.sourceBlockId ?? ''}`}
                  className="mt-2 rounded bg-[var(--ink-bg-panel)]/60 p-2 text-[10px] text-[var(--ink-text-muted)]"
                >
                  <p className="font-medium">{source.eventTitle}</p>
                  {(source.sourceDocumentId || source.evidence?.[0]?.documentId) && (
                    <p>
                      来源：文档 {source.sourceDocumentId ?? source.evidence?.[0]?.documentId}
                      {source.sourceBlockId || source.evidence?.[0]?.blockId
                        ? ` · 段落 ${source.sourceBlockId ?? source.evidence?.[0]?.blockId}`
                        : ''}
                      {source.sourceRevision !== undefined
                        ? ` · 修订 ${source.sourceRevision}`
                        : ''}
                    </p>
                  )}
                  {source.evidence?.map((item) =>
                    item.excerpt ? (
                      <blockquote
                        key={`${item.documentId ?? ''}:${item.semanticFrom ?? ''}`}
                        className="mt-1 border-l border-current pl-2"
                      >
                        {item.excerpt}
                      </blockquote>
                    ) : null,
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
