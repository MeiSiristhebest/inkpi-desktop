import { useEffect, useMemo, useRef, useState, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import type { VolumeArcRecord, ActStage } from '../types'
import type { ChapterRecord, VolumeRecord } from '../../../types'
import { volumeMasterEngine } from '../engine/VolumeMasterEngine'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { indexedDbVolumeArcRepository } from '../../../adapters/indexedDbVolumeArcRepository'
import { indexedDbEmotionAuditRepository } from '../../../adapters/indexedDbEmotionAuditRepository'
import type { EmotionAuditRecord } from '../../../ports/emotionAuditRepository'
import { semanticTextFromContent } from '../../../domain/content'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { usePluginAiTask } from '../../../core/usePluginAiTask'
import { PluginAiTaskPanel } from '../../../components/plugins/PluginAiTaskPanel'
import { Select } from '../../../ui/primitives'
export const VolumeMasterMasterView: FC<DesktopPluginViewProps> = (props) => (
  <VolumeWorkspace key={props.projectId} {...props} />
)
function VolumeWorkspace({ projectId }: DesktopPluginViewProps) {
  const host = useOptionalPluginHostContext()
  const [volumes, setVolumes] = useState<VolumeRecord[]>([])
  const [chapters, setChapters] = useState<ChapterRecord[]>([])
  const [arcs, setArcs] = useState<VolumeArcRecord[]>([])
  const [emotionRecords, setEmotionRecords] = useState<EmotionAuditRecord[]>([])
  const [selected, setSelected] = useState('')
  const [draft, setDraft] = useState<Partial<VolumeArcRecord>>({})
  const [target, setTarget] = useState('')
  const [reload, setReload] = useState(0)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const fill = (id: string, records: VolumeArcRecord[]) => {
    const previous = records.find((a) => a.volumeId === id)
    setSelected(id)
    setDraft(previous ? { ...previous } : {})
    setTarget(previous?.targetWordCount === undefined ? '' : String(previous.targetWordCount))
  }
  useEffect(() => {
    let disposed = false
    Promise.all([
      indexedDbProjectRepository.getVolumesByProject(projectId),
      indexedDbProjectRepository.getChaptersByProject(projectId),
      indexedDbVolumeArcRepository.getAll(projectId),
      indexedDbEmotionAuditRepository.getAll(projectId),
    ])
      .then(([allVolumes, allChapters, allArcs, emotions]) => {
        if (disposed) return
        const own = allVolumes
          .filter((v) => v.projectId === projectId)
          .sort((a, b) => a.order - b.order)
        const ownArcs = allArcs.filter((a) => a.projectId === projectId)
        setVolumes(own)
        setChapters(allChapters.filter((c) => c.projectId === projectId))
        setArcs(ownArcs)
        setEmotionRecords(emotions.filter((e) => e.projectId === projectId))
        fill(own.some((v) => v.id === selected) ? selected : (own[0]?.id ?? ''), ownArcs)
      })
      .catch((cause) => {
        if (!disposed) setError(String(cause))
      })
    return () => {
      disposed = true
    }
  }, [projectId, reload])
  const measured = useMemo(
    () =>
      chapters.map((c) => {
        const text = semanticTextFromContent(c.id, c.content, c.revision)
        const marked = emotionRecords
          .filter(
            (e) =>
              e.chapterId === c.id &&
              e.sourceText === text &&
              (e.sourceRevision === undefined || e.sourceRevision === c.revision) &&
              e.annotation,
          )
          .sort((a, b) => b.updatedAt - a.updatedAt)[0]
        return {
          id: c.id,
          volumeId: c.volumeId,
          order: c.order,
          wordCount: Array.from(text.replace(/\s/g, '')).length,
          tension: marked?.annotation?.values.tension,
          text,
          revision: c.revision,
        }
      }),
    [chapters, emotionRecords],
  )
  let metrics: ReturnType<typeof volumeMasterEngine.aggregateBookMetrics> | null = null,
    stats: ReturnType<typeof volumeMasterEngine.calculateVolumeStat>[] = [],
    calculationError = ''
  try {
    metrics = volumeMasterEngine.aggregateBookMetrics(volumes, measured, arcs)
    stats = volumes.map((v) =>
      volumeMasterEngine.calculateVolumeStat(
        v,
        measured,
        arcs.find((a) => a.volumeId === v.id),
      ),
    )
  } catch (cause) {
    calculationError = String(cause)
  }
  const volume = volumes.find((v) => v.id === selected)
  const semanticPlan = {
    ...draft,
    coreConflict: semanticTextFromContent(`${selected}-conflict`, draft.coreConflict ?? ''),
    climaxNode: semanticTextFromContent(`${selected}-climax`, draft.climaxNode ?? ''),
    rewardOutcome: semanticTextFromContent(`${selected}-outcome`, draft.rewardOutcome ?? ''),
    crossVolumeCliffhanger: semanticTextFromContent(
      `${selected}-cliffhanger`,
      draft.crossVolumeCliffhanger ?? '',
    ),
    constraints:
      draft.constraints === undefined
        ? undefined
        : semanticTextFromContent(`${selected}-constraints`, draft.constraints),
  }
  const ai = usePluginAiTask('volume-master', [projectId, volume, draft, target, measured])
  const editingScope = JSON.stringify([selected, draft, target])
  const editingScopeRef = useRef(editingScope)
  editingScopeRef.current = editingScope
  const save = async () => {
    const submittedScope = editingScope
    if (!volume) return
    setError('')
    setMessage('')
    setBusy(true)
    try {
      if (target !== '' && (!Number.isSafeInteger(Number(target)) || Number(target) <= 0))
        throw new Error('分卷预算须为正整数；没有计划时留空。')
      const previous = arcs.find((a) => a.volumeId === volume.id)
      const record: VolumeArcRecord = {
        id: previous?.id ?? idGenerator.generate('arc'),
        projectId,
        volumeId: volume.id,
        volumeTitle: volume.title,
        volumeOrder: volume.order,
        targetWordCount: target === '' ? undefined : Number(target),
        actStage: draft.actStage,
        isCompleted: draft.isCompleted ?? false,
        coreConflict: draft.coreConflict ?? '',
        climaxNode: draft.climaxNode ?? '',
        rewardOutcome: draft.rewardOutcome ?? '',
        crossVolumeCliffhanger: draft.crossVolumeCliffhanger ?? '',
        constraints: draft.constraints ?? '',
        updatedAt: clock.now(),
      }
      await indexedDbVolumeArcRepository.save(record)
      setArcs((current) => [...current.filter((a) => a.id !== record.id), record])
      if (editingScopeRef.current === submittedScope) setDraft(record)
      setMessage(
        editingScopeRef.current === submittedScope
          ? '规划已保存。'
          : '已保存先前规划快照；后续编辑仍未保存。',
      )
    } catch (cause) {
      setError(String(cause))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="plugin-workspace-page p-6 space-y-4 h-full overflow-y-auto">
      <h2>分卷目标与实际篇幅</h2>
      <p>
        统计保存正文的非空白 Unicode
        字符；预算、阶段和完成状态由作者登记。拟合只描述有原文依据的作者紧张标注，不是剧情质量评分。
      </p>
      <p>来源：作者登记预算与张力标注的本地统计和 OLS 拟合。</p>
      {error && <p role="alert">{error}</p>}
      {calculationError && <p role="alert">{calculationError}</p>}
      {message && <p role="status">{message}</p>}
      <button onClick={() => setReload((n) => n + 1)}>刷新保存稿与规划</button>
      {metrics && (
        <p>
          保存稿 {metrics.totalWordCount ?? '计数未知'} 字符，{metrics.totalVolumes} 卷、
          {metrics.totalChapters} 个章节；作者计划总量{' '}
          {metrics.projectedTotalWords ?? '尚未全部填写'}。
        </p>
      )}
      {stats.map((stat) => (
        <article key={stat.volumeId} className="border rounded p-3">
          <h3>{stat.title}</h3>
          <p>
            实际 {stat.actualWordCount ?? '未知'} / 作者预算 {stat.targetWordCount ?? '未登记'}
            ；阶段{' '}
            {stat.currentAct ? volumeMasterEngine.getActStageInfo(stat.currentAct).label : '未登记'}
            。
          </p>
          <p>{stat.advice}</p>
          {stat.arcRegression ? (
            <p>
              作者标注样本 {stat.arcRegression.sampleCount} 个；二次拟合 R²{' '}
              {stat.arcRegression.r2 === null
                ? '常量序列，不定义'
                : stat.arcRegression.r2.toFixed(3)}
              ；样本范围内极大值位置{' '}
              {stat.arcRegression.apexRatio === null
                ? '不存在'
                : stat.arcRegression.apexRatio.toFixed(3)}
              。
            </p>
          ) : (
            <p>没有足够的有效作者标注，未拟合曲线。</p>
          )}
        </article>
      ))}
      <Select
        aria-label="规划分卷"
        value={selected}
        onValueChange={(id) => {
          fill(id, arcs)
          setMessage('')
        }}
      >
        {volumes.map((v) => (
          <option key={v.id} value={v.id}>
            {v.title}
          </option>
        ))}
      </Select>
      <label>
        作者字符预算
        <input
          aria-label="分卷字符预算"
          type="number"
          min="1"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        />
      </label>
      <Select
        aria-label="作者剧情阶段"
        value={draft.actStage ?? ''}
        onValueChange={(value) =>
          setDraft((previous) => ({
            ...previous,
            actStage: value ? (value as ActStage) : undefined,
          }))
        }
      >
        <option value="">尚未登记</option>
        {(['act1_intro', 'act2_rising', 'act3_climax', 'act4_fallout'] as ActStage[]).map(
          (stage) => (
            <option key={stage} value={stage}>
              {volumeMasterEngine.getActStageInfo(stage).label}
            </option>
          ),
        )}
      </Select>
      {(
        [
          ['coreConflict', '分卷目标与冲突'],
          ['climaxNode', '关键选择节点'],
          ['rewardOutcome', '后果与状态变化'],
          ['crossVolumeCliffhanger', '跨卷承接'],
          ['constraints', '作者约束'],
        ] as const
      ).map(([field, label]) => (
        <textarea
          key={field}
          aria-label={label}
          value={draft[field] ?? ''}
          onChange={(e) => setDraft((previous) => ({ ...previous, [field]: e.target.value }))}
          placeholder={label}
          className="w-full border rounded p-2"
        />
      ))}
      <label>
        作者确认本卷完成
        <input
          type="checkbox"
          checked={draft.isCompleted ?? false}
          onChange={(e) => setDraft((previous) => ({ ...previous, isCompleted: e.target.checked }))}
        />
      </label>
      <button data-variant="primary" disabled={busy || !volume} onClick={save}>
        保存分卷规划
      </button>
      {host?.aiAssistant?.isAvailable && (
        <button
          disabled={ai.isRunning || !volume}
          onClick={() =>
            ai.run({
              volume,
              authorPlan: {
                ...semanticPlan,
                targetWordCount: target === '' ? null : Number(target),
              },
              chapterSources: measured
                .filter((c) => c.volumeId === selected)
                .map((c) => ({
                  id: c.id,
                  volumeChapterOrder: c.order,
                  revision: c.revision,
                  text: c.text,
                  authorTension: c.tension ?? null,
                })),
            })
          }
        >
          AI 分卷目标与承接复核
        </button>
      )}
      <PluginAiTaskPanel view={ai.view} onRetry={ai.retry} />
    </div>
  )
}
