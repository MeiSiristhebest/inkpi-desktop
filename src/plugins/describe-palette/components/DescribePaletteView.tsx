import { useState, useMemo, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import type { SenseType, GenreType, SensorySnippet } from '../types'
import { describePaletteEngine } from '../engine/DescribePaletteEngine'
import { clipboardWriter } from '../../../adapters/clipboardWriter'
import {
  Palette,
  Search,
  Dices,
  Copy,
  Check,
  Eye,
  Volume2,
  Wind,
  Utensils,
  Hand,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Activity,
} from 'lucide-react'

const SENSE_TABS: { id: SenseType | 'all'; label: string; icon: typeof Eye; color: string }[] = [
  { id: 'all', label: '全部感官', icon: Palette, color: 'text-zinc-400' },
  { id: 'sight', label: '视觉 (光影)', icon: Eye, color: 'text-sky-400' },
  { id: 'sound', label: '听觉 (音律)', icon: Volume2, color: 'text-emerald-400' },
  { id: 'scent', label: '嗅觉 (气息)', icon: Wind, color: 'text-amber-400' },
  { id: 'taste', label: '味觉 (滋味)', icon: Utensils, color: 'text-rose-400' },
  { id: 'touch', label: '触觉 (体感)', icon: Hand, color: 'text-cyan-400' },
  { id: 'metaphor', label: '意象 (通感)', icon: Sparkles, color: 'text-purple-400' },
]

const GENRE_TABS: { id: GenreType; label: string }[] = [
  { id: 'all', label: '全题材' },
  { id: 'xianxia', label: '修仙东方' },
  { id: 'wuxia', label: '传统武侠' },
  { id: 'fantasy', label: '西方奇幻' },
  { id: 'scifi', label: '科幻赛博' },
  { id: 'urban', label: '都市日常' },
  { id: 'horror', label: '惊悚悬疑' },
]

export const DescribePaletteView: FC<DesktopPluginViewProps> = () => {
  const [selectedSense, setSelectedSense] = useState<SenseType | 'all'>('all')
  const [selectedGenre, setSelectedGenre] = useState<GenreType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // 诊断器状态
  const [showDiagnostic, setShowDiagnostic] = useState(false)
  const [diagInput, setDiagInput] = useState('')

  // 检索匹配
  const filteredSnippets = useMemo(() => {
    return describePaletteEngine.searchSnippets(searchQuery, {
      genre: selectedGenre,
      sense: selectedSense === 'all' ? undefined : selectedSense,
      limit: 60,
    })
  }, [searchQuery, selectedGenre, selectedSense])

  // 诊断报告
  const diagnosisReport = useMemo(() => {
    if (!diagInput.trim()) return null
    return describePaletteEngine.diagnoseText(diagInput)
  }, [diagInput])

  const handleCopy = async (snippet: SensorySnippet) => {
    try {
      await clipboardWriter.writeText(snippet.text)
      setCopiedId(snippet.id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch (e) {
      console.error('Failed to copy text:', e)
    }
  }

  const handleRandomInspire = () => {
    const sampled = describePaletteEngine.inspireRandom(
      selectedGenre,
      selectedSense === 'all' ? undefined : selectedSense,
      1,
    )
    if (sampled.length > 0) {
      setSearchQuery(sampled[0].keywords[0] || '')
    }
  }

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-canvas)] text-[var(--ink-text)] overflow-hidden">
      {/* 顶栏 */}
      <div className="border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4 shrink-0 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight">五感微观修辞调色盘</h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--ink-accent)]/15 text-[var(--ink-accent)] font-medium">
                Sensory Hexagon · 通感修辞
              </span>
            </div>
            <p className="text-xs text-[var(--ink-text-muted)] mt-0.5">
              视/听/嗅/味/触/意象六维语料，克服流水账平铺，诊断微观感官饱满度
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDiagnostic(!showDiagnostic)}
              className={`px-3 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition-colors ${
                showDiagnostic
                  ? 'border-[var(--ink-accent)] bg-[var(--ink-accent)]/15 text-[var(--ink-accent)] font-semibold'
                  : 'border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] hover:bg-[var(--ink-bg-hover)]'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>感官雷达诊断</span>
              {showDiagnostic ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
            </button>
            <button
              onClick={handleRandomInspire}
              className="px-3 py-1.5 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] hover:bg-[var(--ink-bg-hover)] text-xs flex items-center gap-1.5"
              title="随机抽取一组灵感修辞"
            >
              <Dices className="w-3.5 h-3.5 text-amber-500" /> 灵感摇号
            </button>
          </div>
        </div>

        {/* 筛选与搜索 */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[var(--ink-text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索金句、意向关键字（如雷霆、剑气、焦土、酒香）..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)] focus:border-[var(--ink-accent)] focus:outline-none"
            />
          </div>

          {/* 题材选择 */}
          <div className="flex items-center gap-1 overflow-x-auto text-xs py-0.5">
            {GENRE_TABS.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelectedGenre(g.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap transition-colors ${
                  selectedGenre === g.id
                    ? 'bg-[var(--ink-accent)] text-white font-medium'
                    : 'bg-[var(--ink-bg-elevated)] hover:bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)]'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* 感官维度分类 Tab */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
          {SENSE_TABS.map((tab) => {
            const Icon = tab.icon
            const isSelected = selectedSense === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedSense(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 border transition-all ${
                  isSelected
                    ? 'border-[var(--ink-accent)] bg-[var(--ink-accent)]/10 text-[var(--ink-accent)] font-semibold shadow-xs'
                    : 'border-transparent hover:bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${tab.color}`} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 感官诊断仪折叠展开区 */}
      {showDiagnostic && (
        <div className="border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4 shrink-0 space-y-3">
          <div className="flex items-start gap-4">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-semibold text-[var(--ink-text)] flex items-center justify-between">
                <span>粘贴或编写待诊断的场景描写：</span>
                <span className="text-[10px] text-[var(--ink-text-muted)] font-normal">
                  {diagInput.length} 字
                </span>
              </label>
              <textarea
                rows={3}
                value={diagInput}
                onChange={(e) => setDiagInput(e.target.value)}
                placeholder="例如：残阳如血，李青云拔出三尺青锋，剑芒大盛，寒潭周围的温度骤然降低，刺骨的煞气令人牙关打颤..."
                className="w-full p-2.5 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)] focus:border-[var(--ink-accent)] focus:outline-none resize-none"
              />
            </div>

            {/* 诊断结果指标 */}
            {diagnosisReport && (
              <div className="w-80 p-3 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] space-y-2 text-xs">
                <div className="flex items-center justify-between font-semibold">
                  <span className="flex items-center gap-1 text-[var(--ink-text)]">
                    <Activity className="w-3.5 h-3.5 text-blue-400" /> 感官雷达透视
                  </span>
                  <span className="text-[10px] text-[var(--ink-text-muted)]">
                    主感官: {diagnosisReport.dominantSense ? diagnosisReport.dominantSense.toUpperCase() : '无'}
                  </span>
                </div>

                {/* 六维百分比进度条 */}
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div>
                    <div className="flex justify-between text-[var(--ink-text-muted)] mb-0.5">
                      <span>视觉</span>
                      <span>{diagnosisReport.radarPercentages.sight}%</span>
                    </div>
                    <div className="h-1 bg-[var(--ink-bg-canvas)] rounded-full overflow-hidden">
                      <div
                        style={{ width: `${diagnosisReport.radarPercentages.sight}%` }}
                        className="h-full bg-sky-400 rounded-full"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[var(--ink-text-muted)] mb-0.5">
                      <span>听觉</span>
                      <span>{diagnosisReport.radarPercentages.sound}%</span>
                    </div>
                    <div className="h-1 bg-[var(--ink-bg-canvas)] rounded-full overflow-hidden">
                      <div
                        style={{ width: `${diagnosisReport.radarPercentages.sound}%` }}
                        className="h-full bg-emerald-400 rounded-full"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[var(--ink-text-muted)] mb-0.5">
                      <span>嗅觉</span>
                      <span>{diagnosisReport.radarPercentages.scent}%</span>
                    </div>
                    <div className="h-1 bg-[var(--ink-bg-canvas)] rounded-full overflow-hidden">
                      <div
                        style={{ width: `${diagnosisReport.radarPercentages.scent}%` }}
                        className="h-full bg-amber-400 rounded-full"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[var(--ink-text-muted)] mb-0.5">
                      <span>味觉</span>
                      <span>{diagnosisReport.radarPercentages.taste}%</span>
                    </div>
                    <div className="h-1 bg-[var(--ink-bg-canvas)] rounded-full overflow-hidden">
                      <div
                        style={{ width: `${diagnosisReport.radarPercentages.taste}%` }}
                        className="h-full bg-rose-400 rounded-full"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[var(--ink-text-muted)] mb-0.5">
                      <span>触觉</span>
                      <span>{diagnosisReport.radarPercentages.touch}%</span>
                    </div>
                    <div className="h-1 bg-[var(--ink-bg-canvas)] rounded-full overflow-hidden">
                      <div
                        style={{ width: `${diagnosisReport.radarPercentages.touch}%` }}
                        className="h-full bg-cyan-400 rounded-full"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[var(--ink-text-muted)] mb-0.5">
                      <span>通感</span>
                      <span>{diagnosisReport.radarPercentages.metaphor}%</span>
                    </div>
                    <div className="h-1 bg-[var(--ink-bg-canvas)] rounded-full overflow-hidden">
                      <div
                        style={{ width: `${diagnosisReport.radarPercentages.metaphor}%` }}
                        className="h-full bg-purple-400 rounded-full"
                      />
                    </div>
                  </div>
                </div>

                {/* 导师建议 */}
                <p className="text-[11px] text-[var(--ink-text-muted)] leading-relaxed pt-1 border-t border-[var(--ink-border)]">
                  💡 {diagnosisReport.advice}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 金句卡片网格列表 */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between text-xs text-[var(--ink-text-muted)] mb-4">
          <span>共找到 {filteredSnippets.length} 条精修描写金句</span>
          <span className="text-[11px]">点击右侧复制按钮即可直接带走</span>
        </div>

        {filteredSnippets.length === 0 ? (
          <div className="p-12 text-center text-xs text-[var(--ink-text-muted)]">
            未找到匹配的描写金句，请尝试更换关键词或感官维度。
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSnippets.map((snippet) => {
              const isCopied = copiedId === snippet.id
              const senseInfo = SENSE_TABS.find((t) => t.id === snippet.primarySense)
              const Icon = senseInfo?.icon || Palette

              return (
                <div
                  key={snippet.id}
                  className="p-4 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] flex flex-col justify-between hover:border-[var(--ink-accent)]/50 transition-all group"
                >
                  <div className="space-y-2">
                    {/* 卡片顶部：感官徽章 + 分类 */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[10px] font-medium">
                        <Icon className={`w-3 h-3 ${senseInfo?.color}`} />
                        <span>{senseInfo?.label.split(' ')[0]}</span>
                      </span>

                      <span className="text-[10px] text-[var(--ink-text-muted)]">
                        {snippet.category}
                      </span>
                    </div>

                    {/* 金句正文 */}
                    <p className="text-xs font-medium leading-relaxed text-[var(--ink-text)] pt-1">
                      {snippet.text}
                    </p>

                    {/* 文学范例上下文 */}
                    {snippet.exampleContext && (
                      <p className="text-[11px] text-[var(--ink-text-faint)] italic line-clamp-2">
                        “{snippet.exampleContext}”
                      </p>
                    )}
                  </div>

                  {/* 卡片底栏：关键词标签 + 复制按钮 */}
                  <div className="flex items-center justify-between pt-3 mt-2 border-t border-[var(--ink-border)]/40 text-[10px]">
                    <div className="flex flex-wrap gap-1">
                      {snippet.keywords.map((kw, i) => (
                        <span
                          key={i}
                          className="px-1.5 py-0.5 rounded bg-[var(--ink-bg-canvas)] text-[var(--ink-text-muted)]"
                        >
                          #{kw}
                        </span>
                      ))}
                    </div>

                    <button
                      onClick={() => handleCopy(snippet)}
                      className={`p-1.5 rounded-md flex items-center gap-1 transition-colors ${
                        isCopied
                          ? 'bg-emerald-500/20 text-emerald-500 font-semibold'
                          : 'hover:bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)] group-hover:text-[var(--ink-text)]'
                      }`}
                      title="复制金句"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span className="text-[10px]">已复制</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span className="text-[10px]">复制</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
