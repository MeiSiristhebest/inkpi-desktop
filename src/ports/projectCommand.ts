import type { ProjectRecord, VolumeRecord, ChapterRecord } from '../types'

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

  saveChapter(chapter: ChapterRecord): Promise<void>
  deleteChapter(id: string): Promise<void>
}
