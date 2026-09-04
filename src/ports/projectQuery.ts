import type { ProjectRecord, VolumeRecord, ChapterRecord } from '../types'

/**
 * 项目仓储「读」端口（ISP）。
 *
 * 只声明查询类能力，调用方（如写作面板 hook、统计服务）按需依赖此窄端口，
 * 而不必拉入写能力，满足接口隔离原则（评审 §5.1）。
 */
export interface ProjectQueryPort {
  getAllProjects(): Promise<ProjectRecord[]>
  getProject(id: string): Promise<ProjectRecord | undefined>

  getAllVolumes(): Promise<VolumeRecord[]>
  getVolumesByProject(projectId: string): Promise<VolumeRecord[]>

  getAllChapters(): Promise<ChapterRecord[]>
  getChaptersByProject(projectId: string): Promise<ChapterRecord[]>
}
