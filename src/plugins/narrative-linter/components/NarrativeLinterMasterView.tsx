import { semanticTextFromContent } from '../../../domain/content'
import { useState, useEffect, useMemo, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { NarrativeLinterEngine } from '../engine/NarrativeLinterEngine'
import type { LintIssue } from '../types'
import { indexedDbNarrativeLinterRepository } from '../../../adapters/indexedDbNarrativeLinterRepository'
import {
  projectChapterSequence,
  type PositionedChapter,
} from '../../../domain/chapter/chapterSequence'
import { CheckCircle2, AlertCircle, Wrench, BookOpen, Bot, Zap } from 'lucide-react'
import { clock } from '../../../adapters/clock'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { usePluginAiTask } from '../../../core/usePluginAiTask'
import { PluginAiTaskPanel } from '../../../components/plugins/PluginAiTaskPanel'
import { ScoreProvenanceBadge } from '../../../ui/atoms'
import { Select } from '../../../ui/primitives'

export const NarrativeLinterMasterView: FC<DesktopPluginViewProps> = (props) => (
  <ProjectNarrativeLinterView key={props.projectId} {...props} />
)
const ProjectNarrativeLinterView: FC<DesktopPluginViewProps> = ({ projectId, onStats }) => {
  const hostContext = useOptionalPluginHostContext()
  const [engine] = useState(() => new NarrativeLinterEngine())
  const [rules, setRules] = useState(() => NarrativeLinterEngine.getDefaultRules())
  const [chapters, setChapters] = useState<PositionedChapter[]>([])
  const [selectedChapterId, setSelectedChapterId] = useState<string>('all')
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [ignoredIssueKeys, setIgnoredIssueKeys] = useState<string[]>([])
  const [configLoaded, setConfigLoaded] = useState(false)
  const summary = useMemo(() => engine.lint(text, rules), [engine, text, rules])
  const issues = summary.issues
  const aiTask = usePluginAiTask('narrative-linter', [projectId, text, selectedChapterId, rules])

  // 1. 真实读取项目章节内容
  useEffect(() => {
    let disposed = false
    const loadChapters = async () => {
      try {
        const [records, volumes, config] = await Promise.all([
          indexedDbProjectRepository.getChaptersByProject(projectId),
          indexedDbProjectRepository.getVolumesByProject(projectId),
          indexedDbNarrativeLinterRepository.getConfig(projectId),
        ])
        if (disposed) return
        const all = projectChapterSequence(projectId, records, volumes)
        if (config) {
          const defaults = NarrativeLinterEngine.getDefaultRules()
          setRules(
            config.rules.map((rule) => ({
              ...rule,
              options:
                rule.options ?? defaults.find((item) => item.ruleId === rule.ruleId)?.options,
            })),
          )
          setIgnoredIssueKeys(config.ignoredIssueKeys)
        }
        setConfigLoaded(true)
        setChapters(all)

        if (all.length > 0) {
          const defaultChap = hostContext?.activeChapter
            ? all.find((c) => c.id === hostContext.activeChapter?.id) || all[0]
            : all[0]
          setSelectedChapterId(defaultChap.id)
          const chapText = semanticTextFromContent(
            defaultChap.id,
            defaultChap.content || '',
            defaultChap.revision,
          )
          setText(chapText)
        }
      } catch (e) {
        if (!disposed) setError('章节或规则配置读取失败，请重新打开重试。')
      }
    }
    loadChapters()
    return () => {
      disposed = true
    }
  }, [projectId, hostContext?.activeChapter?.id])

  const handleSelectChapter = (chapId: string) => {
    setSelectedChapterId(chapId)
    if (chapId === 'all') {
      const allText = chapters
        .map((c) => semanticTextFromContent(c.id, c.content || '', c.revision))
        .join('\n\n')
      setText(allText)
    } else {
      const chap = chapters.find((c) => c.id === chapId)
      const chapText = chap
        ? semanticTextFromContent(chap.id, chap.content || '', chap.revision)
        : ''
      setText(chapText)
    }
  }

  useEffect(() => {
    onStats?.({
      title: '规则模型门禁 (NarrativeLinter)',
      wordCount: text.length,
      updatedAt: clock.now(),
    })
  }, [text, onStats])

  const handleAudit = () => {
    setText((current) => current)
  }

  // 接入 AI 叙事深度体检
  const handleAiDeepLint = async () => {
    if (!text.trim()) return
    const chap = chapters.find((c) => c.id === selectedChapterId)
    const analysisInput = {
      chapter: chap
        ? {
            id: chap.id,
            chapterNumber: chap.chapterNumber,
            revision: chap.revision,
            title: chap.title,
          }
        : undefined,
      text: semanticTextFromContent(chap?.id ?? 'manual-lint', text, chap?.revision ?? 0),
      rules,
      localObservations: issues.map(({ sourceText: _source, ...issue }) => issue),
    }

    await aiTask.run(analysisInput)
  }

  const toggleRule = (ruleId: string) => {
    setRules((prev) => prev.map((r) => (r.ruleId === ruleId ? { ...r, enabled: !r.enabled } : r)))
  }

  const applyFix = (issue: LintIssue) => {
    if (!issue.quickFix) return
    const newText = NarrativeLinterEngine.applyQuickFix(text, issue)
    setText(newText)
  }
  const saveRules = async () => {
    if (saving || !configLoaded || summary.configErrors.length) return
    setSaving(true)
    try {
      await indexedDbNarrativeLinterRepository.saveConfig({
        projectId,
        rules,
        ignoredIssueKeys,
        updatedAt: clock.now(),
      })
      setError('')
    } catch {
      setError('规则保存失败，请重试。当前输入已保留。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto text-[var(--ink-text)] font-sans">
      {error && <p role="alert">{error}</p>}
      {summary.configErrors.map((message) => (
        <p key={message} role="alert">
          {message}
        </p>
      ))}
      <div className="flex items-center justify-between border-b pb-4 border-[var(--ink-border)]">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            <span>规则模型门禁 (NarrativeLinter)</span>
          </h2>
          <p className="text-sm text-[var(--ink-text-muted)] mt-1">
            定位词项、句长和长对白；语境、人物声音与文学质量由作者和有出处的审阅另行判断。
          </p>
          <ScoreProvenanceBadge source="rule" detail="按作者启用的规则与阈值定位原文" />
        </div>

        <div className="flex items-center gap-4">
          {chapters.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--ink-text-muted)] flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" />
                检查章节:
              </span>
              <Select
                aria-label="检查章节"
                value={selectedChapterId}
                onValueChange={(v) => handleSelectChapter(v)}
                size="sm"
              >
                <option value="all">全书章节聚合巡检</option>
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.chapterNumber ? `第 ${c.chapterNumber} 章` : '位置未知'} ·{' '}
                    {c.title || '无标题'}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="text-right">
            <div className="text-xs text-[var(--ink-text-muted)]">当前规则命中</div>
            <div className="text-2xl font-bold">{issues.length} 处</div>
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
                className={`p-2 rounded-lg cursor-pointer border transition ${
                  r.enabled
                    ? 'bg-[var(--ink-bg-elevated)] border-[var(--ink-accent)] shadow-xs'
                    : 'bg-transparent border-[var(--ink-border)] opacity-50'
                }`}
              >
                <div className="font-semibold flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => toggleRule(r.ruleId)}
                    aria-pressed={r.enabled}
                  >
                    {r.name}
                  </button>
                  <span className="text-[10px] px-1 py-0.5 rounded bg-[var(--ink-bg-hover)]">
                    {r.severity}
                  </span>
                </div>
                <div className="text-[var(--ink-text-muted)] mt-1 text-[11px]">{r.description}</div>
                {r.ruleId !== 'LINT_ANACHRONISM' ? (
                  <label className="block mt-1">
                    {r.name}阈值
                    <input
                      aria-label={`${r.name}阈值`}
                      type="number"
                      min="1"
                      className="w-16 ml-1 border bg-[var(--ink-bg-canvas)]"
                      value={r.customThreshold ?? Number(Object.values(r.options ?? {})[0])}
                      onChange={(event) =>
                        setRules((current) =>
                          current.map((rule) =>
                            rule.ruleId === r.ruleId
                              ? { ...rule, customThreshold: Number(event.target.value) }
                              : rule,
                          ),
                        )
                      }
                    />
                  </label>
                ) : (
                  <label className="block mt-1">
                    作者词表（逗号分隔）
                    <input
                      aria-label="作者词表"
                      className="w-full border bg-[var(--ink-bg-canvas)]"
                      value={Array.isArray(r.options?.words) ? r.options.words.join(',') : ''}
                      onChange={(event) =>
                        setRules((current) =>
                          current.map((rule) =>
                            rule.ruleId === r.ruleId
                              ? {
                                  ...rule,
                                  options: {
                                    words: event.target.value
                                      .split(/[,，]/)
                                      .map((word) => word.trim())
                                      .filter(Boolean),
                                  },
                                }
                              : rule,
                          ),
                        )
                      }
                    />
                  </label>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled={!configLoaded || saving || summary.configErrors.length > 0}
            aria-busy={saving}
            onClick={saveRules}
            className="p-1 border rounded"
          >
            保存规则配置
          </button>
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
                  disabled={!text.trim() || aiTask.isRunning}
                >
                  <Bot className="w-3 h-3" />
                  AI 叙事深度体检
                </button>
              )}
              <PluginAiTaskPanel view={aiTask.view} onRetry={aiTask.retry} />
            </div>
          </div>

          <textarea
            aria-label="待审章节正文"
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
                {text.trim() ? '未命中当前启用规则；语境尚未审阅' : '等待正文'}
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
