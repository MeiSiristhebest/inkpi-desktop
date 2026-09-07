import { htmlToPlain } from '../../../domain/text'
import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { NarrativeLinterEngine } from '../engine/NarrativeLinterEngine'
import type { LintIssue } from '../types'
import { CheckCircle2, AlertCircle, Wrench, BookOpen, Bot, Zap } from 'lucide-react'
import { clock } from '../../../adapters/clock'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'

export const NarrativeLinterMasterView: FC<DesktopPluginViewProps> = ({ projectId, onStats }) => {
  const hostContext = useOptionalPluginHostContext()
  const [engine] = useState(() => new NarrativeLinterEngine())
  const [rules, setRules] = useState(() => NarrativeLinterEngine.getDefaultRules())
  const [chapters, setChapters] = useState<any[]>([])
  const [selectedChapterId, setSelectedChapterId] = useState<string>('all')
  const [text, setText] = useState('')
  const [issues, setIssues] = useState<LintIssue[]>([])
  const [cleanScore, setCleanScore] = useState(100)

  // 1. 真实读取项目章节内容
  useEffect(() => {
    const loadChapters = async () => {
      try {
        const all = await indexedDbProjectRepository.getChaptersByProject(projectId)
        all.sort((a, b) => a.order - b.order)
        setChapters(all)

        if (all.length > 0) {
          const defaultChap = hostContext?.activeChapter
            ? all.find((c) => c.id === hostContext.activeChapter?.id) || all[0]
            : all[0]
          setSelectedChapterId(defaultChap.id)
          const chapText = htmlToPlain(defaultChap.content || '')
          setText(chapText)
          if (chapText) {
            const res = engine.lint(chapText, rules)
            setIssues(res.issues)
            setCleanScore(res.cleanScore)
          }
        }
      } catch (e) {
        console.error('Failed to load chapters for narrative linter:', e)
      }
    }
    loadChapters()
  }, [projectId, hostContext?.activeChapter?.id])

  const handleSelectChapter = (chapId: string) => {
    setSelectedChapterId(chapId)
    if (chapId === 'all') {
      const allText = chapters.map((c) => htmlToPlain(c.content || '')).join('\n\n')
      setText(allText.slice(0, 20000))
      const res = engine.lint(allText.slice(0, 20000), rules)
      setIssues(res.issues)
      setCleanScore(res.cleanScore)
    } else {
      const chap = chapters.find((c) => c.id === chapId)
      const chapText = chap?.content || ''
      setText(chapText)
      const res = engine.lint(chapText, rules)
      setIssues(res.issues)
      setCleanScore(res.cleanScore)
    }
  }

  useEffect(() => {
    onStats?.({
      title: '360+文学质量与人设门禁',
      wordCount: text.length,
      updatedAt: clock.now(),
    })
  }, [text, onStats])

  const handleAudit = () => {
    const res = engine.lint(text, rules)
    setIssues(res.issues)
    setCleanScore(res.cleanScore)
  }

  // 接入真实 AI 叙事深度体检
  const handleAiDeepLint = () => {
    if (!text.trim()) return
    const chap = chapters.find((c) => c.id === selectedChapterId)
    const prompt = `请作为资深文学编辑与网络小说审读总监，对以下正文文本进行深度的“叙事质量与人设瑕疵排查”：
【章节】：${chap ? `第 ${chap.order} 章《${chap.title}》` : '全书采样'}
【正文截选】：
${text.slice(0, 2500)}

请给出专业批注：
1. 语言表达层面：是否存在窒息冗长单句、过度副词修饰、翻译腔或现代出戏网络热梗；
2. 叙事节奏层面：是否存在“作者跳出来大段背景科普（Info-dumping）”而冲淡当前矛盾冲突；
3. 代词与视点层面：是否有主语代词频繁混淆（他/她/其）或越权上帝全知视角硬伤；
4. 给出最值得立刻重构润色的 2 处原句与改写对照。`

    if (hostContext?.aiAssistant?.prompt) {
      hostContext.aiAssistant.prompt(prompt)
    }
  }

  const toggleRule = (ruleId: string) => {
    setRules((prev) => prev.map((r) => (r.ruleId === ruleId ? { ...r, enabled: !r.enabled } : r)))
  }

  const applyFix = (issue: LintIssue) => {
    if (!issue.quickFix) return
    const newText = NarrativeLinterEngine.applyQuickFix(text, issue)
    setText(newText)
    const res = engine.lint(newText, rules)
    setIssues(res.issues)
    setCleanScore(res.cleanScore)
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto text-[var(--ink-text)] font-sans">
      <div className="flex items-center justify-between border-b pb-4 border-[var(--ink-border)]">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            <span>360+ 文学质量与人设门禁 (NarrativeLinter)</span>
          </h2>
          <p className="text-sm text-[var(--ink-text-muted)] mt-1">
            ESLint
            风格的网文工业级质量管线，直连真实章节，拦截副词堆叠、窒息长句、百科说教与现代热梗
          </p>
        </div>

        <div className="flex items-center gap-4">
          {chapters.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--ink-text-muted)] flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" />
                检查章节:
              </span>
              <select
                value={selectedChapterId}
                onChange={(e) => handleSelectChapter(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-md bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] text-[var(--ink-text)]"
              >
                <option value="all">全书章节聚合巡检</option>
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    第 {c.order} 章 · {c.title || '无标题'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="text-right">
            <div className="text-xs text-[var(--ink-text-muted)]">文学清洁度评分</div>
            <div
              className={`text-2xl font-black ${
                cleanScore >= 80
                  ? 'text-emerald-500'
                  : cleanScore >= 60
                    ? 'text-amber-500'
                    : 'text-rose-500'
              }`}
            >
              {cleanScore}{' '}
              <span className="text-sm font-normal text-[var(--ink-text-muted)]">/ 100</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="col-span-1 space-y-2 border rounded-xl p-3.5 bg-[var(--ink-bg-panel)] border-[var(--ink-border)]">
          <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--ink-text-muted)] mb-2">
            门禁规则集 ({rules.filter((r) => r.enabled).length}/{rules.length})
          </h3>
          <div className="space-y-2 text-xs">
            {rules.map((r) => (
              <div
                key={r.ruleId}
                onClick={() => toggleRule(r.ruleId)}
                className={`p-2 rounded-lg cursor-pointer border transition ${
                  r.enabled
                    ? 'bg-[var(--ink-bg-elevated)] border-[var(--ink-accent)] shadow-xs'
                    : 'bg-transparent border-[var(--ink-border)] opacity-50'
                }`}
              >
                <div className="font-semibold flex items-center justify-between">
                  <span>{r.name}</span>
                  <span className="text-[10px] px-1 py-0.5 rounded bg-[var(--ink-bg-hover)]">
                    {r.severity}
                  </span>
                </div>
                <div className="text-[var(--ink-text-muted)] mt-1 text-[11px]">{r.description}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-2 space-y-2 flex flex-col">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-[var(--ink-text)]">待审章节正文:</label>
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1 bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] hover:border-[var(--ink-accent)] text-[var(--ink-text)] rounded text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                onClick={handleAudit}
                disabled={!text.trim()}
              >
                <Zap className="w-3 h-3 text-amber-500" />
                规则复核
              </button>
              {hostContext?.aiAssistant?.isAvailable && (
                <button
                  className="px-3 py-1 bg-[var(--ink-accent)] text-white rounded text-xs font-semibold hover:opacity-90 transition flex items-center gap-1 cursor-pointer"
                  onClick={handleAiDeepLint}
                  disabled={!text.trim()}
                >
                  <Bot className="w-3 h-3" />
                  AI 叙事深度体检
                </button>
              )}
            </div>
          </div>

          <textarea
            className="w-full h-96 p-3 text-xs border rounded-xl font-serif resize-none bg-[var(--ink-bg-canvas)] border-[var(--ink-border)] text-[var(--ink-text)] leading-relaxed focus:outline-none"
            placeholder="自动从所选章节同步，亦可手动编辑或修改测试..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <div className="col-span-1 space-y-2 flex flex-col">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-[var(--ink-text)]">门禁拦截列表:</label>
            <span className="text-xs text-[var(--ink-text-muted)]">共 {issues.length} 处</span>
          </div>
          <div className="h-96 overflow-y-auto border rounded-xl p-2.5 space-y-2 bg-[var(--ink-bg-panel)] border-[var(--ink-border)] text-xs">
            {issues.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[var(--ink-text-muted)]">
                暂无违规项，文本符合工业级门禁标准
              </div>
            ) : (
              issues.map((issue) => (
                <div
                  key={issue.id}
                  className={`p-2.5 border rounded space-y-1.5 ${
                    issue.severity === 'error'
                      ? 'border-rose-400 bg-rose-50/50 dark:bg-rose-950/20'
                      : 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span
                      className={
                        issue.severity === 'error'
                          ? 'text-rose-600 flex items-center gap-1'
                          : 'text-amber-600 flex items-center gap-1'
                      }
                    >
                      <AlertCircle className="w-3.5 h-3.5" /> [{issue.ruleName}]
                    </span>
                    <span className="text-slate-400 font-normal text-[10px]">
                      L{issue.lineNumber}
                    </span>
                  </div>
                  <div className="font-mono bg-white dark:bg-slate-800 p-1 rounded text-[11px]">
                    "{issue.matchedSnippet}"
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 text-[11px]">
                    {issue.message}
                  </div>
                  {issue.quickFix && (
                    <button
                      onClick={() => applyFix(issue)}
                      className="mt-1 w-full text-center px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium transition text-[11px] flex items-center justify-center gap-1"
                    >
                      <Wrench className="w-3 h-3" /> {issue.quickFix.title}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
