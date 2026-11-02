import { describe, expect, it } from 'vitest'
import { parseManuscriptText } from './importParser'

describe('parseManuscriptText', () => {
  it('splits explicit markdown volume and chapter headings in source order', () => {
    const preview = parseManuscriptText(
      '# 第一卷：初遇\n\n## 第一章 风雪\n北风呼啸。\n\n## 第二章：归来\n主角回家。\n\n# 第二卷 星火\n\n第十章 夜行\n灯火渐远。',
      { fileName: 'novel.md', format: 'md' },
    )

    expect(preview.volumes).toHaveLength(2)
    expect(preview.volumes.map((volume) => volume.title)).toEqual(['第一卷：初遇', '第二卷 星火'])
    expect(preview.volumes[0].chapters.map(({ title, content }) => ({ title, content }))).toEqual([
      { title: '第一章 风雪', content: '北风呼啸。' },
      { title: '第二章 归来', content: '主角回家。' },
    ])
    expect(preview.volumes[1].chapters[0]).toMatchObject({
      title: '第十章 夜行',
      content: '灯火渐远。',
      included: true,
    })
    expect(preview.warnings).toContain('Markdown 标记不会转换为富文本格式，会按纯正文导入。')
  })

  it('imports unstructured text as one chapter and warns that no heading was recognized', () => {
    const preview = parseManuscriptText('第一行\n第二行', {
      fileName: '草稿.txt',
      format: 'txt',
    })

    expect(preview.volumes).toHaveLength(1)
    expect(preview.volumes[0].title).toBe('草稿')
    expect(preview.volumes[0].chapters).toMatchObject([
      { title: '第1章', content: '第一行\n第二行', included: true },
    ])
    expect(preview.warnings).toContain('未识别到章节标题；每个分卷的正文会合并为一个章节。')
  })

  it('keeps front matter instead of dropping it when chapter headings follow', () => {
    const preview = parseManuscriptText('作品简介\n主角踏上旅途。\n\n第1章 开始\n正文', {
      fileName: 'story.txt',
      format: 'txt',
    })

    expect(preview.volumes[0].chapters.map(({ title, content }) => ({ title, content }))).toEqual([
      { title: '序章', content: '作品简介\n主角踏上旅途。' },
      { title: '第1章 开始', content: '正文' },
    ])
  })

  it('does not mistake ordinary numbered list entries for chapter headings', () => {
    const preview = parseManuscriptText('1. 开始\n2. 发展', {
      fileName: 'notes.txt',
      format: 'txt',
    })

    expect(preview.volumes[0].chapters).toMatchObject([
      { title: '第1章', content: '1. 开始\n2. 发展' },
    ])
  })

  it('rejects empty input', () => {
    expect(() =>
      parseManuscriptText('\uFEFF \r\n', { fileName: 'empty.txt', format: 'txt' }),
    ).toThrow('文件中没有可导入的正文。')
  })
})
