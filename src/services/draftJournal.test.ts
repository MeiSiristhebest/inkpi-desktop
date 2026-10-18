import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { draftJournal, type DraftJournalEntry } from './draftJournal'

const entry: DraftJournalEntry = {
  workspaceId: 'workspace-1',
  chapterId: 'chapter-1',
  baseRevision: 1,
  editorContent: '<p>draft</p>',
  updatedAt: 10,
}

describe('draftJournal', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('reports when a local recovery draft cannot be recorded', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage full')
    })

    expect(draftJournal.record(entry)).toBe(false)
  })

  it('does not clear a newer draft when an older save completes', () => {
    const newer = { ...entry, editorContent: '<p>newer</p>', updatedAt: 11 }
    draftJournal.record(entry)
    draftJournal.record(newer)

    expect(
      draftJournal.clearIfContentMatches(entry.workspaceId, entry.chapterId, entry.editorContent),
    ).toBe(false)
    expect(draftJournal.get(entry.workspaceId, entry.chapterId)).toEqual(newer)
  })
})
