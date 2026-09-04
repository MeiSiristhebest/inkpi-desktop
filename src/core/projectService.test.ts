import { describe, it, expect, afterEach } from 'vitest'
import { db } from '../db/indexedDB'
import {
  createProject,
  createDemoProject,
  loadWorkspaceStats,
  loadStatsForProjects,
} from './projectService'
import type { ProjectRecord, VolumeRecord, ChapterRecord } from '../types'

const seed = async (pid: string, wordsByChapter: number[], recent: boolean = true) => {
  await db.put<ProjectRecord>('projects', {
    id: pid,
    name: pid,
    genre: '仙侠修真',
    intro: '',
    createdAt: 1,
    updatedAt: 1,
  })
  const vid = `v-${pid}`
  await db.put<VolumeRecord>('volumes', { id: vid, projectId: pid, title: 'V', order: 0, createdAt: 1, updatedAt: 1 })
  let i = 0
  for (const w of wordsByChapter) {
    await db.put<ChapterRecord>('chapters', {
      id: `c-${pid}-${i}`,
      projectId: pid,
      volumeId: vid,
      title: `第00${i + 1}章`,
      content: 'x',
      wordCount: w,
      order: i,
      createdAt: 1,
      updatedAt: recent ? Date.now() - 1000 : Date.now() - 1000 * 60 * 60 * 24 * 30, // recent=true 时近期更新
    })
    i++
  }
}

afterEach(async () => {
  for (const c of await db.getAll('chapters')) await db.delete('chapters', c.id)
  for (const v of await db.getAll('volumes')) await db.delete('volumes', v.id)
  for (const p of await db.getAll('projects')) await db.delete('projects', p.id)
})

describe('projectService — 工作区聚合统计', () => {
  it('aggregates words/chapters across all projects for the workspace strip', async () => {
    await seed('pA', [100, 200])
    await seed('pB', [50], false) // pB 全旧，不应计入本周活跃
    const projects: ProjectRecord[] = [
      { id: 'pA', name: 'pA', genre: '仙侠修真', intro: '', createdAt: 1, updatedAt: 1 },
      { id: 'pB', name: 'pB', genre: '仙侠修真', intro: '', createdAt: 1, updatedAt: 1 },
    ]
    const ws = await loadWorkspaceStats(projects)
    expect(ws.totalWords).toBe(350)
    expect(ws.totalChapters).toBe(3)
    // pA 的第一个章节是近期更新的，本周活跃项目数 = 1
    expect(ws.activeThisWeek).toBe(1)
  })

  it('returns per-project stats keyed by projectId', async () => {
    await seed('pX', [10, 20, 30])
    const projects: ProjectRecord[] = [
      { id: 'pX', name: 'pX', genre: '仙侠修真', intro: '', createdAt: 1, updatedAt: 1 },
    ]
    const map = await loadStatsForProjects(projects)
    expect(map.pX.words).toBe(60)
    expect(map.pX.chapters).toBe(3)
    expect(map.pX.volumes).toBe(1)
  })

  it('createDemoProject seeds a usable project', async () => {
    const p = await createDemoProject()
    expect(p.name).toContain('示范')
    const ws = await loadWorkspaceStats([p])
    expect(ws.totalChapters).toBeGreaterThan(0)
  })
})
