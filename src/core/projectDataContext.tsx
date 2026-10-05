import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type FC,
  type ReactNode,
} from 'react'
import type { ProjectRecord, ChapterRecord, VolumeRecord } from '../types'
import { indexedDbProjectRepository } from '../adapters/indexedDbProjectRepository'
import { clock } from '../adapters/clock'
import { chapterSaveEvents } from '../ports/chapterSaveEvents'
import { domainChangeEvents } from '../ports/domainChangeEvents'

interface ProjectDataContextValue {
  projectId: string
  project: ProjectRecord | null
  chapters: ChapterRecord[]
  volumes: VolumeRecord[]
  isLoading: boolean
  reloadProject: () => Promise<void>
  reloadChapters: () => Promise<void>
  invalidateAll: () => Promise<void>
}

const ProjectDataContext = createContext<ProjectDataContextValue | null>(null)

// 内存单例缓存，避免不同插件组件反复向 IndexedDB 触发高频重复读取
const memoryCache = new Map<
  string,
  {
    project: ProjectRecord | null
    chapters: ChapterRecord[]
    volumes: VolumeRecord[]
    timestamp: number
  }
>()

export interface ProjectDataProviderProps {
  projectId: string
  children: ReactNode
}

export const ProjectDataProvider: FC<ProjectDataProviderProps> = ({ projectId, children }) => {
  const [project, setProject] = useState<ProjectRecord | null>(() => {
    return memoryCache.get(projectId)?.project || null
  })
  const [chapters, setChapters] = useState<ChapterRecord[]>(() => {
    return memoryCache.get(projectId)?.chapters || []
  })
  const [volumes, setVolumes] = useState<VolumeRecord[]>(() => {
    return memoryCache.get(projectId)?.volumes || []
  })
  const [isLoading, setIsLoading] = useState<boolean>(!memoryCache.has(projectId))

  const reloadProject = useCallback(async () => {
    if (!projectId) return
    try {
      const p = await indexedDbProjectRepository.getProject(projectId)
      setProject(p || null)
      const existing = memoryCache.get(projectId)
      memoryCache.set(projectId, {
        project: p || null,
        chapters: existing?.chapters || [],
        volumes: existing?.volumes || [],
        timestamp: clock.now(),
      })
    } catch (e) {
      console.warn('[ProjectDataProvider] Failed to reload project:', e)
    }
  }, [projectId])

  const reloadChapters = useCallback(async () => {
    if (!projectId) return
    try {
      const chs = await indexedDbProjectRepository.getChaptersByProject(projectId)
      const vols = await indexedDbProjectRepository.getVolumesByProject(projectId)
      setChapters(chs || [])
      setVolumes(vols || [])
      const existing = memoryCache.get(projectId)
      memoryCache.set(projectId, {
        project: existing?.project || null,
        chapters: chs || [],
        volumes: vols || [],
        timestamp: clock.now(),
      })
    } catch (e) {
      console.warn('[ProjectDataProvider] Failed to reload chapters/volumes:', e)
    }
  }, [projectId])

  const invalidateAll = useCallback(async () => {
    setIsLoading(true)
    await Promise.all([reloadProject(), reloadChapters()])
    setIsLoading(false)
  }, [reloadProject, reloadChapters])

  useEffect(() => {
    let active = true
    const cached = memoryCache.get(projectId)

    const hasFreshCache = Boolean(cached && clock.now() - cached.timestamp < 10000)
    if (hasFreshCache && cached) {
      setProject(cached.project)
      setChapters(cached.chapters)
      setVolumes(cached.volumes)
      setIsLoading(false)
    } else {
      setIsLoading(true)
    }
    Promise.all([
      indexedDbProjectRepository.getProject(projectId),
      indexedDbProjectRepository.getChaptersByProject(projectId),
      indexedDbProjectRepository.getVolumesByProject(projectId),
    ])
      .then(([p, chs, vols]) => {
        if (!active) return
        setProject(p || null)
        setChapters(chs || [])
        setVolumes(vols || [])
        memoryCache.set(projectId, {
          project: p || null,
          chapters: chs || [],
          volumes: vols || [],
          timestamp: clock.now(),
        })
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [projectId])

  // IndexedDB remains authoritative; local save and cross-window domain events
  // only invalidate this projection and cause a fresh read from IndexedDB.
  useEffect(() => {
    let active = true
    let refreshInFlight = Promise.resolve()
    const refresh = () => {
      refreshInFlight = refreshInFlight
        .then(async () => {
          const [p, chs, vols] = await Promise.all([
            indexedDbProjectRepository.getProject(projectId),
            indexedDbProjectRepository.getChaptersByProject(projectId),
            indexedDbProjectRepository.getVolumesByProject(projectId),
          ])
          if (!active) return
          setProject(p || null)
          setChapters(chs || [])
          setVolumes(vols || [])
          memoryCache.set(projectId, {
            project: p || null,
            chapters: chs || [],
            volumes: vols || [],
            timestamp: clock.now(),
          })
        })
        .catch(() => {})
    }

    const unsubscribeDomain = domainChangeEvents.subscribe(projectId, refresh)
    const unsubscribeChapter = chapterSaveEvents.subscribe(({ chapter }) => {
      if (!active || chapter.projectId !== projectId) return
      setChapters((current) => {
        const next = current.some((item) => item.id === chapter.id)
          ? current.map((item) => (item.id === chapter.id ? chapter : item))
          : [...current, chapter]
        const cached = memoryCache.get(projectId)
        memoryCache.set(projectId, {
          project: cached?.project || null,
          chapters: next,
          volumes: cached?.volumes || [],
          timestamp: clock.now(),
        })
        return next
      })
    })

    return () => {
      active = false
      unsubscribeDomain()
      unsubscribeChapter()
    }
  }, [projectId])

  const value = useMemo<ProjectDataContextValue>(
    () => ({
      projectId,
      project,
      chapters,
      volumes,
      isLoading,
      reloadProject,
      reloadChapters,
      invalidateAll,
    }),
    [
      projectId,
      project,
      chapters,
      volumes,
      isLoading,
      reloadProject,
      reloadChapters,
      invalidateAll,
    ],
  )

  return <ProjectDataContext.Provider value={value}>{children}</ProjectDataContext.Provider>
}

export function useProjectData(): ProjectDataContextValue {
  const ctx = useContext(ProjectDataContext)
  if (!ctx) {
    throw new Error('useProjectData 必须在 <ProjectDataProvider> 内使用')
  }
  return ctx
}

export function useOptionalProjectData(): ProjectDataContextValue | null {
  return useContext(ProjectDataContext)
}
