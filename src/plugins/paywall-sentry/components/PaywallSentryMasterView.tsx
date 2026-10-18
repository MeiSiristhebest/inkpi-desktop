import { useEffect, useMemo, useState, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import type { PaywallAuditResult } from '../types'
import { PaywallSentryEngine } from '../engine/PaywallSentryEngine'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { indexedDbPaywallAuditRepository } from '../../../adapters/indexedDbPaywallAuditRepository'
import { semanticTextFromContent } from '../../../domain/content'
import {
  projectChapterSequence,
  type PositionedChapter,
} from '../../../domain/chapter/chapterSequence'
import { idGenerator } from '../../../adapters/idGenerator'
import { clock } from '../../../adapters/clock'
import { EndingEvidence } from '../../../components/plugins/EndingEvidence'
import { PluginAiTaskPanel } from '../../../components/plugins/PluginAiTaskPanel'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { usePluginAiTask } from '../../../core/usePluginAiTask'
import { Select } from '../../../ui/primitives'
export const PaywallSentryMasterView: FC<DesktopPluginViewProps> = (props) => (
  <PaywallWorkspace key={props.projectId} {...props} />
)
function PaywallWorkspace({ projectId }: DesktopPluginViewProps) {
  const host = useOptionalPluginHostContext()
  const [chapters, setChapters] = useState<PositionedChapter[]>([])
  const [reload, setReload] = useState(0)
  const [selected, setSelected] = useState('')
  const [reached, setReached] = useState('')
  const [paid, setPaid] = useState('')
  const [measurementSource, setMeasurementSource] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const reports = useMemo(
    () =>
      chapters.map((c) =>
        PaywallSentryEngine.analyzeChapter({
          chapterId: c.id,
          chapterTitle: c.title,
          chapterOrder: c.chapterNumber,
          content: semanticTextFromContent(c.id, c.content, c.revision),
        }),
      ),
    [chapters],
  )
  const ai = usePluginAiTask('paywall-sentry', [
    projectId,
    chapters,
    selected,
    reached,
    paid,
    measurementSource,
  ])
  useEffect(() => {
    let disposed = false
    setLoading(true)
    setError('')
    Promise.all([
      indexedDbProjectRepository.getChaptersByProject(projectId),
      indexedDbProjectRepository.getVolumesByProject(projectId),
    ])
      .then(([all, volumes]) => {
        if (disposed) return
        const ordered = projectChapterSequence(projectId, all, volumes)
        setChapters(ordered)
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
  let measurement: { reached: number; paid: number; rate: number | null } | undefined
  let measurementError = ''
  if (reached !== '' || paid !== '') {
    try {
      if (reached === '' || paid === '' || !measurementSource.trim())
        throw new Error('填写同一章、同一观察时期的两个计数及数据来源。')
      measurement = PaywallSentryEngine.observedConversion({
        reached: Number(reached),
        paid: Number(paid),
      })
    } catch (cause) {
      measurementError = String(cause)
    }
  }
  const save = async (report: PaywallAuditResult) => {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const c = chapters.find((item) => item.id === report.chapterId)!
      await indexedDbPaywallAuditRepository.save({
        id: idGenerator.generate('pwa'),
        projectId,
        chapterId: c.id,
        chapterTitle: c.title,
        chapterOrder: c.chapterNumber,
        wordCount: report.wordCount,
        ending: report.ending,
        sourceRevision: c.revision,
        measurement:
          report.chapterId === selected && measurement
            ? { ...measurement, source: measurementSource }
            : undefined,
        suggestions: [],
        updatedAt: clock.now(),
      })
      setMessage('已保存章尾和观察数据快照。')
    } catch (cause) {
      setError(String(cause))
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="p-6 space-y-4 h-full overflow-y-auto">
      <h2>付费过渡章尾复核</h2>
      <p>章尾观察与实测付费计数分别展示。文本不产生付费潜力评分或转化预测。</p>
      <p>来源：作者登记的章尾观察和同一观察期的实测付费计数。</p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <button onClick={() => setReload((n) => n + 1)} disabled={loading}>
        重新扫描
      </button>
      <Select
        aria-label="观察数据所属章节"
        value={selected}
        onValueChange={(value) => {
          setSelected(value)
          setReached('')
          setPaid('')
          setMeasurementSource('')
        }}
      >
        {chapters.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </Select>
      <label>
        观察人数
        <input
          aria-label="观察人数"
          type="number"
          min="0"
          value={reached}
          onChange={(e) => setReached(e.target.value)}
        />
      </label>
      <label>
        付费人数
        <input
          aria-label="付费人数"
          type="number"
          min="0"
          value={paid}
          onChange={(e) => setPaid(e.target.value)}
        />
      </label>
      <input
        aria-label="观察时期与数据来源"
        value={measurementSource}
        onChange={(e) => setMeasurementSource(e.target.value)}
        placeholder="平台、时期和统计口径"
      />
      {measurementError && <p role="alert">{measurementError}</p>}
      {measurement && (
        <p>
          实测比例：
          {measurement.rate === null
            ? '无人观察，比例未知'
            : (measurement.rate * 100).toFixed(2) + '%'}
          。这些计数不能证明章尾导致付费。
        </p>
      )}
      {host?.aiAssistant?.isAvailable && (
        <button
          disabled={ai.isRunning || !chapters.length}
          onClick={() =>
            ai.run({
              chapterSources: chapters.map((c) => ({
                id: c.id,
                chapterNumber: c.chapterNumber,
                revision: c.revision,
                text: semanticTextFromContent(c.id, c.content, c.revision),
              })),
              measuredCounts: measurement
                ? { chapterId: selected, ...measurement, source: measurementSource }
                : null,
            })
          }
        >
          AI 章尾文本复核
        </button>
      )}
      <PluginAiTaskPanel view={ai.view} onRetry={ai.retry} />
      {loading ? (
        <p role="status">正在读取保存章节…</p>
      ) : !reports.length ? (
        <p>尚无保存章节。</p>
      ) : (
        reports.map((report) => (
          <article key={report.chapterId} className="border rounded p-3 space-y-2">
            <h3>
              {report.chapterOrder ? '第 ' + report.chapterOrder + ' 章' : '位置未知'}：
              {report.chapterTitle}
            </h3>
            <EndingEvidence report={report.ending} />
            <button
              disabled={saving || (report.chapterId === selected && Boolean(measurementError))}
              onClick={() => save(report)}
            >
              保存卡点快照
            </button>
          </article>
        ))
      )}
    </div>
  )
}
