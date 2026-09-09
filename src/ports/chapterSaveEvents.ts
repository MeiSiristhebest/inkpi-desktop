import type { ChapterRecord } from '../types'

export interface ChapterSavedEvent {
  chapter: ChapterRecord
}

type ChapterSavedListener = (event: ChapterSavedEvent) => void

const listeners = new Set<ChapterSavedListener>()

/** In-process boundary for consumers that react to a successful chapter save. */
export const chapterSaveEvents = {
  publish(chapter: ChapterRecord): void {
    const event = { chapter: { ...chapter } }
    for (const listener of listeners) listener(event)
  },

  subscribe(listener: ChapterSavedListener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}
