import { useEffect, useMemo, useState, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import type { ChapterRecord, VolumeRecord } from '../../../types'
import type { CodexEntity } from '../../living-codex/types'
import { MemoryPalaceEngine } from '../engine/MemoryPalaceEngine'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { chapterSaveEvents } from '../../../ports/chapterSaveEvents'

export const MemoryPalaceDrawer: FC<DesktopPluginDrawerProps> = (props) => (
  <MemoryDrawerSession key={props.projectId} {...props} />
)
const MemoryDrawerSession: FC<DesktopPluginDrawerProps> = ({ projectId, currentText }) => {
  const [entities, setEntities] = useState<CodexEntity[]>([])
  const [chapters, setChapters] = useState<ChapterRecord[]>([])
  const [volumes, setVolumes] = useState<VolumeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let stale = false
    setLoading(true)
    Promise.all([
      indexedDbCodexEntityRepository.getAll(),
      indexedDbProjectRepository.getChaptersByProject?.(projectId) ?? Promise.resolve([]),
      indexedDbProjectRepository.getVolumesByProject?.(projectId) ?? Promise.resolve([]),
    ])
      .then(([entities, chapters, volumes]) => {
        if (stale) return
        setEntities(entities.filter((e) => e.projectId === projectId))
        setChapters(chapters.filter((c) => c.projectId === projectId))
        setVolumes(volumes)
        setError(null)
      })
      .catch((cause) => {
        if (!stale) setError(String(cause))
      })
      .finally(() => {
        if (!stale) setLoading(false)
      })
    return () => {
      stale = true
    }
  }, [projectId, attempt])
  useEffect(
    () =>
      chapterSaveEvents.subscribe(({ chapter }) => {
        if (chapter.projectId === projectId)
          setChapters((current) => [...current.filter((c) => c.id !== chapter.id), chapter])
      }),
    [projectId],
  )
  const detected = useMemo(
    () => MemoryPalaceEngine.detectEntitiesInText(currentText, entities),
    [currentText, entities],
  )
  const results = MemoryPalaceEngine.searchEntityOccurrences({
    query: '',
    entities: detected,
    chapters,
    volumes,
    projectId,
  })
  return (
    <div className="p-4 space-y-3 text-xs">
      <h3>本章登场实体速查</h3>
      <p>
        已探知 {detected.length} 个实体 · 实体库共 {entities.length} 个设定项
      </p>
      <p>词项命中只表示原文出现，以下引用来自已保存章节。</p>
      {loading && <p>读取已保存的历史正文…</p>}
      {error && (
        <p role="alert">
          {error}
          <button onClick={() => setAttempt((n) => n + 1)}>重新读取</button>
        </p>
      )}
      {!loading && detected.length === 0 && <p>当前章节正文中未发现已录入的实体名。</p>}
      {results.map((result) => {
        const entity = entities.find((e) => e.id === result.entityId)!
        return (
          <article key={result.entityId} className="border rounded p-2 space-y-1">
            <strong>{entity.name}</strong>
            <span> {entity.category}</span>
            {entity.aliases?.length ? <p>别名：{entity.aliases.join('、')}</p> : null}
            {entity.summary && <p>{entity.summary}</p>}
            <p>
              已保存正文词项命中 {result.totalOccurrences} 次 · {result.matchedChapterCount} 章
            </p>
            {result.occurrences?.slice(-3).map((o, i) => (
              <div key={i}>
                <p>
                  {o.chapterTitle} · 版本 {o.chapterRevision ?? '未知'} · 位置 {o.sourceStart}–
                  {o.sourceEnd}
                </p>
                <blockquote className="whitespace-pre-wrap">{o.snippet}</blockquote>
              </div>
            ))}
          </article>
        )
      })}
    </div>
  )
}
