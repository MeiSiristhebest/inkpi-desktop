import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { indexedDbIronChamberRepository } from '../../../adapters/indexedDbIronChamberRepository'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { semanticTextFromContent } from '../../../domain/content'
import {
  projectChapterSequence,
  type PositionedChapter,
} from '../../../domain/chapter/chapterSequence'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { IronChamberEngine } from '../engine/IronChamberEngine'
import type { IronChamberRecord, ChamberLockMode } from '../types'
import { Lock } from 'lucide-react'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import { Select } from '../../../ui/primitives'

export const IronChamberMasterView: FC<DesktopPluginViewProps> = (props) => (
  <ProjectChamberView key={props.projectId} {...props} />
)
const ProjectChamberView: FC<DesktopPluginViewProps> = ({ projectId, onStats }) => {
  const host = useOptionalPluginHostContext()
  const [active, setActive] = useState<IronChamberRecord | null>(null)
  const [chapters, setChapters] = useState<PositionedChapter[]>([])
  const [chapterId, setChapterId] = useState('')
  const [mode, setMode] = useState<ChamberLockMode>('words')
  const [targetWords, setTargetWords] = useState(1000)
  const [targetMinutes, setTargetMinutes] = useState(25)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(clock.now)
  useEffect(() => {
    let disposed = false
    const load = async () => {
      try {
        const [records, volumes, session] = await Promise.all([
          indexedDbProjectRepository.getChaptersByProject(projectId),
          indexedDbProjectRepository.getVolumesByProject(projectId),
          indexedDbIronChamberRepository.getActive(projectId),
        ])
        if (disposed) return
        const ordered = projectChapterSequence(projectId, records, volumes)
        setChapters(ordered)
        setActive(session ?? null)
        setChapterId(session?.chapterId ?? host?.activeChapterId ?? ordered[0]?.id ?? '')
        setLoaded(true)
      } catch {
        if (!disposed) setError('章节或会话读取失败，请重新打开重试。')
      }
    }
    load()
    return () => {
      disposed = true
    }
  }, [projectId])
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNow(clock.now()), 1000)
    return () => clearInterval(timer)
  }, [active?.id])
  useEffect(() => {
    onStats?.({ title: '章节专注目标', wordCount: 0, updatedAt: clock.now() })
  }, [onStats])
  const sourceId = active?.chapterId ?? chapterId
  const chapter =
    host?.activeChapter?.id === sourceId && host.activeChapter.projectId === projectId
      ? host.activeChapter
      : (host?.bookHierarchy.chapters.find(
          (item) => item.projectId === projectId && item.id === sourceId,
        ) ?? chapters.find((item) => item.id === sourceId))
  const text = chapter ? semanticTextFromContent(chapter.id, chapter.content, chapter.revision) : ''
  const count = IronChamberEngine.countCharacters(text)
  const progress =
    active && chapter && active.measurementUnit === 'unicode_non_whitespace'
      ? IronChamberEngine.calculateProgress(active, count, now)
      : null
  const start = async () => {
    if (busy || !loaded || !chapter) return
    const record: IronChamberRecord = {
      id: idGenerator.generate('chamber'),
      projectId,
      chapterId: chapter.id,
      chapterRevisionAtStart: chapter.revision,
      measurementUnit: 'unicode_non_whitespace',
      mode,
      targetWords,
      targetMinutes,
      startWords: count,
      currentWords: count,
      pledgedAt: clock.now(),
      status: 'locked',
    }
    if (!IronChamberEngine.calculateProgress(record, count, record.pledgedAt).valid) {
      setError('目标须为正整数；未使用的目标可留零。')
      return
    }
    setBusy(true)
    try {
      await indexedDbIronChamberRepository.startSession(record)
      setActive(record)
      setNow(clock.now())
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '开始失败，请重试。')
    } finally {
      setBusy(false)
    }
  }
  const finish = async (completed: boolean) => {
    if (busy || !active) return
    if (completed && !progress?.isFulfilled) return
    setBusy(true)
    try {
      const current = await indexedDbIronChamberRepository.get(active.id)
      if (!current || current.projectId !== projectId || current.status !== 'locked')
        throw new Error('会话已由其他窗口处理，请重新打开。')
      await indexedDbIronChamberRepository.finishSession({
        ...current,
        currentWords:
          chapter && current.measurementUnit === 'unicode_non_whitespace'
            ? count
            : current.currentWords,
        status: completed ? 'completed' : 'emergency_abort',
        completedAt: clock.now(),
        emergencyReasons:
          !completed && note.trim()
            ? [...(current.emergencyReasons ?? []), note.trim()]
            : current.emergencyReasons,
      })
      setActive(null)
      setNote('')
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '结束状态保存失败，请重试。')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4 text-[var(--ink-text)]">
      <h2 className="text-xl font-bold">
        <Lock className="w-5 h-5 inline" />
        黑曜石小黑屋 (IronChamber)
      </h2>
      <p className="text-xs">
        作者自愿设置章节目标。按选定章节的非空白 Unicode
        字符净增量和已过时间计数，标点计入；不判断粘贴、创作质量或专注程度。
      </p>
      {error && <p role="alert">{error}</p>}
      {!loaded && <p>正在读取章节和会话</p>}
      {!active ? (
        <div className="space-y-3 p-4 border rounded">
          <Select aria-label="计数章节" value={chapterId} onValueChange={setChapterId}>
            <option value="">请选择章节</option>
            {chapters.map((item) => (
              <option key={item.id} value={item.id}>
                {item.chapterNumber ? `第 ${item.chapterNumber} 章` : '位置未知'} · {item.title}
              </option>
            ))}
          </Select>
          <Select
            aria-label="目标模式"
            value={mode}
            onValueChange={(value) => setMode(value as ChamberLockMode)}
          >
            <option value="words">字符净增目标</option>
            <option value="minutes">时长目标</option>
            <option value="dual">同时达成字符与时长</option>
          </Select>
          <label className="block text-xs">
            目标新增字符
            <input
              aria-label="目标新增字符"
              type="number"
              min="0"
              value={targetWords}
              onChange={(event) => setTargetWords(Number(event.target.value))}
              className="ml-2 border bg-transparent"
            />
          </label>
          <label className="block text-xs">
            目标分钟
            <input
              aria-label="目标分钟"
              type="number"
              min="0"
              value={targetMinutes}
              onChange={(event) => setTargetMinutes(Number(event.target.value))}
              className="ml-2 border bg-transparent"
            />
          </label>
          <button
            type="button"
            disabled={!loaded || busy || !chapter}
            aria-busy={busy}
            onClick={start}
            className="p-2 border rounded"
          >
            开始章节专注会话
          </button>
        </div>
      ) : (
        <div className="p-4 border rounded space-y-2">
          <p>计数章节：{chapter?.title ?? active.chapterId ?? '旧会话未登记来源'}</p>
          {progress ? (
            <>
              <p>
                章节净增：{progress.deltaWords} / {active.targetWords} 字符
              </p>
              <p>
                已过：{Math.floor(progress.elapsedSeconds / 60)} / {active.targetMinutes} 分钟
              </p>
              {progress.error && <p role="alert">{progress.error}</p>}
            </>
          ) : (
            <p>计数来源或旧口径未知，未判定字符目标；仍可结束会话。</p>
          )}
          <label className="block text-xs">
            结束说明（可选）
            <input
              aria-label="结束说明（可选）"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="w-full border bg-transparent"
            />
          </label>
          <button
            type="button"
            disabled={busy || !progress?.isFulfilled}
            onClick={() => finish(true)}
            className="p-2 border rounded"
          >
            保存目标完成
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => finish(false)}
            className="ml-2 p-2 border rounded"
          >
            自愿结束会话
          </button>
        </div>
      )}
      <p className="text-xs">
        正文由写作台保存。返回写作台写作后，侧栏显示所绑定章节的进度；切换其他章节不会把那一章计入本会话。
      </p>
    </div>
  )
}
