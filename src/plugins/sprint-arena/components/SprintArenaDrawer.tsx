import { useEffect, useRef, useState, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import type { SprintRecord } from '../types'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { indexedDbSprintRepository } from '../../../adapters/indexedDbSprintRepository'
import { webAudioSynthesizer } from '../../../adapters/webAudioSynthesizer'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import { sprintEngine } from '../engine/SprintEngine'

const characters = (text: string) => Array.from(text.replace(/\s/gu, '')).length
interface Session {
  chapterId?: string
  startedAt: number
  startCount: number
}
export const SprintArenaDrawer: FC<DesktopPluginDrawerProps> = (props) => {
  const host = useOptionalPluginHostContext()
  return <SprintSession key={props.projectId + ':' + (host?.activeChapter?.id ?? '')} {...props} />
}
const SprintSession: FC<DesktopPluginDrawerProps> = ({ projectId, currentText }) => {
  const host = useOptionalPluginHostContext()
  const [activeSprint, setActiveSprint] = useState<Session | null>(null)
  const [mode, setMode] = useState<'time' | 'word_count'>('time')
  const [targetMinutes, setTargetMinutes] = useState(15)
  const [targetWords, setTargetWords] = useState(500)
  const [sound, setSound] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [rate, setRate] = useState(0)
  const [peak, setPeak] = useState(0)
  const [lastRecord, setLastRecord] = useState<SprintRecord | null>(null)
  const [pending, setPending] = useState<SprintRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const observed = useRef({ count: characters(currentText), at: clock.now() })
  const saving = useRef(false)
  const count = characters(currentText)
  const net = activeSprint
    ? count - activeSprint.startCount
    : (pending?.wordsWritten ?? lastRecord?.wordsWritten ?? 0)

  useEffect(() => {
    if (!activeSprint) return
    const tick = () => {
      const now = clock.now()
      setElapsed(Math.max(0, Math.floor((now - activeSprint.startedAt) / 1000)))
      if (now - observed.current.at > 3500) setRate(0)
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [activeSprint])
  useEffect(() => {
    if (!activeSprint) return
    const now = clock.now()
    const previous = observed.current
    if (count === previous.count) return
    const delta = count - previous.count
    const seconds = (now - previous.at) / 1000
    const actualRate = sprintEngine.calculateWpm(delta, seconds)
    observed.current = { count, at: now }
    setRate(actualRate)
    setPeak((value) => Math.max(value, actualRate))
    if (sound && delta > 0) {
      try {
        webAudioSynthesizer.playClick('mechanical')
      } catch (cause) {
        setError('音效失败：' + String(cause))
      }
    }
  }, [count, activeSprint, sound])
  const start = () => {
    const startedAt = clock.now()
    setActiveSprint({ chapterId: host?.activeChapter?.id, startedAt, startCount: count })
    observed.current = { count, at: startedAt }
    setPending(null)
    setLastRecord(null)
    setElapsed(0)
    setRate(0)
    setPeak(0)
    setMessage(null)
    setError(null)
  }
  const finish = async () => {
    if (saving.current || (!activeSprint && !pending)) return
    const now = clock.now()
    const seconds = activeSprint
      ? Math.max(0, (now - activeSprint.startedAt) / 1000)
      : pending!.durationSeconds
    const written = activeSprint ? count - activeSprint.startCount : pending!.wordsWritten
    const record: SprintRecord = pending ?? {
      id: idGenerator.generate('sprint'),
      projectId,
      chapterId: activeSprint!.chapterId,
      startedAt: activeSprint!.startedAt,
      startCharacters: activeSprint!.startCount,
      endCharacters: count,
      durationSeconds: seconds,
      wordsWritten: written,
      averageWpm: seconds > 0 ? Math.round((written / seconds) * 60) : 0,
      peakWpm: peak,
      completedAt: now,
      metricVersion: 2,
    }
    setPending(record)
    setActiveSprint(null)
    setElapsed(Math.floor(seconds))
    setRate(0)
    saving.current = true
    setBusy(true)
    setError(null)
    try {
      await indexedDbSprintRepository.save(record)
      setLastRecord(record)
      setPending(null)
      setMessage('冲刺记录已保存。')
    } catch (cause) {
      setError('保存失败，记录仍在此处，可重试：' + String(cause))
    } finally {
      saving.current = false
      setBusy(false)
    }
  }
  const progress = activeSprint
    ? Math.max(
        0,
        Math.min(
          100,
          mode === 'time' ? (elapsed / (targetMinutes * 60)) * 100 : (net / targetWords) * 100,
        ),
      )
    : 0
  return (
    <aside className="p-3 space-y-3 text-xs" data-testid="sprint-arena-drawer">
      <h3>码字冲刺</h3>
      <p>
        当前章节：{host?.activeChapter?.title ?? '独立文本'}
        。记录非空白字符净增，包括粘贴与删改；速度不代表击键或心流状态。
      </p>
      <button onClick={() => setSound((value) => !value)}>
        {sound ? '关闭输入反馈音' : '开启输入反馈音'}
      </button>
      {!activeSprint && !pending && (
        <>
          <button onClick={() => setMode('time')}>时间番茄钟</button>
          <button onClick={() => setMode('word_count')}>字数挑战</button>
          {mode === 'time'
            ? [15, 25, 45].map((m) => (
                <button key={m} onClick={() => setTargetMinutes(m)}>
                  {m} 分钟
                </button>
              ))
            : [300, 500, 1000].map((w) => (
                <button key={w} onClick={() => setTargetWords(w)}>
                  {w} 字
                </button>
              ))}
          <button onClick={start}>开启极速冲刺</button>
        </>
      )}
      {(activeSprint || pending) && (
        <button disabled={busy} onClick={() => void finish()}>
          {busy ? '保存中…' : pending ? '重试保存' : '结算'}
        </button>
      )}
      {activeSprint && (
        <p>
          冲刺中 ({Math.floor(elapsed / 60)}分{elapsed % 60}秒)
        </p>
      )}
      <progress aria-label="目标进度" value={progress} max={100} />
      {activeSprint && progress >= 100 && <p>目标已达到，可自行结算或继续。</p>}
      <p>
        冲刺净增字数：{net >= 0 ? '+' : ''}
        {net}
      </p>
      <p>最近一次正文变化速率：{rate} 字/分钟</p>
      <p>最高观察速率：{peak} 字/分钟</p>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </aside>
  )
}
