import { useMemo, useState, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { indexedDbRhythmRadarRepository } from '../../../adapters/indexedDbRhythmRadarRepository'
import { RhythmRadarEngine } from '../engine/RhythmRadarEngine'
import { EndingEvidence } from '../../../components/plugins/EndingEvidence'
import { idGenerator } from '../../../adapters/idGenerator'
import { clock } from '../../../adapters/clock'
export const RhythmRadarMasterView: FC<DesktopPluginViewProps> = (props) => (
  <RhythmWorkspace key={props.projectId} {...props} />
)
function RhythmWorkspace({ projectId }: DesktopPluginViewProps) {
  const [text, setText] = useState('')
  const [selectedEnd, setSelectedEnd] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const report = useMemo(
    () => (text.trim() ? RhythmRadarEngine.analyzeChapter(text, 'manual', 0) : null),
    [text],
  )
  const cut = report?.cuts.find((c) => c.end === selectedEnd)
  return (
    <div className="p-6 space-y-4 h-full overflow-y-auto">
      <h2>剧情节奏与断章雷达</h2>
      <p>比较实际句段边界、切口前篇幅与后续正文；最近八处显示为可选位置，不能证明最佳断章。</p>
      <textarea
        aria-label="断章预览正文"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setSelectedEnd(null)
          setMessage('')
        }}
        placeholder="粘贴章节正文后查看规则分析"
        className="w-full border rounded p-3"
        rows={6}
      />
      {report ? (
        <>
          <EndingEvidence report={report} />
          {report.cuts.map((c) => (
            <article key={c.end} className="border rounded p-3">
              <p className="whitespace-pre-wrap">{c.quote}</p>
              <p>
                切口 {c.end}；此前 {c.beforeCharacters} 字符；后续 {c.afterCharacters} 字符。
              </p>
              <button onClick={() => setSelectedEnd(c.end)}>预览此处断章</button>
            </article>
          ))}
        </>
      ) : (
        <p role="status">输入正文后显示实际断章位置。</p>
      )}
      {cut && (
        <section>
          <h3>作者选定位置 {cut.end}</h3>
          <p>此前正文</p>
          <p className="whitespace-pre-wrap">{text.slice(0, cut.end)}</p>
          <p>保留的后续正文</p>
          <p className="whitespace-pre-wrap">{cut.continuation || '没有后续正文。'}</p>
        </section>
      )}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <button
        disabled={!report || !cut || saving}
        onClick={async () => {
          if (!report || !cut) return
          setSaving(true)
          setError('')
          try {
            await indexedDbRhythmRadarRepository.save({
              id: idGenerator.generate('radar'),
              projectId,
              chapterId: 'manual',
              chapterOrder: null,
              sourceText: text,
              observations: report.observations,
              cut: { ...cut },
              generatedAt: clock.now(),
            })
            setMessage('已归档作者选择及完整预览正文。')
          } catch (cause) {
            setError(String(cause))
          } finally {
            setSaving(false)
          }
        }}
      >
        归档当前断章雷达评测
      </button>
    </div>
  )
}
