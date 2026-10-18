import { useEffect, useState, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import type { AuthorOpsProfileRecord } from '../types'
import { indexedDbAuthorOpsRepository } from '../../../adapters/indexedDbAuthorOpsRepository'
import { AuthorOpsEngine } from '../engine/AuthorOpsEngine'
export const AuthorOpsDrawer: FC<DesktopPluginDrawerProps> = (props) => (
  <OpsDrawerSession key={props.projectId} {...props} />
)
const OpsDrawerSession: FC<DesktopPluginDrawerProps> = ({ projectId }) => {
  const [profile, setProfile] = useState<AuthorOpsProfileRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let stale = false
    indexedDbAuthorOpsRepository
      .get(projectId)
      .then((record) => {
        if (stale) return
        if (record && record.projectId !== projectId) throw new Error('台账不属于本项目。')
        setProfile(record ?? null)
        setError(null)
        setLoaded(true)
      })
      .catch((cause) => {
        if (!stale) {
          setError(String(cause))
          setLoaded(true)
        }
      })
    return () => {
      stale = true
    }
  }, [projectId, attempt])
  const results = profile
    ? AuthorOpsEngine.analyzeDropOff(profile.metricLogs, profile.reminderThreshold)
    : []
  return (
    <div className="p-3 space-y-3 text-xs">
      <h3>连载追读哨兵</h3>
      <p>来源：作者录入的运营台账；变化只描述相邻记录。</p>
      {!loaded && <p>正在读取本书的运营台账…</p>}
      {error && (
        <p role="alert">
          {error}
          <button onClick={() => setAttempt((n) => n + 1)}>重新读取</button>
        </p>
      )}
      {loaded && !profile?.metricLogs.length && <p>本书还没有任何台账记录。</p>}
      {profile?.metricLogs.length === 1 && <p>只有 1 条记录，留存差分至少需要相邻两条。</p>}
      {profile && profile.metricLogs.length > 1 && !results.length && (
        <p>统计群体、周期、口径或相邻章序不足，无法比较。</p>
      )}
      {results.slice(0, 3).map((r, i) => (
        <article key={i}>
          <p>
            第 {r.previousChapter}–{r.dropOffChapter} 章下降 {r.gradientLoss} 个百分点
          </p>
          <p>
            {r.cohort} / {r.period}
          </p>
          <p>{r.probableReason}</p>
          {r.isSevereCliff && <p>达到作者提醒阈值。</p>}
        </article>
      ))}
    </div>
  )
}
