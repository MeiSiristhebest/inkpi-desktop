import {
  parseManuscriptText,
  type ManuscriptImportPreview,
} from '../domain/manuscript/importParser'
import {
  extractLocalDocumentText,
  MAX_LOCAL_DOCUMENT_FILE_BYTES,
  MAX_LOCAL_DOCUMENT_TEXT_CHARACTERS,
} from './localDocumentText'

export const MAX_MANUSCRIPT_FILE_BYTES = MAX_LOCAL_DOCUMENT_FILE_BYTES
export const MAX_MANUSCRIPT_TEXT_CHARACTERS = MAX_LOCAL_DOCUMENT_TEXT_CHARACTERS

/** Read supported files locally and return an editable preview; no upload is performed. */
export async function loadManuscriptFile(file: File): Promise<ManuscriptImportPreview> {
  if (file.size > MAX_MANUSCRIPT_FILE_BYTES) {
    throw new Error('稿件文件不能超过 20 MB。')
  }

  const extracted = await extractLocalDocumentText(file)
  const preview = parseManuscriptText(extracted.text, {
    fileName: extracted.fileName,
    format: extracted.format,
  })
  return { ...preview, warnings: [...extracted.warnings, ...preview.warnings] }
}
