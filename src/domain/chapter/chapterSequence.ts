import type { ChapterRecord, VolumeRecord } from '../../types'

export type PositionedChapter = ChapterRecord & { chapterNumber: number | null }

/** Uses the writer's volume order followed by the chapter order within each volume. */
export function projectChapterSequence(
  projectId: string,
  chapters: ChapterRecord[],
  volumes: VolumeRecord[],
): PositionedChapter[] {
  const projectChapters = chapters.filter((chapter) => chapter.projectId === projectId)
  const sortedVolumes = volumes
    .filter((volume) => volume.projectId === projectId)
    .sort((a, b) => a.order - b.order)
  const sequence = sortedVolumes.flatMap((volume) =>
    projectChapters
      .filter((chapter) => chapter.volumeId === volume.id)
      .sort((a, b) => a.order - b.order),
  )
  const included = new Set(sequence.map((chapter) => chapter.id))
  return [
    ...sequence.map((chapter, index) => ({ ...chapter, chapterNumber: index + 1 })),
    ...projectChapters
      .filter((chapter) => !included.has(chapter.id))
      .map((chapter) => ({ ...chapter, chapterNumber: null })),
  ]
}

export function latestPositionedChapterNumber(chapters: PositionedChapter[]): number {
  return chapters.reduce((latest, chapter) => Math.max(latest, chapter.chapterNumber ?? 0), 0)
}
