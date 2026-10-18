import { useEffect, useMemo, useState, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { EmotionCurveEngine, EMOTION_TYPES } from '../engine/EmotionCurveEngine'
import type { AuthorEmotionAnnotation, EmotionType } from '../types'
import type { EmotionAuditRecord } from '../../../ports/emotionAuditRepository'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { indexedDbEmotionAuditRepository } from '../../../adapters/indexedDbEmotionAuditRepository'
import { semanticTextFromContent } from '../../../domain/content'
import {
  projectChapterSequence,
  type PositionedChapter,
} from '../../../domain/chapter/chapterSequence'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { usePluginAiTask } from '../../../core/usePluginAiTask'
import { PluginAiTaskPanel } from '../../../components/plugins/PluginAiTaskPanel'
import { Select } from '../../../ui/primitives'
const LABELS: Record<EmotionType, string> = {
  tension: '紧张',
  catharsis: '释放',
  frustration: '受挫',
  anticipation: '期待',
  sorrow: '悲伤',
  joy: '喜悦',
}
export const EmotionCurveMasterView: FC<DesktopPluginViewProps> = (props) => (
  <EmotionWorkspace key={props.projectId} {...props} />
)
function EmotionWorkspace({ projectId }: DesktopPluginViewProps) {
  const host = useOptionalPluginHostContext()
  const [chapters, setChapters] = useState<PositionedChapter[]>([])
  const [records, setRecords] = useState<EmotionAuditRecord[]>([])
  const [selected, setSelected] = useState('')
  const [values, setValues] = useState<Partial<Record<EmotionType, string>>>({})
  const [note, setNote] = useState('')
  const [quote, setQuote] = useState('')
  const [quoteStart, setQuoteStart] = useState('')
  const [dimension, setDimension] = useState<EmotionType>('tension')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reload, setReload] = useState(0)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => {
    let disposed = false
    setLoading(true)
    setError('')
    Promise.all([
      indexedDbProjectRepository.getChaptersByProject(projectId),
      indexedDbProjectRepository.getVolumesByProject(projectId),
      indexedDbEmotionAuditRepository.getAll(projectId),
    ])
      .then(([all, volumes, snapshots]) => {
        if (disposed) return
        const ordered = projectChapterSequence(projectId, all, volumes)
        setChapters(ordered)
        setRecords(snapshots.filter((r) => r.projectId === projectId))
        setSelected((previous) =>
          ordered.some((c) => c.id === previous) ? previous : (ordered[0]?.id ?? ''),
        )
      })
      .catch((cause) => {
        if (!disposed) setError(String(cause))
      })
      .finally(() => {
        if (!disposed) setLoading(false)
      })
    return () => {
      disposed = true
    }
  }, [projectId, reload])
  const evaluations = useMemo(
    () =>
      chapters.map((c) => {
        const text = semanticTextFromContent(c.id, c.content, c.revision)
        const snapshot = records
          .filter(
            (r) =>
              r.chapterId === c.id &&
              r.annotation &&
              r.sourceText === text &&
              (r.sourceRevision === undefined || r.sourceRevision === c.revision),
          )
          .sort((a, b) => b.updatedAt - a.updatedAt)[0]
        try {
          return EmotionCurveEngine.evaluateChapter({
            chapterId: c.id,
            chapterTitle: c.title,
            chapterOrder: c.chapterNumber,
            content: text,
            annotation: snapshot?.annotation,
          })
        } catch (cause) {
          return {
            ...EmotionCurveEngine.evaluateChapter({
              chapterId: c.id,
              chapterTitle: c.title,
              chapterOrder: c.chapterNumber,
              content: text,
            }),
            annotationError: String(cause),
          }
        }
      }),
    [chapters, records],
  )
  const selectedChapter = chapters.find((c) => c.id === selected)
  const text = selectedChapter
    ? semanticTextFromContent(selectedChapter.id, selectedChapter.content, selectedChapter.revision)
    : ''
  const report = evaluations.find((e) => e.chapterId === selected)
  const ai = usePluginAiTask('emotion-curve', [
    projectId,
    chapters,
    records,
    selected,
    values,
    note,
    quote,
    quoteStart,
  ])
  const save = async () => {
    if (!selectedChapter) return
    setError('')
    setMessage('')
    setSaving(true)
    try {
      const annotationValues = Object.fromEntries(
        EMOTION_TYPES.filter((t) => values[t] !== undefined && values[t] !== '').map((t) => [
          t,
          Number(values[t]),
        ]),
      )
      const first = text.indexOf(quote)
      if (quoteStart === '' && quote && text.indexOf(quote, first + 1) >= 0)
        throw new Error('引用出现多次，请填写所选原文的 UTF-16 起点。')
      const start = quoteStart === '' ? first : Number(quoteStart)
      const annotation: AuthorEmotionAnnotation = {
        values: annotationValues,
        note,
        quote,
        start,
        end: start + quote.length,
      }
      const evaluated = EmotionCurveEngine.evaluateChapter({
        chapterId: selectedChapter.id,
        chapterTitle: selectedChapter.title,
        chapterOrder: selectedChapter.chapterNumber,
        content: text,
        annotation,
      })
      const record: EmotionAuditRecord = {
        id: idGenerator.generate('ea'),
        projectId,
        chapterId: selectedChapter.id,
        chapterTitle: selectedChapter.title,
        chapterOrder: selectedChapter.chapterNumber,
        wordCount: evaluated.wordCount,
        annotation: evaluated.annotation,
        sourceText: text,
        sourceRevision: selectedChapter.revision,
        matches: evaluated.matches,
        updatedAt: clock.now(),
      }
      await indexedDbEmotionAuditRepository.save(record)
      setRecords((previous) => [...previous, record])
      setMessage('已保存作者标注和原文快照。')
    } catch (cause) {
      setError(String(cause))
    } finally {
      setSaving(false)
    }
  }
  const known = evaluations.filter((e) => e.chapterOrder !== null)
  const maxOrder = Math.max(1, ...known.map((e) => e.chapterOrder!))
  const chartSegments: Array<Array<{ x: number; y: number; order: number; value: number }>> = []
  let segment: Array<{ x: number; y: number; order: number; value: number }> = []
  let previous: number | undefined
  for (const evaluation of known) {
    const value = evaluation.annotation?.values[dimension]
    if (
      value === undefined ||
      (previous !== undefined && evaluation.chapterOrder !== previous + 1)
    ) {
      if (segment.length) chartSegments.push(segment)
      segment = []
    }
    if (value !== undefined)
      segment.push({
        x: 20 + ((evaluation.chapterOrder! - 1) / Math.max(1, maxOrder - 1)) * 560,
        y: 120 - value,
        order: evaluation.chapterOrder!,
        value,
      })
    previous = evaluation.chapterOrder!
  }
  if (segment.length) chartSegments.push(segment)
  return (
    <div className="p-6 space-y-4 h-full overflow-y-auto">
      <h2>作者情绪标注曲线</h2>
      <p>
        0 至 100
        是作者自定的叙事情绪意图，不能解释为读者实测情绪。未填写维度保持未知，旧词表分数不作为标注。
      </p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <button disabled={loading} onClick={() => setReload((n) => n + 1)}>
        刷新保存章节
      </button>
      <Select
        aria-label="曲线维度"
        value={dimension}
        onValueChange={(value) => setDimension(value as EmotionType)}
      >
        {EMOTION_TYPES.map((t) => (
          <option key={t} value={t}>
            {LABELS[t]}
          </option>
        ))}
      </Select>
      <svg
        viewBox="0 0 600 150"
        role="img"
        aria-label="作者标注曲线，未标注位置不连线"
        className="w-full max-h-48 border rounded"
      >
        <path d="M20 20 V120 H580" fill="none" stroke="currentColor" />
        {chartSegments.map((points, index) => (
          <g key={index}>
            <polyline
              points={points.map((p) => p.x + ',' + p.y).join(' ')}
              fill="none"
              stroke="var(--ink-accent)"
              strokeWidth="2"
            />
            {points.map((p) => (
              <circle key={p.order} cx={p.x} cy={p.y} r="3" fill="currentColor">
                <title>
                  第 {p.order} 章，作者标注 {p.value}
                </title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
      <p>按实际全书章序排列；未标注与位置未知的章节不连线。</p>
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th>保存章节</th>
            {EMOTION_TYPES.map((t) => (
              <th key={t}>{LABELS[t]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {evaluations.map((e) => (
            <tr key={e.chapterId}>
              <td>
                {e.chapterOrder ? '第 ' + e.chapterOrder + ' 章' : '位置未知'} · {e.chapterTitle}
              </td>
              {EMOTION_TYPES.map((t) => (
                <td key={t}>{e.annotation?.values[t] ?? '未知'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {loading ? (
        <p role="status">正在读取章节与作者标注…</p>
      ) : !chapters.length ? (
        <p>项目中尚无保存章节。</p>
      ) : (
        <>
          <Select
            aria-label="标注章节"
            value={selected}
            onValueChange={(id) => {
              setSelected(id)
              setValues({})
              setQuote('')
              setQuoteStart('')
              setNote('')
              setMessage('')
            }}
          >
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
          <blockquote className="whitespace-pre-wrap">{text}</blockquote>
          {'annotationError' in (report ?? {}) && <p role="alert">保存标注无效，请重新标注。</p>}
          <p>字面词项候选，不证明情绪：</p>
          {report?.matches.map((m) => (
            <p key={m.type + ':' + m.start}>
              [{m.start}, {m.end})「{m.quote}」
            </p>
          ))}
          {EMOTION_TYPES.map((t) => (
            <label key={t}>
              {LABELS[t]}
              <input
                aria-label={'作者' + LABELS[t] + '标注'}
                type="number"
                min="0"
                max="100"
                value={values[t] ?? ''}
                onChange={(e) => setValues((previous) => ({ ...previous, [t]: e.target.value }))}
              />
            </label>
          ))}
          <textarea
            aria-label="作者标注说明"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="解释人物情境或作者意图"
          />
          <input
            aria-label="标注原文引用"
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            placeholder="粘贴当前章节中的原文"
          />
          <input
            aria-label="原文引用起点"
            value={quoteStart}
            type="number"
            min="0"
            onChange={(e) => setQuoteStart(e.target.value)}
            placeholder="重复引用时填写位置"
          />
          <button disabled={saving} onClick={save}>
            保存作者情绪标注
          </button>
        </>
      )}
      {host?.aiAssistant?.isAvailable && (
        <button
          disabled={ai.isRunning || !chapters.length}
          onClick={() =>
            ai.run({
              chapterSources: chapters.map((c) => ({
                id: c.id,
                chapterNumber: c.chapterNumber,
                text: semanticTextFromContent(c.id, c.content, c.revision),
              })),
              authorAnnotations: evaluations.map((e) => ({
                chapterId: e.chapterId,
                chapterNumber: e.chapterOrder,
                annotation: e.annotation ?? null,
              })),
            })
          }
        >
          AI 标注与过渡复核
        </button>
      )}
      <PluginAiTaskPanel view={ai.view} onRetry={ai.retry} />
      {records.some(
        (r) =>
          !r.annotation ||
          !chapters.some(
            (c) =>
              c.id === r.chapterId &&
              r.sourceText === semanticTextFromContent(c.id, c.content, c.revision),
          ),
      ) && <p>保留了旧公式或旧原文记录；它们不参与当前曲线。</p>}
    </div>
  )
}
