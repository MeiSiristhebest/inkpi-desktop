import { useEffect, useMemo, useState, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import type { ScrapbookFragmentRecord } from '../types'
import { ScrapbookEngine } from '../engine/ScrapbookEngine'
import { indexedDbScrapbookRepository } from '../../../adapters/indexedDbScrapbookRepository'
import { clipboardWriter } from '../../../adapters/clipboardWriter'

export const ScrapbookDrawer: FC<DesktopPluginDrawerProps> = (props) => (
  <ScrapbookDrawerSession key={props.projectId} {...props} />
)
const ScrapbookDrawerSession: FC<DesktopPluginDrawerProps> = ({ projectId, currentText }) => {
  const [fragments, setFragments] = useState<ScrapbookFragmentRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let stale = false
    indexedDbScrapbookRepository
      .getAll(projectId)
      .then((all) => {
        if (!stale) {
          setFragments(all.filter((f) => f.projectId === projectId))
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
  const recs = useMemo(
    () => ScrapbookEngine.recommendFragments(currentText, fragments, 3),
    [currentText, fragments],
  )
  const copy = async (fragment: ScrapbookFragmentRecord) => {
    try {
      await clipboardWriter.writeText(fragment.snippet)
      setCopied(fragment.id)
      setError(null)
    } catch (cause) {
      setError('复制失败：' + String(cause))
    }
  }
  return (
    <div className="p-3 space-y-3 text-xs">
      <h3>废稿灵感推荐</h3>
      <p>池内 {fragments.length} 条 · 当前全文词项匹配</p>
      {error && (
        <p role="alert">
          {error}
          <button onClick={() => setAttempt((n) => n + 1)}>重新读取</button>
        </p>
      )}
      {!recs.length && <p>未检索到与当前上下文有词项重合的废稿</p>}
      {recs.map((r) => (
        <article key={r.fragment.id} className="border rounded p-2">
          <p>匹配词项：{r.matchedKeywords.join('、')}</p>
          <blockquote className="whitespace-pre-wrap">{r.fragment.snippet}</blockquote>
          <button onClick={() => void copy(r.fragment)}>
            {copied === r.fragment.id ? '已复制' : '复制片段'}
          </button>
        </article>
      ))}
    </div>
  )
}
