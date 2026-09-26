import { describe, it, expect, afterEach, vi } from 'vitest'
import { db } from '../db/indexedDB'
import { blobFileDownloader } from '../adapters/blobFileDownloader'
import {
  createProject,
  createDemoProject,
  loadWorkspaceStats,
  loadStatsForProjects,
  loadProjects,
  loadArchivedProjects,
  removeProjectFromLibrary,
  restoreProjectToLibrary,
  deleteProject,
  exportProject,
  exportManuscript,
} from './projectService'
import type { ProjectRecord, VolumeRecord, ChapterRecord } from '../types'
import type { NewProjectForm } from '../domain/project/projectDefaults'
import { LEAN_PLUGIN_IDS, RECOMMENDED_PLUGIN_IDS } from '../domain/project/projectDefaults'
import { loadEnabledPluginIdsFromIDB } from './pluginRegistry'

/** 新建项目表单的一次提交：测试只覆盖自己关心的那几项，其余走面板同款默认值 */
const form = (over: Partial<NewProjectForm> = {}): NewProjectForm => ({
  name: '未命名',
  genre: '',
  intro: '',
  cover: '',
  starter: 'blank',
  tooling: 'recommended',
  customPluginIds: [],
  ...over,
})

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
  await db.put<VolumeRecord>('volumes', {
    id: vid,
    projectId: pid,
    title: 'V',
    order: 0,
    createdAt: 1,
    updatedAt: 1,
  })
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
  for (const c of await db.getAll<ChapterRecord>('chapters')) await db.delete('chapters', c.id)
  for (const v of await db.getAll<VolumeRecord>('volumes')) await db.delete('volumes', v.id)
  for (const p of await db.getAll<ProjectRecord>('projects')) await db.delete('projects', p.id)
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

  it('带上上次打开的章节，让书架说得出继续写哪一章（P1.3）', async () => {
    await seed('pR', [10, 20, 30])
    localStorage.setItem('inkpi_last_active_chapter:pR', 'c-pR-1')
    const projects: ProjectRecord[] = [
      { id: 'pR', name: 'pR', genre: '仙侠修真', intro: '', createdAt: 1, updatedAt: 1 },
    ]

    const map = await loadStatsForProjects(projects)
    expect(map.pR.resumeChapterTitle).toBe('第002章')

    // 指针指向已被删除的章节时不编造，回到通用文案（与编辑器自己的处理一致）
    localStorage.setItem('inkpi_last_active_chapter:pR', 'c-deleted')
    const stale = await loadStatsForProjects(projects)
    expect(stale.pR.resumeChapterTitle).toBeUndefined()
    localStorage.removeItem('inkpi_last_active_chapter:pR')
  })

  it('createProject defaults to pure blank project (INV-05)', async () => {
    const p = await createProject(
      form({ name: '纯净新书', genre: '科幻灵异', intro: '一本完全崭新的小说' }),
    )
    expect(p.templateType).toBe('blank')
    const [volumes, chapters] = await Promise.all([
      db.getAll<VolumeRecord>('volumes'),
      db.getAll<ChapterRecord>('chapters'),
    ])
    const pVols = volumes.filter((v) => v.projectId === p.id)
    const pChs = chapters.filter((c) => c.projectId === p.id)
    expect(pVols).toHaveLength(1)
    expect(pVols[0].title).toBe('正文卷')
    expect(pChs).toHaveLength(1)
    expect(pChs[0].title).toBe('第1章')
    expect(pChs[0].content).toBe('<p></p>')
    expect(pChs[0].wordCount).toBe(0)
  })

  it('createDemoProject seeds a usable project with demo content', async () => {
    const p = await createDemoProject()
    expect(p.name).toContain('示范')
    expect(p.templateType).toBe('demo')
    const ws = await loadWorkspaceStats([p])
    expect(ws.totalChapters).toBe(3)
  })
})

describe('projectService — 新建表单上的每个选择都要在数据层留下差别（§P3.6）', () => {
  it('封面进项目记录，而不是停在面板里当预览', async () => {
    const p = await createProject(form({ name: '有封面的书', cover: 'data:image/png;base64,AAAA' }))

    expect(p.cover).toBe('data:image/png;base64,AAAA')
    expect((await db.get<ProjectRecord>('projects', p.id))?.cover).toBe(
      'data:image/png;base64,AAAA',
    )
  })

  it('没有上传封面时不写空字符串，卡片才会走「暂无封面」而不是一块空白', async () => {
    const p = await createProject(form({ name: '没封面的书' }))
    expect(p.cover).toBeUndefined()
  })

  it.each([
    ['lite', LEAN_PLUGIN_IDS],
    ['recommended', RECOMMENDED_PLUGIN_IDS],
  ] as const)('%s 组合把这套工具写进这本书自己的域', async (combo, ids) => {
    const p = await createProject(form({ name: `工具组合-${combo}`, tooling: combo }))

    expect(p.projectType).toBe(combo === 'lite' ? 'lite' : 'full')
    expect(await loadEnabledPluginIdsFromIDB(p.id)).toEqual(new Set(ids))
  })

  it('自定义组合原样落库，并留下认得出它的 projectType', async () => {
    const p = await createProject(
      form({ name: '自己挑', tooling: 'custom', customPluginIds: ['living-codex', 'press-forge'] }),
    )

    expect(p.projectType).toBe('custom')
    expect(await loadEnabledPluginIdsFromIDB(p.id)).toEqual(
      new Set(['living-codex', 'press-forge']),
    )
  })

  it('两本书的工具开关互不继承', async () => {
    const lean = await createProject(form({ name: '精简本', tooling: 'lite' }))
    const full = await createProject(form({ name: '全用本', tooling: 'recommended' }))

    const leanIds = await loadEnabledPluginIdsFromIDB(lean.id)
    expect(leanIds.has('sprint-arena')).toBe(false)
    expect((await loadEnabledPluginIdsFromIDB(full.id)).has('sprint-arena')).toBe(true)
  })

  it('留空的题材记成未分类，而不是替作者编一个东方玄幻', async () => {
    const p = await createProject(form({ name: '还没想好题材' }))
    expect(p.genre).toBe('未分类')
  })
})

