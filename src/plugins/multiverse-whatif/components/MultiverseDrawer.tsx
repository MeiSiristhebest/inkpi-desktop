import { useEffect, useState, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import type { MultiverseBranchRecord } from '../types'
import { indexedDbMultiverseRepository } from '../../../adapters/indexedDbMultiverseRepository'
export const MultiverseDrawer: FC<DesktopPluginDrawerProps> = (props) => (
  <BranchDrawer key={props.projectId} {...props} />
)
const BranchDrawer: FC<DesktopPluginDrawerProps> = ({ projectId }) => {
  const [branches, setBranches] = useState<MultiverseBranchRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let stale = false
    indexedDbMultiverseRepository
      .getAll(projectId)
      .then((all) => {
        if (!stale) {
          setBranches(all.filter((b) => b.projectId === projectId))
          setError(null)
        }
      })
      .catch((cause) => {
        if (!stale) setError(String(cause))
      })
    return () => {
      stale = true
    }
  }, [projectId, attempt])
  return (
    <div className="p-3 space-y-3 text-xs">
      <h3>平行时空沙盒</h3>
      <p>当前正文仍为主线。已归档分支计划 {branches.length} 份。</p>
      {error && (
        <p role="alert">
          {error}
          <button onClick={() => setAttempt((n) => n + 1)}>重新读取</button>
        </p>
      )}
      {branches.map((b) => (
        <article key={b.id}>
          <strong>{b.name}</strong>
          <p>{b.divergencePremise}</p>
          {b.schemaVersion !== 2 && <p>旧记录尚未复核。</p>}
        </article>
      ))}
    </div>
  )
}
