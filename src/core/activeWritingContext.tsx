import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type FC,
  type ReactNode,
} from 'react'
import type { ChapterRecord } from '../types'
import { semanticDocumentFromText, type SemanticDocument } from '../domain/content'

export interface SemanticSelection {
  from: number
  to: number
  text: string
  sourceHash?: string
}

export interface ActiveWritingContext {
  workspaceId: string
  workspaceRevision: number
  volumeId?: string
  chapter?: {
    id: string
    revision: number
    title: string
    content: string
    wordCount: number
    semanticDocument: SemanticDocument
  }
  selection?: SemanticSelection
  dirty: boolean
}

export interface ActiveWritingContextValue extends ActiveWritingContext {
  setActiveChapter: (chapter: ChapterRecord | null) => void
  setSelection: (selection?: SemanticSelection) => void
  setDirty: (dirty: boolean) => void
  setWorkspaceRevision: (revision: number) => void
}

export const ActiveWritingContextState = createContext<ActiveWritingContextValue | null>(null)

export interface ActiveWritingContextProviderProps {
  workspaceId: string
  initialVolumeId?: string
  initialChapter?: ChapterRecord | null
  initialRevision?: number
  children: ReactNode
}

export const ActiveWritingContextProvider: FC<ActiveWritingContextProviderProps> = ({
  workspaceId,
  initialVolumeId,
  initialChapter = null,
  initialRevision = 1,
  children,
}) => {
  const [workspaceRevision, setWorkspaceRevision] = useState<number>(initialRevision)
  const [activeChapterRecord, setActiveChapterRecord] = useState<ChapterRecord | null>(
    initialChapter,
  )
  const [selection, setSelection] = useState<SemanticSelection | undefined>(undefined)
  const [dirty, setDirty] = useState<boolean>(false)

  // 当 workspaceId 切换时，重置章节与选区状态，彻底杜绝跨 Workspace 状态残留 (INV-03, INV-06)
  useEffect(() => {
    setActiveChapterRecord(initialChapter)
    setSelection(undefined)
    setDirty(false)
    setWorkspaceRevision(initialRevision)
  }, [workspaceId, initialChapter, initialRevision])

  const chapter = useMemo(() => {
    if (!activeChapterRecord) return undefined
    const text = activeChapterRecord.content || ''
    return {
      id: activeChapterRecord.id,
      revision: activeChapterRecord.revision ?? 1,
      title: activeChapterRecord.title,
      content: text,
      wordCount: activeChapterRecord.wordCount ?? 0,
      semanticDocument: semanticDocumentFromText(
        activeChapterRecord.id,
        text,
        activeChapterRecord.revision ?? 1,
      ),
    }
  }, [activeChapterRecord])

  const setActiveChapter = useCallback((ch: ChapterRecord | null) => {
    setActiveChapterRecord(ch)
  }, [])

  const value: ActiveWritingContextValue = useMemo(
    () => ({
      workspaceId,
      workspaceRevision,
      volumeId: activeChapterRecord?.volumeId || initialVolumeId,
      chapter,
      selection,
      dirty,
      setActiveChapter,
      setSelection,
      setDirty,
      setWorkspaceRevision,
    }),
    [
      workspaceId,
      workspaceRevision,
      activeChapterRecord?.volumeId,
      initialVolumeId,
      chapter,
      selection,
      dirty,
      setActiveChapter,
    ],
  )

  return (
    <ActiveWritingContextState.Provider value={value}>
      {children}
    </ActiveWritingContextState.Provider>
  )
}

export function useActiveWritingContext(): ActiveWritingContextValue {
  const ctx = useContext(ActiveWritingContextState)
  if (!ctx) {
    throw new Error('useActiveWritingContext must be used within <ActiveWritingContextProvider>')
  }
  return ctx
}

export function useOptionalActiveWritingContext(): ActiveWritingContextValue | null {
  return useContext(ActiveWritingContextState)
}
