import { useState, useMemo, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import type {
  NameCategory,
  NameStyle,
  GeneratedNameItem,
} from '../types'
import { nameForgeEngine } from '../engine/NameForgeEngine'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'
import { clipboardWriter } from '../../../adapters/clipboardWriter'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import type { CodexCategory } from '../../living-codex/types'
import {
  User,
  Globe2,
  Shield,
  Zap,
  Sword,
  Compass,
  Copy,
  Check,
  BookmarkPlus,
  BookmarkCheck,
  RefreshCw,
} from 'lucide-react'

const CATEGORY_TABS: { id: NameCategory; label: string; icon: typeof User }[] = [
  { id: 'character_cn', label: '修仙东方人名', icon: User },
  { id: 'character_western', label: '西方史诗奇幻', icon: Globe2 },
  { id: 'sect_faction', label: '宗门帮派势力', icon: Shield },
  { id: 'technique_spell', label: '功法神通秘典', icon: Zap },
  { id: 'item_artifact', label: '法宝神兵灵物', icon: Sword },
  { id: 'location_realm', label: '秘境禁地地理', icon: Compass },
]

const STYLE_OPTIONS: { id: NameStyle; label: string }[] = [
  { id: 'balanced', label: '平正均衡' },
  { id: 'cold_sharp', label: '冷峻肃杀' },
  { id: 'domineering', label: '霸道狂傲' },
  { id: 'ethereal', label: '飘逸出尘' },
  { id: 'demonic', label: '邪魅诡异' },
  { id: 'elegant', label: '古雅温润' },
]

export const NameForgeView: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const [selectedCategory, setSelectedCategory] = useState<NameCategory>('character_cn')
  const [selectedStyle, setSelectedStyle] = useState<NameStyle>('balanced')
  const [fixedPrefix, setFixedPrefix] = useState('')
  const [fixedKern, setFixedKern] = useState('')
  const [gender, setGender] = useState<'male' | 'female' | 'neutral'>('neutral')
  const [count, setCount] = useState<number>(10)

  // 结果列表与操作反馈
  const [results, setResults] = useState<GeneratedNameItem[]>(() =>
    nameForgeEngine.generateNames({ category: 'character_cn', count: 10, style: 'balanced' }),
  )
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  const handleGenerate = () => {
    const list = nameForgeEngine.generateNames({
      category: selectedCategory,
      style: selectedStyle,
      count,
      fixedPrefix: fixedPrefix.trim() || undefined,
      fixedKern: fixedKern.trim() || undefined,
      gender,
    })
    setResults(list)
    setSavedIds(new Set())
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

  const handleSaveToCodex = async (item: GeneratedNameItem) => {
    if (savedIds.has(item.id)) return

    let codexCategory: CodexCategory = 'character'
    if (item.category === 'sect_faction') codexCategory = 'faction'
    else if (item.category === 'technique_spell' || item.category === 'item_artifact') codexCategory = 'item'
    else if (item.category === 'location_realm') codexCategory = 'location'

    const now = clock.now()
    const entity = {
      id: idGenerator.generate('codex'),
      projectId: projectId || 'default',
      name: item.name,
      aliases: [],
      category: codexCategory,
      attributes: {
        style: item.style,
        phoneticsScore: item.phoneticsScore,
      },
      relations: [],
      summary: item.meaningOrVibe,
      detailMarkdown: `### 设定简述\n${item.meaningOrVibe}\n\n*由中西奇幻起名姬（Name Forge）智能熔铸生成。*`,
      createdAt: now,
      updatedAt: now,
    }

    try {
      await indexedDbCodexEntityRepository.save(entity)
      setSavedIds((prev) => new Set([...prev, item.id]))
    } catch (e) {
      console.error('Failed to save to living codex:', e)
    }
  }

  const currentCategoryInfo = useMemo(
    () => CATEGORY_TABS.find((t) => t.id === selectedCategory) || CATEGORY_TABS[0],
    [selectedCategory],
  )

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-canvas)] text-[var(--ink-text)] overflow-hidden">
      {/* 顶栏：标题与能力说明 */}
      <div className="border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4 shrink-0 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight">中西奇幻起名姬</h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--ink-accent)]/15 text-[var(--ink-accent)] font-medium">
                CFG 文法 · 平仄音韵
              </span>
            </div>
            <p className="text-xs text-[var(--ink-text-muted)] mt-0.5">
              规避死板字词拼接，结合汉语平仄音律与经典奇幻文法，一键联动 Living Codex 活体世界观
            </p>
          </div>

          <button
            onClick={handleGenerate}
            className="px-4 py-2 rounded-xl bg-[var(--ink-accent)] text-white text-xs font-semibold hover:opacity-90 flex items-center gap-1.5 shadow-sm transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>重新熔铸锻名</span>
          </button>
        </div>

        {/* 类别分类 Tab */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
          {CATEGORY_TABS.map((tab) => {
            const Icon = tab.icon
            const isSelected = selectedCategory === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setSelectedCategory(tab.id)
                  // 切换类别时自动生成一批对应名称
                  const list = nameForgeEngine.generateNames({
                    category: tab.id,
                    style: selectedStyle,
                    count,
                    fixedPrefix: fixedPrefix.trim() || undefined,
                    fixedKern: fixedKern.trim() || undefined,
                    gender,
                  })
                  setResults(list)
                  setSavedIds(new Set())
                }}
                className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 border transition-all ${
                  isSelected
                    ? 'border-[var(--ink-accent)] bg-[var(--ink-accent)]/10 text-[var(--ink-accent)] font-semibold shadow-xs'
                    : 'border-transparent hover:bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* 控制台参数微调 */}
        <div className="flex flex-wrap items-center gap-3 p-2.5 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)]/50 text-xs">
          {/* 风格选择 */}
          <div className="flex items-center gap-1.5">
            <span className="text-[var(--ink-text-muted)] text-[11px]">风格：</span>
            <div className="flex items-center gap-1">
              {STYLE_OPTIONS.map((st) => (
                <button
                  key={st.id}
                  onClick={() => setSelectedStyle(st.id)}
                  className={`px-2 py-1 rounded text-[11px] transition-colors ${
                    selectedStyle === st.id
                      ? 'bg-[var(--ink-accent)] text-white font-medium'
                      : 'hover:bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)]'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-4 w-px bg-[var(--ink-border)]" />

          {/* 前缀/姓氏固定 */}
          <div className="flex items-center gap-1.5">
            <span className="text-[var(--ink-text-muted)] text-[11px]">固定姓氏/前缀：</span>
            <input
              type="text"
              value={fixedPrefix}
              onChange={(e) => setFixedPrefix(e.target.value)}
              placeholder="如 楚 / 姬 / 太玄"
              className="w-24 px-2 py-1 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)] focus:outline-none"
            />
          </div>

          {/* 字辈/核心字固定 */}
          <div className="flex items-center gap-1.5">
            <span className="text-[var(--ink-text-muted)] text-[11px]">字辈/核心意象：</span>
            <input
              type="text"
              value={fixedKern}
              onChange={(e) => setFixedKern(e.target.value)}
              placeholder="如 云 / 雷 / 剑"
              className="w-24 px-2 py-1 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)] focus:outline-none"
            />
          </div>

          {/* 性别（西幻专用） */}
          {selectedCategory === 'character_western' && (
            <>
              <div className="h-4 w-px bg-[var(--ink-border)]" />
              <div className="flex items-center gap-1">
                <span className="text-[var(--ink-text-muted)] text-[11px]">性别：</span>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as 'male' | 'female' | 'neutral')}
                  className="px-2 py-1 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)] focus:outline-none"
                >
                  <option value="neutral">随机混搭</option>
                  <option value="male">男性氏族</option>
                  <option value="female">女性法师/贵族</option>
                </select>
              </div>
            </>
          )}

          {/* 数量 */}
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-[var(--ink-text-muted)] text-[11px]">批次：</span>
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="px-2 py-1 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)] focus:outline-none"
            >
              <option value={5}>5 条</option>
              <option value={10}>10 条</option>
              <option value={20}>20 条</option>
            </select>
          </div>
        </div>
      </div>

      {/* 熔铸结果展示区 */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between text-xs text-[var(--ink-text-muted)] mb-4">
          <div className="flex items-center gap-2">
            <span>当前熔铸品类：{currentCategoryInfo.label}</span>
            <span>·</span>
            <span>本次生成 {results.length} 个候选命名</span>
          </div>
          <span className="text-[11px]">点击「收录至图谱」可直通 Living Codex 世界观图谱</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((item) => {
            const isCopied = copiedId === item.id
            const isSaved = savedIds.has(item.id)

            return (
              <div
                key={item.id}
                className="p-4 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] flex flex-col justify-between hover:border-[var(--ink-accent)]/50 transition-all group"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-[var(--ink-text)] tracking-tight">
                        {item.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-[var(--ink-text-muted)]">
                        {item.parts.prefix && <span>前缀: {item.parts.prefix}</span>}
                        <span>核心: {item.parts.core}</span>
                        {item.parts.suffix && <span>形制: {item.parts.suffix}</span>}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                        音律 {item.phoneticsScore}
                      </span>
                      <span className="text-[9px] text-[var(--ink-text-faint)]">
                        {STYLE_OPTIONS.find((s) => s.id === item.style)?.label}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-[var(--ink-text-muted)] leading-relaxed bg-[var(--ink-bg-canvas)] p-2.5 rounded-lg border border-[var(--ink-border)]/50">
                    {item.meaningOrVibe}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 mt-3 border-t border-[var(--ink-border)]/40 text-xs">
                  <button
                    onClick={() => handleSaveToCodex(item)}
                    className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 transition-colors ${
                      isSaved
                        ? 'bg-emerald-500/20 text-emerald-500 font-medium'
                        : 'bg-[var(--ink-bg-elevated)] hover:bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)] hover:text-[var(--ink-accent)]'
                    }`}
                    title="收录至活体世界观图谱"
                  >
                    {isSaved ? (
                      <>
                        <BookmarkCheck className="w-3.5 h-3.5" />
                        <span>已收录图谱</span>
                      </>
                    ) : (
                      <>
                        <BookmarkPlus className="w-3.5 h-3.5" />
                        <span>收录至图谱</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleCopy(item)}
                    className={`p-1.5 rounded-lg flex items-center gap-1 transition-colors ${
                      isCopied
                        ? 'bg-emerald-500/20 text-emerald-500 font-semibold'
                        : 'hover:bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)] group-hover:text-[var(--ink-text)]'
                    }`}
                    title="复制名称"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span className="text-[11px]">已复制</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span className="text-[11px]">复制</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
