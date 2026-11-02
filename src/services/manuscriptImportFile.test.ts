import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadManuscriptFile, MAX_MANUSCRIPT_FILE_BYTES } from './manuscriptImportFile'

const extractRawText = vi.hoisted(() => vi.fn())
vi.mock('mammoth', () => ({ extractRawText }))

describe('loadManuscriptFile', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('parses TXT locally without uploading or changing text content', async () => {
    const file = new File(['ignored by the stub'], 'novel.txt', { type: 'text/plain' })
    Object.defineProperty(file, 'text', { value: async () => '第1章 开始\n正文内容' })

    const result = await loadManuscriptFile(file)

    expect(result.format).toBe('txt')
    expect(result.volumes[0].chapters[0]).toMatchObject({
      title: '第1章 开始',
      content: '正文内容',
    })
  })

  it('extracts DOCX text in-browser and reports formatting loss and parser warnings', async () => {
    const file = new File(['zip bytes'], 'novel.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    const arrayBuffer = new ArrayBuffer(8)
    Object.defineProperty(file, 'arrayBuffer', { value: async () => arrayBuffer })
    extractRawText.mockResolvedValueOnce({
      value: '第1章 开始\n正文内容',
      messages: [{ type: 'warning', message: 'An unsupported element was ignored.' }],
    })

    const result = await loadManuscriptFile(file)

    expect(extractRawText).toHaveBeenCalledWith({ arrayBuffer })
    expect(result.format).toBe('docx')
    expect(result.warnings).toEqual([
      'DOCX 仅提取文字；版式、图片和表格结构等非正文元素不会保留。',
      'DOCX 提示：An unsupported element was ignored.',
    ])
    expect(result.volumes[0].chapters[0].content).toBe('正文内容')
  })

  it('rejects unsupported formats and files over the documented size limit', async () => {
    const unsupported = new File(['text'], 'novel.doc')
    await expect(loadManuscriptFile(unsupported)).rejects.toThrow(
      '仅支持 TXT、Markdown（.md）和 DOCX 文件。',
    )

    const oversized = new File(['text'], 'novel.txt')
    Object.defineProperty(oversized, 'size', { value: MAX_MANUSCRIPT_FILE_BYTES + 1 })
    await expect(loadManuscriptFile(oversized)).rejects.toThrow('稿件文件不能超过 20 MB。')
  })
})
