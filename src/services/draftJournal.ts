export interface DraftJournalEntry {
  workspaceId: string
  chapterId: string
  baseRevision: number
  editorContent: string
  updatedAt: number
}

const DRAFT_JOURNAL_KEY_PREFIX = 'inkpi_draft_journal:'

function getDraftKey(workspaceId: string, chapterId: string): string {
  return `${DRAFT_JOURNAL_KEY_PREFIX}${workspaceId}:${chapterId}`
}

export const draftJournal = {
  /** Record rapid unpersisted draft content */
  record(entry: DraftJournalEntry): void {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(getDraftKey(entry.workspaceId, entry.chapterId), JSON.stringify(entry))
    } catch {
      // Ignore quota errors in private browsing/full storage
    }
  },

  /** Get unpersisted draft for recovery check */
  get(workspaceId: string, chapterId: string): DraftJournalEntry | null {
    if (typeof localStorage === 'undefined') return null
    try {
      const raw = localStorage.getItem(getDraftKey(workspaceId, chapterId))
      if (!raw) return null
      return JSON.parse(raw) as DraftJournalEntry
    } catch {
      return null
    }
  },

  /** Clear draft entry once canonical persistence succeeds */
  clear(workspaceId: string, chapterId: string): void {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.removeItem(getDraftKey(workspaceId, chapterId))
    } catch {
      // ignore
    }
  },
}