describe('projectService — 移出作品库与永久删除是两条独立路径（P0.8 / INV-04）', () => {
  it('移出作品库只隐藏书架条目，卷章数据一条不少', async () => {
    const p = await createProject(form({ name: '暂时收起来', genre: '都市' }))
    const chapters = await db.getAll<ChapterRecord>('chapters')
    const volumes = await db.getAll<VolumeRecord>('volumes')

    await removeProjectFromLibrary(p.id)

    expect((await loadProjects()).map((x) => x.id)).not.toContain(p.id)
    const archived = await loadArchivedProjects()
    expect(archived.map((x) => x.id)).toContain(p.id)
    expect(archived.find((x) => x.id === p.id)?.archivedAt).toBeGreaterThan(0)

    // 关键：移出后持久化数据仍在真实 store 里，而不是被顺手清掉
    expect((await db.getAll<ProjectRecord>('projects')).find((x) => x.id === p.id)).toBeDefined()
    expect(
      (await db.getAll<ChapterRecord>('chapters')).filter((c) => c.projectId === p.id),
    ).toHaveLength(chapters.filter((c) => c.projectId === p.id).length)
    expect(
      (await db.getAll<VolumeRecord>('volumes')).filter((v) => v.projectId === p.id),
    ).toHaveLength(volumes.filter((v) => v.projectId === p.id).length)
  })

  it('放回书架后重新出现在 loadProjects，archivedAt 被清空', async () => {
    const p = await createProject(form({ name: '再写一本', genre: '科幻' }))
    await removeProjectFromLibrary(p.id)
    await restoreProjectToLibrary(p.id)

    expect((await loadProjects()).map((x) => x.id)).toContain(p.id)
    expect((await loadArchivedProjects()).map((x) => x.id)).not.toContain(p.id)
    expect((await db.get<ProjectRecord>('projects', p.id))?.archivedAt).toBeNull()
  })

  it('永久删除才会真正清除 projects 记录与级联卷章', async () => {
    const p = await createProject(form({ name: '彻底删掉', genre: '历史' }))
    await deleteProject(p.id)

    expect(await db.get('projects', p.id)).toBeUndefined()
    expect(
      (await db.getAll<ChapterRecord>('chapters')).filter((c) => c.projectId === p.id),
    ).toHaveLength(0)
    expect(
      (await db.getAll<VolumeRecord>('volumes')).filter((v) => v.projectId === p.id),
    ).toHaveLength(0)
  })
})

describe('projectService — 两种导出的范围必须不同（P0.6 / INV-04）', () => {
  it('完整备份含领域数据，纯正文导出只有卷章与项目元数据', async () => {
    const p = await createProject(form({ name: '双导出', genre: '玄幻' }))
    await db.put('codexEntities', {
      id: `ent-${p.id}`,
      projectId: p.id,
      name: '林凡',
      category: 'character',
    })

    const downloads: { filename: string; blob: Blob }[] = []
    const spy = vi
      .spyOn(blobFileDownloader, 'downloadBlob')
      .mockImplementation((filename: string, blob: Blob) => {
        downloads.push({ filename, blob })
      })

    try {
      await exportProject(p.id)
      await exportManuscript(p.id)
    } finally {
      spy.mockRestore()
      await db.delete('codexEntities', `ent-${p.id}`)
    }

    expect(downloads).toHaveLength(2)
    const [backup, manuscript] = downloads
    expect(backup.filename).toContain('-workspace-backup-')
    expect(manuscript.filename).toContain('-manuscript-')

    const backupJson = JSON.parse(await backup.blob.text())
    const manuscriptJson = JSON.parse(await manuscript.blob.text())

    expect(backupJson.manifest.archiveType).toBe('inkpi-workspace-backup')
    expect(Object.keys(backupJson.domainData ?? {})).toContain('codexEntities')

    expect(manuscriptJson.manifest.archiveType).toBe('manuscript-export')
    expect(manuscriptJson.domainData).toBeUndefined()
    expect(manuscriptJson.localStorageData).toBeUndefined()
    expect(manuscriptJson.chapters.length).toBeGreaterThan(0)
    // 正文导出不得夹带别的作品
    expect(manuscriptJson.volumes.every((v: VolumeRecord) => v.projectId === p.id)).toBe(true)
  })
})
