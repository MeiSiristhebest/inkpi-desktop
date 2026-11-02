import type { ChapterRecord, ProjectRecord, VolumeRecord } from '../../../types'

export type ProjectStartGuideDisposition = 'deferred' | 'ignored'
export type ProjectStartGuideSuggestionId =
  'project-positioning' | 'world-setting' | 'first-volume' | 'first-chapter'

export interface ProjectStartGuideState {
  version: 1
  dispositions: Partial<Record<ProjectStartGuideSuggestionId, ProjectStartGuideDisposition>>
}

export interface ProjectStartGuideSuggestion {
  id: ProjectStartGuideSuggestionId
  title: string
  description: string
  actionLabel: string
  targetView: string
}

export interface ProjectStartGuideFacts {
  projectId: string
  project?: ProjectRecord
  volumes: readonly VolumeRecord[]
  chapters: readonly ChapterRecord[]
  positioningData?: Record<string, unknown>
  worldbaseData?: Record<string, unknown>
}

export function emptyProjectStartGuideState(): ProjectStartGuideState {
  return { version: 1, dispositions: {} }
}

export function parseProjectStartGuideState(value: unknown): ProjectStartGuideState {
  if (!value || typeof value !== 'object') return emptyProjectStartGuideState()
  const record = value as Record<string, unknown>
  if (record.version !== 1 || !record.dispositions || typeof record.dispositions !== 'object') {
    return emptyProjectStartGuideState()
  }

  const dispositions: ProjectStartGuideState['dispositions'] = {}
  for (const [id, disposition] of Object.entries(record.dispositions)) {
    if (
      (id === 'project-positioning' ||
        id === 'world-setting' ||
        id === 'first-volume' ||
        id === 'first-chapter') &&
      (disposition === 'deferred' || disposition === 'ignored')
    ) {
      dispositions[id] = disposition
    }
  }
  return { version: 1, dispositions }
}

function hasEnteredFormData(data: Record<string, unknown> | undefined): boolean {
  return Object.values(data ?? {}).some(
    (value) => typeof value === 'string' && value.trim().length > 0,
  )
}

export function deriveProjectStartSuggestions({
  projectId,
  project,
  volumes,
  chapters,
  positioningData,
  worldbaseData,
}: ProjectStartGuideFacts): ProjectStartGuideSuggestion[] {
  if (!project || project.id !== projectId) return []

  const projectVolumes = volumes.filter((volume) => volume.projectId === projectId)
  const projectChapters = chapters.filter((chapter) => chapter.projectId === projectId)
  const suggestions: ProjectStartGuideSuggestion[] = []
  const hasProjectPositioning = Boolean(project.genre?.trim() || project.intro?.trim())

  if (!hasProjectPositioning && !hasEnteredFormData(positioningData)) {
    suggestions.push({
      id: 'project-positioning',
      title: '明确作品定位',
      description: '补充类型赛道、读者与一句话卖点，让后续设定和正文有清晰方向。',
      actionLabel: '打开作品定位',
      targetView: 'positioning',
    })
  }
  if (!hasEnteredFormData(worldbaseData)) {
    suggestions.push({
      id: 'world-setting',
      title: '搭建世界设定底稿',
      description: '先记录故事舞台与不可违反的规则；细节可以随着写作继续补充。',
      actionLabel: '打开世界设定',
      targetView: 'worldbase',
    })
  }
  if (projectVolumes.length === 0) {
    suggestions.push({
      id: 'first-volume',
      title: '建立第一卷',
      description: '先创建一个分卷，后续章节就能归入作品的真实结构。',
      actionLabel: '打开章节总表',
      targetView: 'chapter-master',
    })
  }
  if (projectChapters.length === 0) {
    suggestions.push({
      id: 'first-chapter',
      title: '写下第一章',
      description: '进入正文编辑器开始创作；本清单不会替你创建或改写章节。',
      actionLabel: '打开正文编辑',
      targetView: 'editor',
    })
  }

  return suggestions
}
