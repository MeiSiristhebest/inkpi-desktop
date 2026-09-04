// 项目默认业务值（评审 §1.6）：从 Bookshelf 视图外移到领域。

export type ProjectType = 'full' | 'custom'

/** 新建项目时按类型给出的默认题材 */
export const defaultGenreFor = (projectType: ProjectType): string =>
  projectType === 'full' ? '东方玄幻' : '自定义'
