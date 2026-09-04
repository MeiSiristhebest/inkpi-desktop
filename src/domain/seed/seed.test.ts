import { describe, it, expect } from 'vitest'
import { buildSeedVolumes, buildSeedChapters } from '../seed'

describe('seed builders — 首次启动卷章种子', () => {
  it('buildSeedVolumes returns two project-scoped volumes with unique dynamic ids', () => {
    const vols = buildSeedVolumes('p-x')
    expect(vols).toHaveLength(2)
    expect(vols.every((v) => v.projectId === 'p-x')).toBe(true)
    // ID 由注入的 IdGenerator 生成，不再硬编码 'vol-1'，避免多项目互相覆盖
    expect(vols[0].id).toMatch(/^vol-/)
    expect(vols[1].id).toMatch(/^vol-/)
    expect(vols[0].id).not.toBe(vols[1].id)
  })

  it('buildSeedChapters returns three chapters with HTML content attached to the first volume', () => {
    const vols = buildSeedVolumes('p-x')
    const chs = buildSeedChapters('p-x', vols[0].id)
    expect(chs).toHaveLength(3)
    expect(chs[0].title).toBe('第001章 寒潭惊变')
    expect(chs[0].content).toContain('<p>')
    expect(chs[0].projectId).toBe('p-x')
    // 章节通过 firstVolumeId 正确挂到第一卷，保持 章节 → 卷 的从属关系
    expect(chs[0].volumeId).toBe(vols[0].id)
    expect(chs.every((c) => c.volumeId === vols[0].id)).toBe(true)
  })

  it('buildSeedChapters without a volume id still produces a valid chapter list', () => {
    const chs = buildSeedChapters('p-y')
    expect(chs).toHaveLength(3)
    expect(chs[0].projectId).toBe('p-y')
  })
})
