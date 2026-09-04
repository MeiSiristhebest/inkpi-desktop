import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { MemoryPalaceEngine } from '../engine/MemoryPalaceEngine'
import type { CodexEntity } from '../../living-codex/types'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'
import { Sparkles, MapPin, Sword, User, HelpCircle, History } from 'lucide-react'

export const MemoryPalaceDrawer: FC<DesktopPluginDrawerProps> = ({ projectId, currentText }) => {
  const [entities, setEntities] = useState<CodexEntity[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let isMounted = true
    const loadEntities = async () => {
      setLoading(true)
      try {
        const allEnts = await indexedDbCodexEntityRepository.getAll()
        if (!isMounted) return
        const projectEnts = (allEnts || []).filter((e) => !e.projectId || e.projectId === projectId)
        setEntities(projectEnts)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadEntities()
    return () => {
      isMounted = false
    }
  }, [projectId])

  const detectedEntities = MemoryPalaceEngine.detectEntitiesInText(currentText || '', entities)

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'character':
        return <User className="w-3.5 h-3.5 text-blue-500" />
      case 'item':
        return <Sword className="w-3.5 h-3.5 text-amber-500" />
      case 'location':
        return <MapPin className="w-3.5 h-3.5 text-emerald-500" />
      default:
        return <HelpCircle className="w-3.5 h-3.5 text-purple-500" />
    }
  }

  if (loading) {
    return (
      <div className="p-4 text-xs text-[var(--ink-text-muted)] text-center py-8">
        识别当前章节实体记忆...
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-panel)] text-[var(--ink-text)] overflow-y-auto p-4 space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-[var(--ink-border)] pb-2">
        <span className="font-semibold text-sm flex items-center gap-1.5 text-indigo-500">
          <Sparkles className="w-4 h-4" /> 本章登场实体速查
        </span>
        <span className="text-[10px] text-[var(--ink-text-muted)]">
          已探知 {detectedEntities.length} 个实体
        </span>
      </div>

      {detectedEntities.length === 0 ? (
        <div className="p-4 text-center text-[var(--ink-text-muted)] border border-dashed border-[var(--ink-border)] rounded-lg">
          当前章节正文中未发现已录入的实体名。
          <p className="text-[10px] text-[var(--ink-text-muted)] mt-1">
            （实体库共 {entities.length} 个设定项）
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {detectedEntities.map((ent) => (
            <div
              key={ent.id}
              className="bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] rounded-lg p-2.5 shadow-sm space-y-1.5 hover:border-indigo-400 transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-[var(--ink-text)]">
                  {getCategoryIcon(ent.category)}
                  <span>{ent.name}</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 bg-[var(--ink-bg-canvas)] rounded text-[var(--ink-text-muted)]">
                  {ent.category}
                </span>
              </div>

              {ent.aliases && ent.aliases.length > 0 && (
                <div className="text-[10px] text-[var(--ink-text-muted)]">
                  别名：{ent.aliases.join('、')}
                </div>
              )}

              {ent.summary && (
                <p className="text-xs text-[var(--ink-text)] line-clamp-2 leading-relaxed bg-[var(--ink-bg-canvas)] p-1.5 rounded">
                  {ent.summary}
                </p>
              )}

              <div className="text-[10px] text-indigo-500 flex items-center gap-1 pt-0.5">
                <History className="w-3 h-3" />
                可在主面板查看跨卷出场频率与历史章次回溯
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
