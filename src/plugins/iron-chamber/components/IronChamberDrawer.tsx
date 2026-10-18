import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { indexedDbIronChamberRepository } from '../../../adapters/indexedDbIronChamberRepository'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { IronChamberEngine } from '../engine/IronChamberEngine'
import type { IronChamberRecord } from '../types'
import { Lock } from 'lucide-react'
import { clock } from '../../../adapters/clock'

export const IronChamberDrawer: FC<DesktopPluginDrawerProps> = (props) => (
  <ProjectChamberDrawer key={props.projectId} {...props} />
)
const ProjectChamberDrawer: FC<DesktopPluginDrawerProps> = ({ projectId, currentText }) => {
  const host = useOptionalPluginHostContext()
  const [active, setActive] = useState<IronChamberRecord | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(clock.now)
  useEffect(() => {
    let disposed = false
    const load = () =>
      indexedDbIronChamberRepository
        .getActive(projectId)
        .then((record) => {
          if (!disposed) {
            setActive(record ?? null)
            setLoaded(true)
            setError('')
          }
        })
        .catch(() => {
          if (!disposed) setError('会话读取失败，请重试。')
        })
    load()
    window.addEventListener('focus', load)
    return () => {
      disposed = true
      window.removeEventListener('focus', load)
    }
  }, [projectId])
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNow(clock.now()), 1000)
    return () => clearInterval(timer)
  }, [active?.id])
  const sourceMatches =
    !!active?.chapterId &&
    host?.activeChapterId === active.chapterId &&
    host.projectId === projectId
  const count = IronChamberEngine.countCharacters(currentText)
  const progress =
    active && sourceMatches && active.measurementUnit === 'unicode_non_whitespace'
      ? IronChamberEngine.calculateProgress(active, count, now)
      : null
  const finish = async (completed: boolean) => {
    if (!active || busy || (completed && !progress?.isFulfilled)) return
    setBusy(true)
    try {
      await indexedDbIronChamberRepository.finishSession({
        ...active,
        currentWords: progress ? count : active.currentWords,
        status: completed ? 'completed' : 'emergency_abort',
        completedAt: clock.now(),
      })
      setActive(null)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '结束状态保存失败，请重试。')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="p-3 space-y-3 text-xs">
      <h3 className="font-bold">
        <Lock className="w-4 h-4 inline" />
        小黑屋心流守卫
      </h3>
      {error && <p role="alert">{error}</p>}
      {!loaded ? (
        <p>正在读取会话</p>
      ) : !active ? (
        <p>当前未启动章节专注会话</p>
      ) : (
        <div className="space-y-2">
          {progress ? (
            <>
              <p>
                章内净增：{progress.deltaWords} / {active.targetWords} 字符
              </p>
              <p>
                已过：{Math.floor(progress.elapsedSeconds / 60)} / {active.targetMinutes} 分钟
              </p>
              {progress.error && <p role="alert">{progress.error}</p>}
            </>
          ) : (
            <p>
              {active.chapterId
                ? '当前章节不属于本会话，切回绑定章节查看字符进度。'
                : '旧会话计数来源未知，未判定目标。'}
            </p>
          )}
          <p>非空白 Unicode 字符，标点计入；计数不区分粘贴和键入。</p>
          <button
            type="button"
            disabled={busy || !progress?.isFulfilled}
            onClick={() => finish(true)}
            className="p-1 border rounded"
          >
            保存目标完成
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => finish(false)}
            className="p-1 ml-1 border rounded"
          >
            自愿结束会话
          </button>
        </div>
      )}
    </div>
  )
}
