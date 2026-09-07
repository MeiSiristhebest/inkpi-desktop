import React, { useMemo } from 'react'
import type { CodexEntity } from '../types'
import { ArrowRight, X, Sparkles, User, Shield } from 'lucide-react'
import { GenericAhoCorasick } from '../../../utils/AhoCorasick'

interface ChapterReferencesSidebarProps {
  entities: CodexEntity[]
  currentText: string
  onSelectEntity: (entity: CodexEntity) => void
  onClose: () => void
  isOpen: boolean
}

/**
 * 「本章引用」专属侧栏面板
 * 采用 AC 自动机执行 O(N) 线性提取，确保即便在 10 万字大章节中，侧栏统计计算亦毫无卡顿。
 */
export const ChapterReferencesSidebar: React.FC<ChapterReferencesSidebarProps> = ({
  entities,
  currentText,
  onSelectEntity,
  onClose,
  isOpen,
}) => {
  // 构建并持久化当前实体的 AC 自动机检索匹配池
  const acScanner = useMemo(() => {
    const ac = new GenericAhoCorasick<CodexEntity>()
    const items: Array<{ keyword: string; payload: CodexEntity }> = []

    for (const ent of entities) {
      if (ent.name && ent.name.trim().length >= 2) {
        items.push({ keyword: ent.name.trim(), payload: ent })
      }
      if (ent.aliases && Array.isArray(ent.aliases)) {
        for (const alias of ent.aliases) {
          if (alias && alias.trim().length >= 2) {
            items.push({ keyword: alias.trim(), payload: ent })
          }
        }
      }
    }
    ac.build(items)
    return ac
  }, [entities])

  // 单次高效扫描当前正文提及的实体（含出现频次统计）
  const { roles, settings, totalHits } = useMemo(() => {
    if (!isOpen || !currentText) {
      return { roles: [], settings: [], totalHits: 0 }
    }

    const matches = acScanner.scan(currentText)
    const entityCountMap = new Map<
      string,
      { entity: CodexEntity; count: number; hitAlias?: string }
    >()

    for (const m of matches) {
      const ent = m.payload
      const existing = entityCountMap.get(ent.id)
      if (existing) {
        existing.count += 1
      } else {
        entityCountMap.set(ent.id, {
          entity: ent,
          count: 1,
          hitAlias: m.keyword !== ent.name ? m.keyword : undefined,
        })
      }
    }

    const mentioned = Array.from(entityCountMap.values())
    const roleList = mentioned.filter((i) => i.entity.category === 'character')
    const settingList = mentioned.filter((i) => i.entity.category !== 'character')

    return {
      roles: roleList,
      settings: settingList,
      totalHits: matches.length,
    }
  }, [acScanner, currentText, isOpen])

  if (!isOpen) return null

  return (
    <aside className="w-64 h-full shrink-0 border-l border-[var(--ink-border)] bg-[var(--ink-bg-sidebar)] flex flex-col font-sans select-none z-20 animate-in slide-in-from-right-4 duration-200">
      {/* 顶部标题栏 */}
      <div className="h-11 px-4 border-b border-[var(--ink-border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
            <Sparkles className="w-3 h-3" />
          </div>
          <span className="text-[13px] font-semibold text-[var(--ink-text)]">本章引用</span>
          <span className="text-[11px] font-mono text-[var(--ink-text-muted)] bg-[var(--ink-bg-hover)] px-1.5 py-0.5 rounded-full">
            {totalHits}处
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer"
          title="收起引用侧栏"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 列表内容区 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
        {totalHits === 0 ? (
          <div className="py-12 text-center text-[var(--ink-text-faint)] space-y-2">
            <p className="font-medium text-[var(--ink-text-muted)]">本章尚未引用设定</p>
            <p className="text-[11px] leading-relaxed">
              在正文输入已在「设定集」登记的人物或专有名词，系统将自动高亮并归集于此。
            </p>
          </div>
        ) : (
          <>
            {/* 1. 角色分组 */}
            {roles.length > 0 && (
              <div className="space-y-1">
                <div className="px-2 py-1 text-[10.5px] font-semibold text-[var(--ink-text-faint)] flex items-center gap-1.5 uppercase tracking-wider">
                  <User className="w-3 h-3 text-emerald-600" />
                  <span>角色 · {roles.length}</span>
                </div>
                <div className="space-y-0.5">
                  {roles.map(({ entity: ent, count, hitAlias }) => (
                    <button
                      key={ent.id}
                      type="button"
                      onClick={() => onSelectEntity(ent)}
                      className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-[var(--ink-text)] hover:bg-[var(--ink-bg-elevated)] hover:shadow-2xs transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-medium truncate">{ent.name}</span>
                        {hitAlias && (
                          <span className="text-[10px] text-[var(--ink-text-faint)] truncate">
                            ({hitAlias})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] font-mono text-[var(--ink-text-faint)] tabular-nums">
                          {count}
                        </span>
                        <ArrowRight className="w-3 h-3 text-[var(--ink-text-faint)] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 2. 设定分组 */}
            {settings.length > 0 && (
              <div className="space-y-1">
                <div className="px-2 py-1 text-[10.5px] font-semibold text-[var(--ink-text-faint)] flex items-center gap-1.5 uppercase tracking-wider">
                  <Shield className="w-3 h-3 text-blue-600" />
                  <span>设定 · {settings.length}</span>
                </div>
                <div className="space-y-0.5">
                  {settings.map(({ entity: ent, count, hitAlias }) => (
                    <button
                      key={ent.id}
                      type="button"
                      onClick={() => onSelectEntity(ent)}
                      className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-[var(--ink-text)] hover:bg-[var(--ink-bg-elevated)] hover:shadow-2xs transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-medium truncate">{ent.name}</span>
                        {hitAlias && (
                          <span className="text-[10px] text-[var(--ink-text-faint)] truncate">
                            ({hitAlias})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] font-mono text-[var(--ink-text-faint)] tabular-nums">
                          {count}
                        </span>
                        <ArrowRight className="w-3 h-3 text-[var(--ink-text-faint)] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 底部提示栏 */}
      <div className="p-3 border-t border-[var(--ink-border)] bg-[var(--ink-bg-panel)]/50 text-[10.5px] text-[var(--ink-text-faint)] leading-relaxed">
        点击条目直达对应角色卡与设定表；支持在顶栏一键开关内联高亮。
      </div>
    </aside>
  )
}
