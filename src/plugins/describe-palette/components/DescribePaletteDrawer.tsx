import { useState, useMemo, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import type { SenseType, SensorySnippet } from '../types'
import { describePaletteEngine } from '../engine/DescribePaletteEngine'
import { clipboardWriter } from '../../../adapters/clipboardWriter'
import {
  Palette,
  Search,
  Dices,
  Copy,
  Check,
  AlertCircle,
  Eye,
  Volume2,
  Wind,
  Utensils,
  Hand,
  Sparkles,
} from 'lucide-react'

const SENSE_ICONS: Record<SenseType, typeof Eye> = {
  sight: Eye,
  sound: Volume2,
  scent: Wind,
  taste: Utensils,
  touch: Hand,
  metaphor: Sparkles,
}

const SENSE_LABELS: Record<SenseType, string> = {
  sight: '视觉',
  sound: '听觉',
  scent: '嗅觉',
  taste: '味觉',
  touch: '触觉',
  metaphor: '意象',
}

export const DescribePaletteDrawer: FC<DesktopPluginDrawerProps> = ({ currentText }) => {
  const [query, setQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [randomSnippet, setRandomSnippet] = useState<SensorySnippet | null>(null)

  // 诊断当前段落（最近 300 字）
  const recentSnippet = useMemo(() => {
    if (!currentText) return ''
    return currentText.slice(-300)
  }, [currentText])

  const diagnosis = useMemo(() => {
    if (!recentSnippet.trim()) return null
    return describePaletteEngine.diagnoseText(recentSnippet)
  }, [recentSnippet])

  // 匹配的修辞金句
  const snippets = useMemo(() => {
    if (randomSnippet) return [randomSnippet]
    if (query.trim()) {
      return describePaletteEngine.searchSnippets(query, { limit: 10 })
    }
    // 默认展示与缺失感官相关的推荐金句，或前 5 条
    if (diagnosis && diagnosis.suggestedSnippets.length > 0) {
      return diagnosis.suggestedSnippets
    }
    return describePaletteEngine.getAllSnippets().slice(0, 5)
  }, [query, diagnosis, randomSnippet])

  const handleCopy = async (snip: SensorySnippet) => {
    try {
      await clipboardWriter.writeText(snip.text)
      setCopiedId(snip.id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch (e) {
      console.error('Failed to copy sensory snippet:', e)
    }
  }

  const handleRandomDice = () => {
    const sampled = describePaletteEngine.inspireRandom(undefined, undefined, 1)
    if (sampled.length > 0) {
      setRandomSnippet(sampled[0])
      setQuery('')
    }
  }

  return (
    <aside
      className="w-72 h-full flex flex-col bg-[var(--ink-bg-panel)] border-l border-[var(--ink-border)] text-[var(--ink-text)] text-xs"
      data-testid="describe-palette-drawer"
    >
      {/* 顶部随动感知栏 */}
      <div className="p-3 border-b border-[var(--ink-border)] bg-[var(--ink-bg-elevated)]/40 shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-[var(--ink-text)]">
            <Palette className="w-3.5 h-3.5 text-rose-500" />
            <span>修辞微观调色盘</span>
          </div>
          <button
            onClick={handleRandomDice}
            className="p-1 hover:bg-[var(--ink-bg-hover)] rounded text-[var(--ink-text-muted)] hover:text-amber-500"
            title="灵感摇号"
          >
            <Dices className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 随动感官缺失透视 */}
        {diagnosis && diagnosis.missingSenses.length > 0 && (
          <div className="p-2 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] space-y-1">
            <div className="flex items-center gap-1 text-[10px] text-amber-500 font-medium">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>近 300 字感官缺失提示：</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {diagnosis.missingSenses.slice(0, 3).map((ms) => (
                <span
                  key={ms}
                  className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px]"
                >
                  缺{SENSE_LABELS[ms]}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 快速搜索框 */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[var(--ink-text-muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setRandomSnippet(null)
            }}
            placeholder="搜索修辞关键词 (如雷霆、酒香)..."
            className="w-full pl-7 pr-2.5 py-1 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)] focus:outline-none"
          />
        </div>
      </div>

      {/* 金句列表 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {snippets.map((snip) => {
          const isCopied = copiedId === snip.id
          const SenseIcon = SENSE_ICONS[snip.primarySense] || Palette
          return (
            <div
              key={snip.id}
              className="p-2.5 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-canvas)] hover:border-[var(--ink-accent)]/40 transition-colors space-y-2"
            >
              <div className="flex items-center justify-between text-[10px]">
                <span className="flex items-center gap-1 text-[var(--ink-text-muted)]">
                  <SenseIcon className="w-3 h-3 text-sky-400" />
                  <span>{SENSE_LABELS[snip.primarySense]}</span>
                  <span>·</span>
                  <span>{snip.category}</span>
                </span>
                <button
                  onClick={() => handleCopy(snip)}
                  className="hover:text-[var(--ink-accent)] flex items-center gap-1 text-[var(--ink-text-muted)]"
                  title="复制此句"
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

              <p className="text-[11px] text-[var(--ink-text)] leading-relaxed font-normal">
                {snip.text}
              </p>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
