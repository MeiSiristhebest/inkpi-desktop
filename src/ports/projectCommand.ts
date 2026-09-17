import type { ProjectRecord, VolumeRecord, ChapterRecord } from '../types'

export interface SaveChapterCasOptions {
  chapter: ChapterRecord
  expectedRevision: number
}

export interface SaveChapterCasResult {
  success: boolean
  conflict: boolean
  currentRevision?: number
  error?: string
}

/**
 * 项目仓储「写」端口（ISP）。
 *
 * 只声明写入类能力，调用方（如 projectService）按需依赖此窄端口，
 * 满足接口隔离原则（评审 §5.1）。
 */
export interface ProjectCommandPort {
  saveProject(project: ProjectRecord): Promise<void>
  deleteProject(id: string): Promise<void>

  saveVolume(volume: VolumeRecord): Promise<void>
  deleteVolume(id: string): Promise<void>
  /** 原子级联删除分卷：在单个数据库事务内完成分卷删除及子章节迁移或删除 */
  deleteVolumeCascade?(workspaceId: string, volumeId: string, fallbackVolumeId?: string): Promise<void>

  saveChapter(chapter: ChapterRecord): Promise<void>
  /** 原子比较并交换写入章节，底层同一事务保证修订版本 CAS 校验通过才写入 */
  saveChapterCAS?(options: SaveChapterCasOptions): Promise<SaveChapterCasResult>
  deleteChapter(id: string): Promise<void>
}
