import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { RhythmMetronomeEngine } from '../engine/RhythmMetronomeEngine'
import type { RhythmCadenceRecord } from '../../../ports/rhythmCadenceRepository'
import {
  projectChapterSequence,
  latestPositionedChapterNumber,
  type PositionedChapter,
} from '../../../domain/chapter/chapterSequence'
import { indexedDbRhythmCadenceRepository } from '../../../adapters/indexedDbRhythmCadenceRepository'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { semanticTextFromContent } from '../../../domain/content'
import { clock } from '../../../adapters/clock'

export const RhythmMetronomeMasterView: FC<DesktopPluginViewProps> = (props) => (
  <RhythmMetronomeProjectView key={props.projectId} {...props} />
)

const RhythmMetronomeProjectView: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const [config, setConfig] = useState<RhythmCadenceRecord | null>(null)
  const [chapters, setChapters] = useState<PositionedChapter[]>([])
  const [stagnantInput, setStagnantInput] = useState(0)
  const [message, setMessage] = useState('正在读取保存章节…')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let disposed = false
    Promise.all([
      indexedDbRhythmCadenceRepository.get(projectId),
      indexedDbProjectRepository.getChaptersByProject(projectId),
      indexedDbProjectRepository.getVolumesByProject(projectId),
    ])
      .then(([existing, records, volumes]) => {
        if (disposed) return
        setChapters(projectChapterSequence(projectId, records, volumes))
        setConfig(
          existing ?? {
            projectId,
            microCycleLength: 3,
            mesoCycleLength: 15,
            macroCycleLength: 50,
            currentMicroStep: 0,
            currentMesoStep: 0,
            currentMacroStep: 0,
            stagnationChapterCount: 0,
            autoDetectEnabled: false,
            updatedAt: clock.now(),
          },
        )
        setStagnantInput(existing?.stagnationChapterCount ?? 0)
        setMessage('')
      })
      .catch(() => {
        if (!disposed) setMessage('读取节律配置或章节失败。')
      })
    return () => {
      disposed = true
    }
  }, [projectId])

  const reports = chapters.map((chapter) => {
    const text = semanticTextFromContent(chapter.id, chapter.content, chapter.revision ?? 0)
    return {
      chapter,
      characters: Array.from(text).length,
      report: RhythmMetronomeEngine.analyzeText(text),
    }
  })
  let beats: ReturnType<typeof RhythmMetronomeEngine.calculateBeats> | null = null
  let report: ReturnType<typeof RhythmMetronomeEngine.diagnoseStagnation> | null = null
  let validationError = ''
  try {
    beats = RhythmMetronomeEngine.calculateBeats(
      latestPositionedChapterNumber(chapters),
      config ?? undefined,
    )
    report = RhythmMetronomeEngine.diagnoseStagnation(
      stagnantInput,
      reports.map((item) => item.characters),
    )
  } catch (error) {
    validationError = error instanceof Error ? error.message : '参数无效。'
  }
  const period = RhythmMetronomeEngine.computeAutocorrelationPeriod(
    reports.filter((item) => item.chapter.chapterNumber !== null).map((item) => item.characters),
  )

  const save = async () => {
    if (!config || !beats || validationError) return
    setSaving(true)
    try {
      await indexedDbRhythmCadenceRepository.save({
        ...config,
        currentMicroStep: beats.micro.currentStep,
        currentMesoStep: beats.meso.currentStep,
        currentMacroStep: beats.macro.currentStep,
        stagnationChapterCount: stagnantInput,
        updatedAt: clock.now(),
      })
      setMessage('节律配置已保存。')
    } catch {
      setMessage('保存节律配置失败，可以重试。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-5 overflow-y-auto text-[var(--ink-text)]">
      <h2 className="text-xl font-bold">句长统计与章节节律计划</h2>
      <p className="text-sm text-[var(--ink-text-muted)]">
        统计当前保存版本的标点、句长和分段。章节周期是可调整的作者计划；3、15、50 只是初始示例。
      </p>
      <p>
        已挂卷 {latestPositionedChapterNumber(chapters)} 章；未挂卷{' '}
        {chapters.filter((chapter) => chapter.chapterNumber === null).length} 条文本。
      </p>
      <p role="status">{message}</p>
      {validationError && <p role="alert">{validationError}</p>}
      <div className="flex flex-wrap gap-4">
        {(['micro', 'meso', 'macro'] as const).map((type) => (
          <label key={type} className="space-x-2">
            {type === 'micro' ? '短' : type === 'meso' ? '中' : '长'}周期章数
            <input
              aria-label={type + '周期章数'}
              type="number"
              min={1}
              value={config?.[(type + 'CycleLength') as 'microCycleLength'] ?? ''}
              onChange={(event) =>
                setConfig(
                  (current) =>
                    current && { ...current, [type + 'CycleLength']: Number(event.target.value) },
                )
              }
              className="w-20 border rounded p-1 bg-[var(--ink-bg-panel)]"
            />
          </label>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {beats &&
          Object.values(beats).map((beat) => (
            <div key={beat.cycleType} className="p-3 border rounded">
              <h3>{beat.cycleName}</h3>
              <p>
                第 {beat.currentStep} / {beat.totalSteps} 步，{beat.progressPct}%
              </p>
              <p>{beat.phaseDescription}</p>
              <p className="text-xs">{beat.recommendedAction}</p>
            </div>
          ))}
      </div>
      <label className="flex gap-2 items-center">
        作者标注连续未推进章数
        <input
          aria-label="作者标注连续未推进章数"
          type="number"
          min={0}
          value={stagnantInput}
          onChange={(event) => setStagnantInput(Number(event.target.value))}
          className="w-20 border rounded p-1 bg-[var(--ink-bg-panel)]"
        />
      </label>
      {report && (
        <div className="space-y-2 text-sm">
          <p>{report.diagnostic}</p>
          <p>
            篇幅样本：{report.sampleCount} 章；平均 {report.averageCharacters?.toFixed(1) ?? '未知'}{' '}
            字符；变异系数 {report.coefficientOfVariation?.toFixed(3) ?? '未知'}。
          </p>
          <p>
            篇幅自相关候选间隔：{period === null ? '证据不足' : period + ' 章'}
            。它不代表文学节奏或经过验证的创作周期。
          </p>
        </div>
      )}
      <button
        onClick={() => void save()}
        disabled={!config || saving || Boolean(validationError)}
        className="px-3 py-2 rounded bg-amber-600 text-white disabled:opacity-50"
      >
        {saving ? '正在保存…' : '保存节律配置'}
      </button>
      <div className="space-y-3" aria-label="保存章节的实际句长统计">
        {reports.length === 0 && <p>没有保存章节，无法统计。</p>}
        {reports.map(({ chapter, characters, report: textReport }) => (
          <section key={chapter.id} className="p-3 border rounded">
            <h3>
              {chapter.title}（保存版本 {chapter.revision ?? 0}）
            </h3>
            <p>
              {characters} 字符；{textReport.paragraphCount} 段；{textReport.sentenceCount}{' '}
              个标点分句；平均句长 {textReport.averageSentenceCharacters?.toFixed(1) ?? '未知'}。
            </p>
            <p>
              逗号 {textReport.punctuation.comma}；句号 {textReport.punctuation.fullStop}；问号{' '}
              {textReport.punctuation.question}；感叹号 {textReport.punctuation.exclamation}。
            </p>
            <details>
              <summary>查看原文句长与位置</summary>
              {textReport.sentences.map((sentence) => (
                <p key={sentence.start}>
                  {sentence.characters} 字符，原文 [{sentence.start}, {sentence.end})：
                  {sentence.quote}
                </p>
              ))}
            </details>
          </section>
        ))}
      </div>
    </div>
  )
}
