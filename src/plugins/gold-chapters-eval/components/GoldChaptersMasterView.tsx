import { semanticTextFromContent } from '../../../domain/content'
import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { indexedDbGoldChaptersRepository } from '../../../adapters/indexedDbGoldChaptersRepository'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { GoldChaptersEngine } from '../engine/GoldChaptersEngine'
import type { GoldChapterEvalRecord } from '../types'
import { Award, Send, Bot, BookOpen } from 'lucide-react'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { usePluginAiTask, type PluginAiTaskView } from '../../../core/usePluginAiTask'
import { validateGoldReview } from '../engine/GoldChaptersReview'
import { GoldChaptersEvidence } from './GoldChaptersEvidence'
import { PluginAiTaskPanel } from '../../../components/plugins/PluginAiTaskPanel'
import { ScoreProvenanceBadge } from '../../../ui/atoms'
import { projectChapterSequence } from '../../../domain/chapter/chapterSequence'

export const GoldChaptersMasterView: FC<DesktopPluginViewProps> = (props) => (
  <GoldChaptersWorkspaceView key={props.projectId} {...props} />
)

const GoldChaptersWorkspaceView: FC<DesktopPluginViewProps> = ({ projectId, onStats }) => {
  const hostContext = useOptionalPluginHostContext()
  const [chaptersText, setChaptersText] = useState('')
  const aiTask = usePluginAiTask('gold-chapters-eval', [projectId, chaptersText])
  const [evaluations, setEvaluations] = useState<GoldChapterEvalRecord[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [reviewSource, setReviewSource] = useState<{
    projectId: string
    text: string
    input: ReturnType<typeof GoldChaptersEngine.buildAnalysisInput>
  } | null>(null)
  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      try {
        const [allEvals, allChapters, volumes] = await Promise.all([
          indexedDbGoldChaptersRepository.getAll(projectId),
          indexedDbProjectRepository.getChaptersByProject(projectId),
          indexedDbProjectRepository.getVolumesByProject(projectId),
        ])
        if (cancelled) return
        setEvaluations(allEvals)
        const orderedChapters = projectChapterSequence(projectId, allChapters, volumes).filter(
          (chapter) => chapter.chapterNumber !== null,
        )
        if (orderedChapters.length > 0) {
          // Keep chapter boundaries in the source text; the analysis input declares its excerpt coverage.
          const firstThree = orderedChapters
            .slice(0, 3)
            .map(
              (c) =>
                `【第 ${c.chapterNumber} 章 · ${c.title}】\n${semanticTextFromContent(c.id, c.content || '', c.revision)}`,
            )
            .join('\n\n')
          setChaptersText(firstThree)
        }
      } catch {
        if (!cancelled) setSaveError('读取评价或卷章档案失败，请重新打开重试。')
      }
    }
    loadData().catch(console.error)
    return () => {
      cancelled = true
    }
  }, [projectId])

  useEffect(() => {
    onStats?.({
      title: '黄金三章文本规则诊断',
      wordCount: chaptersText.length,
      updatedAt: clock.now(),
    })
  }, [chaptersText, onStats])

  const currentEval = GoldChaptersEngine.evaluate(chaptersText)

  let reviewView: PluginAiTaskView =
    reviewSource?.projectId === projectId ? aiTask.view : { kind: 'idle' }
  if (reviewSource?.projectId === projectId && reviewSource.text !== chaptersText) {
    reviewView = {
      kind: 'failed',
      taskId: null,
      message: '分析后正文已变化，请基于当前文本重新点评',
    }
  }
  if (reviewView.kind === 'result' && reviewSource) {
    const validation =
      reviewSource.text === chaptersText
        ? validateGoldReview(reviewView.text, reviewSource.input)
        : { ok: false as const, error: '分析后正文已变化，请基于当前文本重新点评' }
    reviewView = validation.ok
      ? { ...reviewView, text: validation.text }
      : {
          kind: 'failed',
          taskId: reviewView.taskId,
          provenance: reviewView.provenance,
          message: validation.error,
        }
  }

  const handleAiGoldAudit = async () => {
    if (!chaptersText.trim() || aiTask.isRunning) return
    const analysisInput = GoldChaptersEngine.buildAnalysisInput(
      semanticTextFromContent(`gold-chapters-${projectId}`, chaptersText),
    )
    setReviewSource({ projectId, text: chaptersText, input: analysisInput })
    await aiTask.run(analysisInput)
  }

  const handleSave = async () => {
    if (!chaptersText.trim() || saving) return
    setSaving(true)
    setSaveError(null)
    const record: GoldChapterEvalRecord = {
      id: idGenerator.generate('gold'),
      projectId,
      observationSnapshot: currentEval,
      keyDiagnosis: [],
      suggestions: [],
      evaluatedAt: clock.now(),
    }
    try {
      await indexedDbGoldChaptersRepository.save(record)
      const all = await indexedDbGoldChaptersRepository.getAll(projectId)
      setEvaluations(all)
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : '文本线索快照保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="plugin-workspace-page p-6 space-y-6 max-w-5xl mx-auto text-slate-800 dark:text-slate-100 font-sans">
      <div className="flex items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Award className="w-6 h-6 text-amber-500" />
            <span>黄金三章开篇文本诊断 (GoldChaptersEval)</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            本地检索列出词项与原文位置，AI 点评须提供可核对的原文引用。不预测签约、订阅或读者反应。
          </p>
          <ScoreProvenanceBadge
            source="rule"
            detail="本地词表只用于定位线索；不使用签约、订阅或真实读者数据"
          />
        </div>

        {hostContext?.aiAssistant?.isAvailable && (
          <button
            disabled={aiTask.isRunning || !chaptersText.trim()}
            onClick={handleAiGoldAudit}
            className="px-3.5 py-1.5 bg-[var(--ink-accent)] hover:opacity-90 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Bot className="w-3.5 h-3.5" />
            AI 开篇点评
          </button>
        )}
        <PluginAiTaskPanel view={reviewView} onRetry={handleAiGoldAudit} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border rounded-xl p-5 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <label
              htmlFor="gold-opening-text"
              className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"
            >
              <BookOpen className="w-3.5 h-3.5" />
              待分析文本（初次从前三章读取）：
            </label>
            <span className="text-[11px] text-slate-400">{chaptersText.length} 字</span>
          </div>
          <textarea
            id="gold-opening-text"
            className="w-full h-64 p-3 text-xs border rounded font-serif bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800 leading-relaxed focus:outline-none"
            value={chaptersText}
            placeholder="自动从项目前三章提取正文，亦可手动编辑..."
            onChange={(e) => setChaptersText(e.target.value)}
          />
          <button
            onClick={handleSave}
            disabled={!chaptersText.trim() || saving}
            aria-busy={saving}
            className="px-4 py-2 bg-[var(--ink-accent)] hover:bg-[var(--ink-accent-hover)] text-white rounded text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Send className="w-4 h-4" /> {saving ? '保存中…' : '保存文本线索快照'}
          </button>
          {saveError && <p role="alert">文本线索快照保存失败：{saveError}；可重试保存。</p>}
        </div>

        <div className="border rounded-xl p-5 bg-slate-900 text-slate-100 border-amber-900/60 space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-amber-400">开篇文本线索</h3>
          <GoldChaptersEvidence snapshot={currentEval} />
        </div>
      </div>

      {evaluations.length > 0 && (
        <div className="border-t pt-4 border-slate-200 dark:border-slate-800">
          <ScoreProvenanceBadge source="historical" detail="来自已存盘的历史评估快照" />
          <div className="text-xs font-bold text-slate-400 mb-2">
            历史分析快照 ({evaluations.length})
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {evaluations.map((e) => (
              <div
                key={e.id}
                className="p-3 bg-slate-100 dark:bg-slate-800 rounded min-w-[140px] text-xs space-y-1"
              >
                {e.observationSnapshot ? (
                  <GoldChaptersEvidence snapshot={e.observationSnapshot} />
                ) : (
                  <div>旧版规则分：{e.score ?? '未记录'}（未经质量校准）</div>
                )}
                <div className="text-[10px] text-slate-400">
                  {new Date(e.evaluatedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
