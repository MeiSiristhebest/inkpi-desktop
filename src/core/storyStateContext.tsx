import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from 'react'
import type { StoryState } from '../domain/story'
import { indexedDbStoryStateStore } from '../adapters/indexedDbStoryStateStore'
import type { StoryStateStore } from '../ports/storyStateStore'

export type StoryStateUpdater = (current: StoryState | undefined) => StoryState

export interface StoryStateContextValue {
  workspaceId: string | null
  storyState: StoryState | undefined
  isLoading: boolean
  error: Error | null
  reloadStoryState: () => Promise<void>
  saveStoryState: (state: StoryState) => Promise<void>
  updateStoryState: (next: StoryState | StoryStateUpdater) => Promise<void>
}

export interface StoryStateProviderProps {
  /** Desktop projectId is the workspace key for authoritative local StoryState. */
  workspaceId: string | null
  store?: StoryStateStore
  children: ReactNode
}

const StoryStateContext = createContext<StoryStateContextValue | null>(null)

export const StoryStateProvider: FC<StoryStateProviderProps> = ({
  workspaceId,
  store = indexedDbStoryStateStore,
  children,
}) => {
  const [storyState, setStoryState] = useState<StoryState | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const operationId = useRef(0)

  const reloadStoryState = useCallback(async () => {
    const currentOperation = ++operationId.current
    if (!workspaceId) {
      setStoryState(undefined)
      setIsLoading(false)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const loaded = await store.load(workspaceId)
      if (currentOperation !== operationId.current) return
      setStoryState(loaded)
    } catch (cause) {
      if (currentOperation !== operationId.current) return
      setStoryState(undefined)
      setError(toError(cause))
    } finally {
      if (currentOperation === operationId.current) setIsLoading(false)
    }
  }, [store, workspaceId])

  useEffect(() => {
    setStoryState(undefined)
    setError(null)
    void reloadStoryState()
    return () => {
      operationId.current += 1
    }
  }, [reloadStoryState])

  const saveStoryState = useCallback(
    async (nextState: StoryState) => {
      if (!workspaceId) throw new Error('Cannot save StoryState without a workspace id')
      const currentOperation = ++operationId.current
      setError(null)
      try {
        await store.save(workspaceId, nextState)
        if (currentOperation !== operationId.current) return
        setStoryState(nextState)
        setIsLoading(false)
      } catch (cause) {
        if (currentOperation === operationId.current) {
          setError(toError(cause))
          setIsLoading(false)
        }
        throw cause
      }
    },
    [store, workspaceId],
  )

  const updateStoryState = useCallback(
    async (next: StoryState | StoryStateUpdater) => {
      const nextState = typeof next === 'function' ? next(storyState) : next
      await saveStoryState(nextState)
    },
    [saveStoryState, storyState],
  )

  const value = useMemo<StoryStateContextValue>(
    () => ({
      workspaceId,
      storyState,
      isLoading,
      error,
      reloadStoryState,
      saveStoryState,
      updateStoryState,
    }),
    [workspaceId, storyState, isLoading, error, reloadStoryState, saveStoryState, updateStoryState],
  )

  return <StoryStateContext.Provider value={value}>{children}</StoryStateContext.Provider>
}

export function useStoryState(): StoryStateContextValue {
  const context = useContext(StoryStateContext)
  if (!context) {
    throw new Error('useStoryState 必须在 <StoryStateProvider> 内使用')
  }
  return context
}

export function useOptionalStoryState(): StoryStateContextValue | null {
  return useContext(StoryStateContext)
}

function toError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause))
}
