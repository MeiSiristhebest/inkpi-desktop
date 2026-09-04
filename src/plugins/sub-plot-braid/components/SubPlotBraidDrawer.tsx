import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { SubPlotBraidEngine } from '../engine/SubPlotBraidEngine'
import type { SubPlotStrand } from '../types'
import { indexedDbSubPlotRepository } from '../../../adapters/indexedDbSubPlotRepository'
import { GitMerge } from 'lucide-react'

export const SubPlotBraidDrawer: FC<DesktopPluginDrawerProps> = ({ projectId, currentText }) => {
  const [strands, setStrands] = useState<SubPlotStrand[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let isMounted = true
    const loadStrands = async () => {
      setLoading(true)
      try {
        const all = await indexedDbSubPlotRepository.getAll(projectId)
        if (!isMounted) return
        setStrands(all)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    loadStrands()
    return () => {
      isMounted = false
    }
  }, [projectId])

  const activeDetectedStrands = SubPlotBraidEngine.detectActiveStrandsInText({
    text: currentText || '',
    strands,
  })

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-panel)] text-[var(--ink-text)] overflow-y-auto p-4 space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-[var(--ink-border)] pb-2">
        <span className="font-semibold text-sm flex items-center gap-1.5 text-purple-500">
          <GitMerge className="w-4 h-4" /> 多线叙事随动感知
        </span>
        <span className="text-[10px] text-[var(--ink-text-muted)]">
          待推副线: {strands.filter((s) => s.status === 'active').length}
        </span>
      </div>

      {loading ? (
        <div className="p-4 text-xs text-[var(--ink-text-muted)] text-center py-8">
          探测本章叙事线索...
        </div>
      ) : activeDetectedStrands.length > 0 ? (
        <div className="space-y-2">
          <span className="text-[11px] font-semibold text-purple-500 block">
            本章正推进的副线 ({activeDetectedStrands.length})：
          </span>
          {activeDetectedStrands.map((s) => (
            <div
              key={s.id}
              className="p-2.5 rounded-lg border border-purple-500/30 bg-purple-500/10 space-y-1"
            >
              <div className="font-bold text-[var(--ink-text)]">{s.title}</div>
              <p className="text-[11px] text-[var(--ink-text-muted)] line-clamp-2">{s.summary}</p>
              {s.involvedCharacterNames.length > 0 && (
                <div className="text-[10px] text-purple-400">
                  出镜配角: {s.involvedCharacterNames.join('、')}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 text-center text-[var(--ink-text-muted)] border border-dashed border-[var(--ink-border)] rounded-lg">
          当前章节未直接提及已有副线的特征词或配角名。
        </div>
      )}

      {/* 待推进副线速览 */}
      <div className="space-y-2 pt-2 border-t border-[var(--ink-border)]">
        <span className="text-[11px] font-semibold text-[var(--ink-text-muted)] block">
          需防遗忘/活跃中副线：
        </span>
        {strands
          .filter((s) => s.status === 'active')
          .slice(0, 4)
          .map((s) => (
            <div
              key={s.id}
              className="p-2 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[11px] space-y-0.5"
            >
              <div className="font-medium text-[var(--ink-text)]">{s.title}</div>
              <div className="text-[10px] text-[var(--ink-text-muted)]">
                自第 {s.lastActiveChapterOrder} 章后暂无新推进
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}
