import { type FC } from 'react'
import type { TimelineNode, NarrativeThread } from '../types'
import { AlertCircle, Link2 } from 'lucide-react'

interface TimelineNodeCardProps {
  node: TimelineNode
  thread?: NarrativeThread
  hasConflict?: boolean
  onClick?: () => void
}

export const TimelineNodeCard: FC<TimelineNodeCardProps> = ({
  node,
  thread,
  hasConflict,
  onClick,
}) => {
  const polarityColor =
    node.emotionalPolarity > 0.3
      ? 'text-emerald-400'
      : node.emotionalPolarity < -0.3
        ? 'text-rose-400'
        : 'text-[var(--ink-text-muted)]'

  return (
    <div
      onClick={onClick}
      className={`group relative p-2 rounded-lg border text-left cursor-pointer transition-all hover:shadow-md ${
        hasConflict
          ? 'border-rose-500/80 bg-rose-500/10'
          : 'border-[var(--ink-border)] bg-[var(--ink-bg-panel)] hover:border-[var(--ink-accent)]'
      }`}
      style={{
        borderLeftWidth: '3px',
        borderLeftColor: thread?.color || 'var(--ink-accent)',
      }}
    >
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="font-semibold text-xs text-[var(--ink-text)] truncate" title={node.eventTitle}>
          {node.eventTitle}
        </span>
        {hasConflict && <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
      </div>

      <p className="text-[11px] text-[var(--ink-text-muted)] line-clamp-2 leading-snug mb-1.5">
        {node.summary || '暂无摘要'}
      </p>

      <div className="flex items-center justify-between text-[10px] text-[var(--ink-text-faint)] pt-1 border-t border-[var(--ink-border)]/50">
        <span className="flex items-center gap-1">
          {node.prerequisites && node.prerequisites.length > 0 && (
            <span className="flex items-center gap-0.5 text-blue-400" title={`前置依赖: ${node.prerequisites.length} 个`}>
              <Link2 className="w-2.5 h-2.5" />
              {node.prerequisites.length}
            </span>
          )}
        </span>
        <span className={`font-medium ${polarityColor}`} title={`情感张力: ${node.emotionalPolarity}`}>
          {node.emotionalPolarity > 0 ? `+${node.emotionalPolarity}` : node.emotionalPolarity}
        </span>
      </div>
    </div>
  )
}
