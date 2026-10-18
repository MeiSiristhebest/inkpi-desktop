import { useEffect, useState, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { indexedDbVolumeArcRepository } from '../../../adapters/indexedDbVolumeArcRepository'
import { volumeMasterEngine } from '../engine/VolumeMasterEngine'
import type { VolumeStat } from '../types'
import { semanticTextFromContent } from '../../../domain/content'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
export const VolumeMasterDrawer: FC<DesktopPluginDrawerProps> = (props) => (
  <VolumeDrawerBody key={props.projectId} {...props} />
)
function VolumeDrawerBody({ projectId }: DesktopPluginDrawerProps) {
  const host = useOptionalPluginHostContext()
  const activeId = host?.projectId === projectId ? host.activeChapter?.id : undefined
  const [state, setState] = useState<{ activeId: string | undefined; stat: VolumeStat } | null>(
    null,
  )
  const stat = state && state.activeId === activeId ? state.stat : null
  const [error, setError] = useState('')
  useEffect(() => {
    let disposed = false
    setState(null)
    Promise.all([
      indexedDbProjectRepository.getVolumesByProject(projectId),
      indexedDbProjectRepository.getChaptersByProject(projectId),
      indexedDbVolumeArcRepository.getAll(projectId),
    ])
      .then(([volumes, chapters, arcs]) => {
        if (disposed) return
        const chapter = chapters.find((c) => c.id === activeId && c.projectId === projectId)
        const volume = volumes.find((v) => v.id === chapter?.volumeId && v.projectId === projectId)
        if (!volume) return
        setState({
          activeId,
          stat: volumeMasterEngine.calculateVolumeStat(
            volume,
            chapters
              .filter((c) => c.projectId === projectId)
              .map((c) => ({
                volumeId: c.volumeId,
                order: c.order,
                wordCount: Array.from(
                  semanticTextFromContent(c.id, c.content, c.revision).replace(/\s/g, ''),
                ).length,
              })),
            arcs.find((a) => a.volumeId === volume.id && a.projectId === projectId),
          ),
        })
      })
      .catch((cause) => {
        if (!disposed) setError(String(cause))
      })
    return () => {
      disposed = true
    }
  }, [projectId, activeId])
  return (
    <aside className="p-4 space-y-3 text-xs">
      <h3>当前卷作者规划</h3>
      {error && <p role="alert">{error}</p>}
      {!stat ? (
        <p>当前章节未绑定已保存分卷，规划未知。</p>
      ) : (
        <>
          <h4>{stat.title}</h4>
          <p>
            保存稿 {stat.actualWordCount ?? '未知'} / 作者预算 {stat.targetWordCount ?? '未登记'}。
          </p>
          <p>
            作者阶段：
            {stat.currentAct ? volumeMasterEngine.getActStageInfo(stat.currentAct).label : '未登记'}
          </p>
          <p>{stat.advice}</p>
        </>
      )}
    </aside>
  )
}
