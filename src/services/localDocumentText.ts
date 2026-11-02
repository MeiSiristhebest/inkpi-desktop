import type { ManuscriptFormat } from '../domain/manuscript/importParser'

export const MAX_LOCAL_DOCUMENT_FILE_BYTES = 20 * 1024 * 1024
export const MAX_LOCAL_DOCUMENT_TEXT_CHARACTERS = 5_000_000

export interface ExtractedLocalDocumentText {
  fileName: string
  format: ManuscriptFormat
  text: string
  warnings: string[]
}

export function localDocumentFormatForFileName(fileName: string): ManuscriptFormat {
  const extension = fileName.split('.').at(-1)?.toLowerCase()
  if (extension === 'txt') return 'txt'
  if (extension === 'md' || extension === 'markdown') return 'md'
  if (extension === 'docx') return 'docx'
  throw new Error('仅支持 TXT、Markdown（.md）和 DOCX 文件。')
}

/** Extract document text locally. No file bytes are uploaded or sent to an AI provider here. */
export async function extractLocalDocumentText(file: File): Promise<ExtractedLocalDocumentText> {
  if (file.size > MAX_LOCAL_DOCUMENT_FILE_BYTES) {
    throw new Error('文件不能超过 20 MB。')
  }

  const format = localDocumentFormatForFileName(file.name)
  let text: string
  const warnings: string[] = []

  if (format === 'docx') {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    text = result.value
    warnings.push('DOCX 仅提取文字；版式、图片和表格结构等非正文元素不会保留。')
    for (const message of result.messages) {
      if (message.type === 'warning') warnings.push(`DOCX 提示：${message.message}`)
    }
  } else {
    text = await file.text()
  }

  if (text.length > MAX_LOCAL_DOCUMENT_TEXT_CHARACTERS) {
    throw new Error('提取出的正文超过 500 万字符，暂不支持导入。')
  }

  return { fileName: file.name, format, text, warnings }
}
