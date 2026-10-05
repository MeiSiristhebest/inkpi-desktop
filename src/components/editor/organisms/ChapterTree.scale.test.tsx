import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ChapterTree } from './ChapterTree'

/**
 * 1000 章是本项目的规模基线（见 src/db/scaleBaseline.test.ts 的「一部长篇约 1000 章」）。
 * 目录树每章都会挂一个 Tooltip 门面实例，而实测每个实例在 jsdom 里约 0.37 ms 挂载成本、
 * 关闭态不产出 DOM 节点——所以这里断言的是「每章最多一个触发器」这个可数事实，
 * 不测时长（时长在 CI 上会漂）。曾经每行有 4 个触发器，1000 章多花 1.4 s。
 */
const VOL_COUNT = 5
const PER_VOL = 200
const CHAPTER_TOTAL = VOL_COUNT * PER_VOL

function modelStub() {
  const volumes = Array.from({ length: VOL_COUNT }, (_, v) => ({
    id: `v${v}`,
    title: `第${v + 1}卷`,
    order: v,
    projectId: 'p1',
  }))
  const chapters = Array.from({ length: CHAPTER_TOTAL }, (_, i) => ({
    id: `c${i}`,
    title: `第${String(i + 1).padStart(3, '0')}章 章节标题`,
    volumeId: `v${Math.floor(i / PER_VOL)}`,
    order: i,
    status: 'draft',
    wordCount: 3200,
    content: '',
    projectId: 'p1',
    revision: 1,
  }))
  const actions = {
    setTreeQuery: () => {},
    toggleVolume: () => {},
    newChapter: () => {},
    newVolume: () => {},
    selectChapter: () => {},
    setRenamingChapter: () => {},
    setRenamingTitle: () => {},
    setChapterContextMenu: () => {},
    setSidebar: () => {},
  }
  return {
    expanded: {},
    treeQuery: '',
    activeChapterId: chapters[0].id,
    chapterNumberMap: new Map(chapters.map((c, i) => [c.id, i + 1])),
    actions,
    filteredVolumes: volumes.map((vol) => ({
      vol,
      chs: chapters.filter((c) => c.volumeId === vol.id),
      total: PER_VOL,
    })),
  }
}

describe('ChapterTree · 1000 章规模基线', () => {
  it('每章恰好一个提示触发器：全部行都有，且不随行内元素翻倍', () => {
    render(<ChapterTree model={modelStub() as never} />)
    const triggers = document.querySelectorAll('[data-base-ui-tooltip-trigger]').length
    // 行触发器 = 章节数；面板头部 3 个操作 + 标题 + 手柄、每卷 2 个新建入口是常数。
    expect(triggers).toBeGreaterThanOrEqual(CHAPTER_TOTAL)
    expect(triggers).toBeLessThanOrEqual(CHAPTER_TOTAL + VOL_COUNT * 4 + 8)
  })
})
