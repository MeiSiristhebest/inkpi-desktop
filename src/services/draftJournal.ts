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
  record(entry: DraftJournalEntry): boolean {
    if (typeof localStorage === 'undefined') return false
    try {
      localStorage.setItem(getDraftKey(entry.workspaceId, entry.chapterId), JSON.stringify(entry))
      return true
    } catch {
      return false
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

  /** Clear a draft only when it contains the content that just became canonical. */
  clearIfContentMatches(workspaceId: string, chapterId: string, content: string): boolean {
    if (typeof localStorage === 'undefined') return false
    const current = this.get(workspaceId, chapterId)
    if (!current || current.editorContent !== content) return false
    try {
      localStorage.removeItem(getDraftKey(workspaceId, chapterId))
      return true
    } catch {
      return false
    }
  },
}
