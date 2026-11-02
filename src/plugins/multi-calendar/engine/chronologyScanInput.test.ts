import { describe, expect, it } from 'vitest'
import {
  buildChronologyScanInput,
  MAX_CHRONOLOGY_SCAN_CHARACTERS_PER_CHAPTER,
  MAX_CHRONOLOGY_SCAN_CHAPTERS,
  type ChronologyScanChapter,
} from './chronologyScanInput'

function chapter(index: number, content: string, revision = 1): ChronologyScanChapter {
  return {
    id: `chapter-${index}`,
    revision,
    order: index,
    title: `第${index}章`,
    content,
  }
}

describe('buildChronologyScanInput', () => {
  it('projects rich-text chapters to semantic text before sampling', () => {
    const result = buildChronologyScanInput([chapter(1, '<p>第一年启程。</p><p>冬日归来。</p>')])

    expect(result.input['chapter:chapter-1@revision:1:1']).toBe(
      '第 1 章《第1章》：\n第一年启程。\n冬日归来。',
    )
  })

  it('does not invent a whole-book number for a chapter without a volume position', () => {
    const unplaced = { ...chapter(3, '独立资料'), order: null }
    const result = buildChronologyScanInput([unplaced])

    expect(result.input['chapter:chapter-3@revision:1:1']).toBe('章节位置未知《第3章》：\n独立资料')
  })

  it('records omitted chapters and per-chapter truncation in the submitted scope', () => {
    const chapters = Array.from({ length: MAX_CHRONOLOGY_SCAN_CHAPTERS + 1 }, (_, index) =>
      chapter(index + 1, '甲'.repeat(index === 0 ? 300 : 20), 7),
    )

    const result = buildChronologyScanInput(chapters)
    const scope = result.input.scanScope as Record<string, unknown>
    const sourceFields = Object.keys(result.input).filter((key) => key.startsWith('chapter:'))

    expect(sourceFields).toHaveLength(MAX_CHRONOLOGY_SCAN_CHAPTERS)
    expect(result.sampledChapterCount).toBe(MAX_CHRONOLOGY_SCAN_CHAPTERS)
    expect(scope).toMatchObject({
      totalChapterCount: MAX_CHRONOLOGY_SCAN_CHAPTERS + 1,
      sampledChapterCount: MAX_CHRONOLOGY_SCAN_CHAPTERS,
      omittedChapterCount: 1,
      truncatedChapterCount: 1,
      chapterSampling: 'evenly-spaced',
      perChapterCharacterLimit: MAX_CHRONOLOGY_SCAN_CHARACTERS_PER_CHAPTER,
      complete: false,
    })
    expect(result.input['chapter:chapter-1@revision:7:1']).toEqual(
      `第 1 章《第1章》：\n${'甲'.repeat(MAX_CHRONOLOGY_SCAN_CHARACTERS_PER_CHAPTER)}`,
    )
    expect(result.input['chapter:chapter-16@revision:7:15']).toContain('第16章')
    expect(result.scopeLabel).toContain('15/16 章')
    expect(result.scopeLabel).toContain('另有 1 章未提供')
    expect(result.scopeLabel).toContain('1 章只提供前 250 个字符')
  })

  it('changes the review input when a sampled chapter revision changes', () => {
    const chapters = Array.from({ length: MAX_CHRONOLOGY_SCAN_CHAPTERS * 2 + 1 }, (_, index) =>
      chapter(index + 1, `第${index + 1}章的时间线索`, index === 30 ? 3 : 1),
    )
    const revised = chapters.map((item) =>
      item.id === 'chapter-31' ? { ...item, revision: 4 } : item,
    )
    const before = buildChronologyScanInput(chapters)
    const after = buildChronologyScanInput(revised)

    expect(before.input).not.toEqual(after.input)
    expect(after.input['chapter:chapter-31@revision:4:15']).toContain('第31章的时间线索')
  })

  it('samples non-empty chapters evenly across the full reading order', () => {
    const chapters = Array.from({ length: MAX_CHRONOLOGY_SCAN_CHAPTERS * 2 + 1 }, (_, index) =>
      chapter(index + 1, `第${index + 1}章的时间线索`),
    )

    const result = buildChronologyScanInput(chapters)
    const sampledOrders = Object.keys(result.input)
      .filter((key) => key.startsWith('chapter:'))
      .map((key) => Number(key.match(/^chapter:chapter-(\d+)@/)?.[1]))
    const gaps = sampledOrders.slice(1).map((order, index) => order - sampledOrders[index])

    expect(sampledOrders).toHaveLength(MAX_CHRONOLOGY_SCAN_CHAPTERS)
    expect(sampledOrders[0]).toBe(1)
    expect(sampledOrders).toContain(16)
    expect(sampledOrders.at(-1)).toBe(31)
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(2)
    expect(Math.max(...gaps)).toBeLessThanOrEqual(3)
    expect(result.input.scanScope).toMatchObject({
      consideredChapterCount: 31,
      sampledChapterCount: 15,
      omittedChapterCount: 16,
      chapterSampling: 'evenly-spaced',
      complete: false,
    })
    expect(result.scopeLabel).toContain('15/31 章')
    expect(result.scopeLabel).toContain('从全文范围均匀抽样')
  })

  it('skips empty chapters so later chapters with text can still be reviewed', () => {
    const chapters = [
      ...Array.from({ length: MAX_CHRONOLOGY_SCAN_CHAPTERS }, (_, index) =>
        chapter(index + 1, '<p></p>'),
      ),
      chapter(MAX_CHRONOLOGY_SCAN_CHAPTERS + 1, '城门在第三日开启。'),
    ]

    const result = buildChronologyScanInput(chapters)
    const scope = result.input.scanScope as Record<string, unknown>

    expect(result.sampledChapterCount).toBe(1)
    expect(scope).toMatchObject({
      totalChapterCount: MAX_CHRONOLOGY_SCAN_CHAPTERS + 1,
      consideredChapterCount: MAX_CHRONOLOGY_SCAN_CHAPTERS + 1,
      sampledChapterCount: 1,
      omittedChapterCount: 0,
      emptyChapterCount: MAX_CHRONOLOGY_SCAN_CHAPTERS,
      complete: false,
    })
    expect(
      result.input[`chapter:chapter-${MAX_CHRONOLOGY_SCAN_CHAPTERS + 1}@revision:1:1`],
    ).toContain('城门在第三日开启。')
    expect(result.scopeLabel).toContain(`1/${MAX_CHRONOLOGY_SCAN_CHAPTERS + 1} 章`)
    expect(result.scopeLabel).toContain(`${MAX_CHRONOLOGY_SCAN_CHAPTERS} 章没有可分析的正文`)
  })

  it('does not enable a scan when the considered chapters have no body text', () => {
    const result = buildChronologyScanInput([chapter(1, '<p></p>')])

    expect(result.sampledChapterCount).toBe(0)
    expect(result.scopeLabel).toContain('没有可分析的章节正文')
    expect(Object.keys(result.input).filter((key) => key.startsWith('chapter:'))).toEqual([])
  })
})
