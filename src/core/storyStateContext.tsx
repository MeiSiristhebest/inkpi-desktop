import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from 'react'
import type { StoryState } from '../domain/story'
import { indexedDbStoryStateStore } from '../adapters/indexedDbStoryStateStore'
import type { StoryStateStore } from '../ports/storyStateStore'
import { domainChangeEvents } from '../ports/domainChangeEvents'

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
  const storyStateRef = useRef<StoryState | undefined>(undefined)
  const updateQueueRef = useRef<Promise<void>>(Promise.resolve())
  const reloadPromiseRef = useRef<Promise<void> | null>(null)
  const workspaceSession = useMemo(() => ({ workspaceId }), [workspaceId])
  const workspaceSessionRef = useRef(workspaceSession)
  const operationId = useRef(0)

  const reloadStoryState = useCallback(async () => {
    if (workspaceSessionRef.current !== workspaceSession) return
    const currentOperation = ++operationId.current
    const reloadPromise = (async () => {
      if (!workspaceId) {
        storyStateRef.current = undefined
        setStoryState(undefined)
        setIsLoading(false)
        setError(null)
        return
      }

      setIsLoading(true)
      setError(null)
      try {
        const loaded = await store.load(workspaceId)
        if (
          currentOperation !== operationId.current ||
          workspaceSessionRef.current !== workspaceSession
        )
          return
        storyStateRef.current = loaded
        setStoryState(loaded)
      } catch (cause) {
        if (
          currentOperation !== operationId.current ||
          workspaceSessionRef.current !== workspaceSession
        )
          return
        storyStateRef.current = undefined
        setStoryState(undefined)
        setError(toError(cause))
      } finally {
        if (
          currentOperation === operationId.current &&
          workspaceSessionRef.current === workspaceSession
        ) {
          setIsLoading(false)
        }
      }
    })()
    reloadPromiseRef.current = reloadPromise
    await reloadPromise
    if (reloadPromiseRef.current === reloadPromise) reloadPromiseRef.current = null
  }, [store, workspaceId, workspaceSession])

  useLayoutEffect(() => {
    workspaceSessionRef.current = workspaceSession
    storyStateRef.current = undefined
    updateQueueRef.current = Promise.resolve()
    reloadPromiseRef.current = null
  }, [workspaceSession])

  useEffect(() => {
    storyStateRef.current = undefined
    setStoryState(undefined)
    setError(null)
    void reloadStoryState()
    return () => {
      operationId.current += 1
    }
  }, [reloadStoryState])

  useEffect(() => {
    if (!workspaceId) return
    let reloadTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleReload = () => {
      if (reloadTimer) clearTimeout(reloadTimer)
      reloadTimer = setTimeout(() => {
        reloadTimer = null
        void reloadStoryState()
      }, 50)
    }
    const unsubscribe = domainChangeEvents.subscribe(workspaceId, scheduleReload)
    return () => {
      unsubscribe()
      if (reloadTimer) clearTimeout(reloadTimer)
    }
  }, [reloadStoryState, workspaceId])

  const saveStoryState = useCallback(
    async (nextState: StoryState) => {
      if (!workspaceId) throw new Error('Cannot save StoryState without a workspace id')
      if (workspaceSessionRef.current !== workspaceSession) return
      const currentOperation = ++operationId.current
      setError(null)
      try {
        await store.save(workspaceId, nextState)
        if (
          currentOperation !== operationId.current ||
          workspaceSessionRef.current !== workspaceSession
        )
          return
        storyStateRef.current = nextState
        setStoryState(nextState)
        setIsLoading(false)
      } catch (cause) {
        if (
          currentOperation === operationId.current &&
          workspaceSessionRef.current === workspaceSession
        ) {
          setError(toError(cause))
          setIsLoading(false)
        }
        throw cause
      }
    },
    [store, workspaceId, workspaceSession],
  )

  const updateStoryState = useCallback(
    async (next: StoryState | StoryStateUpdater) => {
      const targetWorkspaceSession = workspaceSession
      const queued = updateQueueRef.current.then(async () => {
        if (workspaceSessionRef.current !== targetWorkspaceSession) return
        const pendingReload = reloadPromiseRef.current
        if (pendingReload) await pendingReload
        if (workspaceSessionRef.current !== targetWorkspaceSession) return
        const current = storyStateRef.current
        const nextState = typeof next === 'function' ? next(current) : next
        await saveStoryState(nextState)
      })
      updateQueueRef.current = queued.catch(() => undefined)
      await queued
    },
    [saveStoryState, workspaceSession],
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
