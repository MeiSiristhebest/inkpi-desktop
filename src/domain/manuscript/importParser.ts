export type ManuscriptFormat = 'txt' | 'md' | 'docx'

export interface ManuscriptImportChapter {
  sourceKey: string
  title: string
  content: string
  included: boolean
}

export interface ManuscriptImportVolume {
  sourceKey: string
  title: string
  chapters: ManuscriptImportChapter[]
}

export interface ManuscriptImportPreview {
  fileName: string
  format: ManuscriptFormat
  volumes: ManuscriptImportVolume[]
  warnings: string[]
}

const VOLUME_NUMBER = '[0-9０-９〇零一二三四五六七八九十百千万两]+'
const CHAPTER_NUMBER = '[0-9０-９〇零一二三四五六七八九十百千万两]+'

function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').trim() || '导入稿件'
}

function headingText(line: string): string {
  return line
    .trim()
    .replace(/^#{1,6}\s+/, '')
    .trim()
}

function isVolumeHeading(line: string): boolean {
  const text = headingText(line)
  return new RegExp(
    `^(?:第\\s*${VOLUME_NUMBER}\\s*卷|卷\\s*${VOLUME_NUMBER})(?:\\s*[:：、.．—-]\\s*|\\s+)?(?:.*)$`,
    'i',
  ).test(text)
}

function isChapterHeading(line: string): string | undefined {
  const text = headingText(line)
  const match = text.match(
    new RegExp(
      `^(第\\s*${CHAPTER_NUMBER}\\s*[章节回集篇])(?:\\s*[:：、.．—-]\\s*|\\s+)?(.*)$`,
      'i',
    ),
  )
  if (match) return [match[1].replace(/\s+/g, ''), match[2].trim()].filter(Boolean).join(' ')

  const englishMatch = text.match(/^chapter\s+\d+(?:\s*[:：.．—-]\s*|\s+)?(.*)$/i)
  if (englishMatch) return text.trim()
  return undefined
}

function volumeTitle(line: string): string {
  return headingText(line)
}

function contentFromLines(lines: string[]): string {
  return lines.join('\n').trim()
}

/**
 * Convert a plain-text manuscript into an editable import preview.
 * The parser deliberately recognizes explicit chapter/volume headings only;
 * ordinary numbered list items are not promoted into chapters.
 */
export function parseManuscriptText(
  text: string,
  options: { fileName: string; format: ManuscriptFormat },
): ManuscriptImportPreview {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  if (!normalized.trim()) throw new Error('文件中没有可导入的正文。')

  const defaultVolumeTitle = baseName(options.fileName)
  const volumes: ManuscriptImportVolume[] = []
  let activeVolume: ManuscriptImportVolume | undefined
  let activeChapter: { title: string; lines: string[] } | undefined
  let preludeLines: string[] = []
  let explicitChapterCount = 0
  let explicitVolumeCount = 0

  const ensureVolume = (): ManuscriptImportVolume => {
    if (!activeVolume) {
      activeVolume = {
        sourceKey: `volume-${volumes.length + 1}`,
        title: defaultVolumeTitle,
        chapters: [],
      }
      volumes.push(activeVolume)
    }
    return activeVolume
  }

  const addChapter = (title: string, content: string) => {
    const volume = ensureVolume()
    volume.chapters.push({
      sourceKey: `${volume.sourceKey}-chapter-${volume.chapters.length + 1}`,
      title: title.trim() || `第${volume.chapters.length + 1}章`,
      content,
      included: true,
    })
  }

  const flushActiveChapter = () => {
    if (!activeChapter) return
    addChapter(activeChapter.title, contentFromLines(activeChapter.lines))
    activeChapter = undefined
  }

  const flushPrelude = (title: string) => {
    const content = contentFromLines(preludeLines)
    preludeLines = []
    if (content) addChapter(title, content)
  }

  for (const line of normalized.split('\n')) {
    if (isVolumeHeading(line)) {
      flushActiveChapter()
      if (contentFromLines(preludeLines)) {
        ensureVolume()
        flushPrelude(explicitChapterCount > 0 ? '序章' : '第1章')
      } else {
        preludeLines = []
      }
      activeVolume = {
        sourceKey: `volume-${volumes.length + 1}`,
        title: volumeTitle(line),
        chapters: [],
      }
      volumes.push(activeVolume)
      explicitVolumeCount += 1
      continue
    }

    const parsedChapterTitle = isChapterHeading(line)
    if (parsedChapterTitle !== undefined) {
      flushActiveChapter()
      if (contentFromLines(preludeLines)) {
        ensureVolume()
        flushPrelude('序章')
      } else {
        preludeLines = []
      }
      ensureVolume()
      activeChapter = { title: parsedChapterTitle, lines: [] }
      explicitChapterCount += 1
      continue
    }

    if (activeChapter) activeChapter.lines.push(line)
    else preludeLines.push(line)
  }

  flushActiveChapter()
  if (contentFromLines(preludeLines)) {
    if (explicitChapterCount > 0) {
      ensureVolume()
      flushPrelude('序章')
    } else {
      ensureVolume()
      flushPrelude('第1章')
    }
  }

  const nonEmptyVolumes = volumes.filter((volume) => volume.chapters.length > 0)
  if (nonEmptyVolumes.length === 0) {
    throw new Error('没有找到可导入的正文；请检查文件内容或章节标题格式。')
  }

  const warnings: string[] = []
  if (explicitChapterCount === 0) {
    warnings.push('未识别到章节标题；每个分卷的正文会合并为一个章节。')
  }
  if (options.format === 'md') {
    warnings.push('Markdown 标记不会转换为富文本格式，会按纯正文导入。')
  }
  if (explicitVolumeCount === 0) {
    nonEmptyVolumes[0].title = defaultVolumeTitle
  }

  return {
    fileName: options.fileName,
    format: options.format,
    volumes: nonEmptyVolumes,
    warnings,
  }
}
