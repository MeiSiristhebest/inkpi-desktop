import { useState, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import type { NameCategory, GeneratedNameItem } from '../types'
import { nameForgeEngine } from '../engine/NameForgeEngine'
import { clipboardWriter } from '../../../adapters/clipboardWriter'
import { Sparkles, Dices, Copy, Check } from 'lucide-react'

const CATEGORY_OPTIONS: { id: NameCategory; label: string }[] = [
  { id: 'character_cn', label: '东方人名' },
  { id: 'character_western', label: '西幻人名' },
  { id: 'sect_faction', label: '宗门势力' },
  { id: 'technique_spell', label: '功法神通' },
  { id: 'item_artifact', label: '法宝神兵' },
  { id: 'location_realm', label: '秘境地理' },
]

export const NameForgeDrawer: FC<DesktopPluginDrawerProps> = () => {
  const [category, setCategory] = useState<NameCategory>('character_cn')
  const [names, setNames] = useState<GeneratedNameItem[]>(() =>
    nameForgeEngine.generateNames({ category: 'character_cn', count: 5 }),
  )
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleReroll = () => {
    setNames(nameForgeEngine.generateNames({ category, count: 5 }))
  }

  const handleCategoryChange = (newCat: NameCategory) => {
    setCategory(newCat)
    setNames(nameForgeEngine.generateNames({ category: newCat, count: 5 }))
  }

  const handleCopy = async (item: GeneratedNameItem) => {
    try {
      await clipboardWriter.writeText(item.name)
      setCopiedId(item.id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch (e) {
      console.error('Failed to copy name:', e)
    }
  }

  return (
    <aside
      className="w-72 h-full flex flex-col bg-[var(--ink-bg-panel)] border-l border-[var(--ink-border)] text-[var(--ink-text)] text-xs"
      data-testid="name-forge-drawer"
    >
      {/* 顶栏 */}
      <div className="p-3 border-b border-[var(--ink-border)] bg-[var(--ink-bg-elevated)]/40 shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-[var(--ink-text)]">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>奇幻起名摇号</span>
          </div>

          <button
            onClick={handleReroll}
            className="p-1 hover:bg-[var(--ink-bg-hover)] rounded text-[var(--ink-text-muted)] hover:text-purple-400 flex items-center gap-1 text-[11px]"
            title="重新生成 5 个名字"
          >
            <Dices className="w-3.5 h-3.5" />
            <span>摇号</span>
          </button>
        </div>

        {/* 类别下拉切换 */}
        <div className="flex items-center gap-1 overflow-x-auto py-0.5">
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => handleCategoryChange(opt.id)}
              className={`px-2 py-1 rounded text-[10px] whitespace-nowrap transition-colors ${
                category === opt.id
                  ? 'bg-[var(--ink-accent)] text-white font-medium'
                  : 'bg-[var(--ink-bg-canvas)] hover:bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)] border border-[var(--ink-border)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 摇号结果紧凑列表 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {names.map((item) => {
          const isCopied = copiedId === item.id
          return (
            <div
              key={item.id}
              className="p-2.5 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-canvas)] hover:border-[var(--ink-accent)]/40 transition-colors space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-[var(--ink-text)]">{item.name}</span>
                <button
                  onClick={() => handleCopy(item)}
                  className="hover:text-[var(--ink-accent)] flex items-center gap-1 text-[var(--ink-text-muted)] text-[10px]"
                  title="复制名称"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span className="text-emerald-500">已复制</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>复制</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[10px] text-[var(--ink-text-muted)] line-clamp-1">
                {item.meaningOrVibe}
              </p>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
