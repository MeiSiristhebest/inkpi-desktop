import { useState, useEffect, useMemo, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import type { SensitiveWord, RegexRule, GenreStyle, SafeGateScanResult } from '../types'
import { SafeGateEngine } from '../engine/SafeGateEngine'
import seedWordsRed from '../data/seed-words-red.json'
import seedWordsYellow from '../data/seed-words-yellow.json'
import seedWordsBlue from '../data/seed-words-blue.json'
import regexRules from '../data/regex-rules.json'
import {
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Wand2,
  AlertOctagon,
  AlertTriangle,
  Info,
} from 'lucide-react'

const ALL_WORDS: SensitiveWord[] = [
  ...(seedWordsRed as SensitiveWord[]),
  ...(seedWordsYellow as SensitiveWord[]),
  ...(seedWordsBlue as SensitiveWord[]),
]

const DEMO_TEST_TEXT = `林枫手持利刃杀入敌阵，刹那间血肉横飞，场面开膛破肚惨不忍睹。
后方政府与公安局的飞舟正在赶来，消息传出后立刻被河  蟹了。
一旁的魔修狂妄叫嚣：“你这屌丝也敢来送死？老子的战力当真牛逼！”`

export const SafeGateView: FC<DesktopPluginViewProps> = () => {
  const [engine] = useState(() => {
    const eng = new SafeGateEngine()
    eng.build(ALL_WORDS, regexRules as RegexRule[])
    return eng
  })

  const [text, setText] = useState(DEMO_TEST_TEXT)
  const [genre, setGenre] = useState<GenreStyle>('xianxia')
  const [filterLevel, setFilterLevel] = useState<'all' | 'red' | 'yellow' | 'blue'>('all')
  const [scanResult, setScanResult] = useState<SafeGateScanResult>(() =>
    engine.scan(DEMO_TEST_TEXT, 'xianxia'),
  )

  const handleScan = () => {
    setScanResult(engine.scan(text, genre))
  }

  useEffect(() => {
    handleScan()
  }, [text, genre])

  // 批量一键平替
  const handleBatchReplace = () => {
    const replaced = engine.applyAllAuto(text, scanResult, genre)
    setText(replaced)
  }

  // 单条平替
  const handleSingleReplace = (violationId: string, replacement: string) => {
    const v = scanResult.violations.find((item) => item.id === violationId)
    if (!v) return
    const replaced = engine.applyReplacement(text, v, {
      replacement,
      genre: [genre],
      confidence: 1.0,
    })
    setText(replaced)
  }

  const filteredViolations = useMemo(() => {
    if (filterLevel === 'all') return scanResult.violations
    return scanResult.violations.filter((v) => v.level === filterLevel)
  }, [scanResult, filterLevel])

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-canvas)] text-[var(--ink-text)] overflow-hidden">
      {/* 顶栏 */}
      <div className="border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4 shrink-0 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight">三级敏感词审查与文学平替</h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 font-medium">
              零外部依赖 · 纯本地离线词库
            </span>
          </div>
          <p className="text-xs text-[var(--ink-text-muted)] mt-0.5">
            红线（涉政/违规）+ 黄线（暴力/擦边）+ 蓝线（平台出戏/粗鄙），智能推荐文风自适应平替
          </p>
        </div>

        {/* 统计指标卡片 */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500">
            <AlertOctagon className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium">红线违规：{scanResult.redCount}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium">黄线告警：{scanResult.yellowCount}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Info className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium">蓝线建议：{scanResult.blueCount}</span>
          </div>

          <button
            onClick={handleBatchReplace}
            disabled={scanResult.isClean}
            className="px-3.5 py-1.5 rounded-lg bg-[var(--ink-accent)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-opacity"
          >
            <Wand2 className="w-3.5 h-3.5" /> 一键文学平替
          </button>
        </div>
      </div>

      {/* 控制栏 */}
      <div className="border-b border-[var(--ink-border)] px-4 py-2 bg-[var(--ink-bg-elevated)]/40 shrink-0 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[var(--ink-text-muted)]">文风适配：</span>
          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value as GenreStyle)}
            className="px-2 py-1 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)] focus:outline-none"
          >
            <option value="xianxia">仙侠修真 (推荐文言古风)</option>
            <option value="historical">古代历史 (推荐典籍成语)</option>
            <option value="urban">都市异能 (推荐现代委婉)</option>
            <option value="sci_fi">科幻赛博 (推荐未来建制)</option>
            <option value="fantasy">西幻魔法 (推荐奇幻术语)</option>
            <option value="neutral">通用中性</option>
          </select>

          <div className="h-3 w-px bg-[var(--ink-border)] mx-1" />

          {/* 级别过滤 */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilterLevel('all')}
              className={`px-2 py-0.5 rounded text-[11px] ${
                filterLevel === 'all'
                  ? 'bg-[var(--ink-bg-panel)] font-medium text-[var(--ink-text)] shadow-xs'
                  : 'text-[var(--ink-text-muted)]'
              }`}
            >
              全部 ({scanResult.violations.length})
            </button>
            <button
              onClick={() => setFilterLevel('red')}
              className={`px-2 py-0.5 rounded text-[11px] ${
                filterLevel === 'red'
                  ? 'bg-rose-500/15 font-medium text-rose-500'
                  : 'text-[var(--ink-text-muted)] hover:text-rose-400'
              }`}
            >
              红线 ({scanResult.redCount})
            </button>
            <button
              onClick={() => setFilterLevel('yellow')}
              className={`px-2 py-0.5 rounded text-[11px] ${
                filterLevel === 'yellow'
                  ? 'bg-amber-500/15 font-medium text-amber-500'
                  : 'text-[var(--ink-text-muted)] hover:text-amber-400'
              }`}
            >
              黄线 ({scanResult.yellowCount})
            </button>
            <button
              onClick={() => setFilterLevel('blue')}
              className={`px-2 py-0.5 rounded text-[11px] ${
                filterLevel === 'blue'
                  ? 'bg-blue-500/15 font-medium text-blue-400'
                  : 'text-[var(--ink-text-muted)] hover:text-blue-400'
              }`}
            >
              蓝线 ({scanResult.blueCount})
            </button>
          </div>
        </div>

        <button
          onClick={() => setText(DEMO_TEST_TEXT)}
          className="text-[11px] text-[var(--ink-accent)] hover:underline flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" /> 重置演示文本
        </button>
      </div>

      {/* 主体双栏：左侧待测文本编辑，右侧平替建议列表 */}
      <div className="flex-1 flex min-h-0 overflow-hidden divide-x divide-[var(--ink-border)]">
        {/* 左侧正文编辑与高亮预览 */}
        <div className="flex-1 flex flex-col min-w-0 bg-[var(--ink-bg-canvas)] p-4">
          <div className="text-xs text-[var(--ink-text-muted)] mb-2 flex items-center justify-between">
            <span>待检测正文文本</span>
            <span>{text.length} 字符</span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 w-full p-4 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] text-[var(--ink-text)] text-sm leading-relaxed resize-none focus:outline-none focus:border-[var(--ink-accent)]"
            placeholder="输入或粘贴需要质检审查的章节正文..."
          />
        </div>

        {/* 右侧平替建议列表 */}
        <div className="w-96 flex flex-col min-w-0 bg-[var(--ink-bg-panel)] overflow-hidden">
          <div className="p-3 border-b border-[var(--ink-border)] bg-[var(--ink-bg-elevated)]/40 shrink-0 text-xs font-semibold flex items-center justify-between">
            <span>审查结果与文学平替方案</span>
            {scanResult.isClean ? (
              <span className="text-emerald-500 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> 审查合规
              </span>
            ) : (
              <span className="text-rose-500 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" /> 存在违规风险
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {filteredViolations.length === 0 ? (
              <div className="text-center py-16 text-[var(--ink-text-muted)] text-xs">
                <ShieldCheck className="w-8 h-8 mx-auto text-emerald-500 mb-2 opacity-80" />
                <p className="font-medium text-emerald-500">此分类下无敏感风险</p>
                <p className="text-[10px] text-[var(--ink-text-faint)] mt-1">
                  当前文本已符合文风与平台安全标准
                </p>
              </div>
            ) : (
              filteredViolations.map((v) => (
                <div
                  key={v.id}
                  className={`p-3 rounded-xl border ${
                    v.level === 'red'
                      ? 'border-rose-500/30 bg-rose-500/5'
                      : v.level === 'yellow'
                        ? 'border-amber-500/30 bg-amber-500/5'
                        : 'border-blue-500/30 bg-blue-500/5'
                  } space-y-2 text-xs`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[var(--ink-text)] flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          v.level === 'red'
                            ? 'bg-rose-500'
                            : v.level === 'yellow'
                              ? 'bg-amber-500'
                              : 'bg-blue-400'
                        }`}
                      />
                      <span>命中「{v.matchedText}」</span>
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        v.level === 'red'
                          ? 'bg-rose-500/15 text-rose-500'
                          : v.level === 'yellow'
                            ? 'bg-amber-500/15 text-amber-500'
                            : 'bg-blue-500/15 text-blue-400'
                      }`}
                    >
                      {v.category}
                    </span>
                  </div>

                  {/* 推荐平替词按钮药丸 */}
                  <div>
                    <div className="text-[10px] text-[var(--ink-text-muted)] mb-1">
                      点击一键替换为文学平替：
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {v.suggestions.map((sug, i) => (
                        <button
                          key={i}
                          onClick={() => handleSingleReplace(v.id, sug.replacement)}
                          className="px-2 py-1 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] hover:border-[var(--ink-accent)] hover:text-[var(--ink-accent)] text-[11px] font-medium transition-colors flex items-center gap-1"
                          title={`置信度 ${Math.round(sug.confidence * 100)}%`}
                        >
                          <Sparkles className="w-2.5 h-2.5 text-[var(--ink-accent)]" />
                          <span>{sug.replacement}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
