import { indexedDbProjectRepository } from '../adapters/indexedDbProjectRepository'

/** Resolves the same one-based volume/chapter order used by the writing editor. */
export async function getProjectChapterNumber(
  projectId: string,
  chapterId?: string,
): Promise<number | undefined> {
  if (!chapterId) return undefined
  const [volumes, chapters] = await Promise.all([
    indexedDbProjectRepository.getVolumesByProject(projectId),
    indexedDbProjectRepository.getChaptersByProject(projectId),
  ])
  const orderedChapters = volumes
    .sort((a, b) => a.order - b.order)
    .flatMap((volume) =>
      chapters
        .filter((chapter) => chapter.volumeId === volume.id)
        .sort((a, b) => a.order - b.order),
    )
  const index = orderedChapters.findIndex((chapter) => chapter.id === chapterId)
  return index >= 0 ? index + 1 : undefined
}
