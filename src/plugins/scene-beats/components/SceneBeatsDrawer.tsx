import { useEffect, useState, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import type { ChapterBeatPlan } from '../types'
import { sceneBeatsEngine } from '../engine/SceneBeatsEngine'
import { indexedDbSceneBeatRepository } from '../../../adapters/indexedDbSceneBeatRepository'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { clock } from '../../../adapters/clock'
import { Select } from '../../../ui/primitives'
export const SceneBeatsDrawer: FC<DesktopPluginDrawerProps> = (props) => (
  <SceneDrawerBody key={props.projectId} {...props} />
)
function SceneDrawerBody({ projectId, currentText }: DesktopPluginDrawerProps) {
  const host = useOptionalPluginHostContext()
  const activeId = host?.projectId === projectId ? host.activeChapter?.id : undefined
  const [plans, setPlans] = useState<ChapterBeatPlan[]>([])
  const [selected, setSelected] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let disposed = false
    indexedDbSceneBeatRepository
      .getAll()
      .then((all) => {
        if (!disposed) {
          const matching = all.filter((p) => p.projectId === projectId && p.chapterId === activeId)
          setPlans(matching)
          setSelected(matching[0]?.id ?? '')
        }
      })
      .catch((cause) => {
        if (!disposed) setError(String(cause))
      })
    return () => {
      disposed = true
    }
  }, [projectId, activeId])
  const visiblePlans = plans.filter((p) => p.projectId === projectId && p.chapterId === activeId)
  const plan = visiblePlans.find((p) => p.id === selected)
  const validation = plan ? sceneBeatsEngine.validatePlan(plan) : []
  const count = Array.from((currentText || '').replace(/\s/g, '')).length
  const report =
    plan && activeId && !validation.length
      ? sceneBeatsEngine.calculatePacingStatus(plan, count)
      : null
  return (
    <aside data-testid="scene-beats-drawer" className="p-4 space-y-3 text-xs">
      <h3>当前章节节拍预算</h3>
      <p>字符数表示预算位置；剧情完成须由作者确认。</p>
      {error && <p role="alert">{error}</p>}
      {validation.map((e) => (
        <p key={e} role="alert">
          {e}
        </p>
      ))}
      {!activeId ? (
        <p>当前正文未绑定保存章节，不能使用其他章节的细纲进度。</p>
      ) : !visiblePlans.length ? (
        <p>当前章节尚无已保存细纲。</p>
      ) : (
        <>
          <Select aria-label="当前章细纲计划" value={selected} onValueChange={setSelected}>
            {visiblePlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id}
              </option>
            ))}
          </Select>
          {report && (
            <p>
              正文 {count} / 预算 {report.targetTotalWords}，预算比 {report.progressPct.toFixed(1)}
              %。
            </p>
          )}
          {plan?.beats.map((beat) => (
            <section key={beat.id}>
              <p>
                {beat.title}：{beat.goalOrConflict}
              </p>
              <button
                disabled={busy}
                onClick={async () => {
                  setError('')
                  setBusy(true)
                  try {
                    const updated = {
                      ...plan,
                      beats: plan.beats.map((b) =>
                        b.id === beat.id ? { ...b, isCompleted: !b.isCompleted } : b,
                      ),
                      updatedAt: clock.now(),
                    }
                    await indexedDbSceneBeatRepository.save(updated)
                    setPlans((current) => current.map((p) => (p.id === updated.id ? updated : p)))
                  } catch (cause) {
                    setError(String(cause))
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                {beat.isCompleted ? '作者标记未完成' : '作者标记完成'}
              </button>
            </section>
          ))}
        </>
      )}
    </aside>
  )
}
