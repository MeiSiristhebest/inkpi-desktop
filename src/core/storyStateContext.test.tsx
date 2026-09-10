import { createRef, forwardRef, useImperativeHandle } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  createProvenance,
  createStoryEntity,
  createStoryState,
  type StoryState,
} from '../domain/story'
import { domainChangeEvents } from '../ports/domainChangeEvents'
import { StoryStateProvider, useStoryState } from './storyStateContext'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

interface StateProbeHandle {
  runUpdate: () => Promise<void>
  runConcurrentUpdates: () => Promise<void>
}

const StateProbe = forwardRef<StateProbeHandle>(function StateProbe(_props, ref) {
  const { storyState, isLoading, error, updateStoryState } = useStoryState()
  useImperativeHandle(
    ref,
    () => ({
      runUpdate: async () => {
        await updateStoryState((current) => ({
          ...(current ?? createStoryState()),
          revision: (current?.revision ?? 0) + 1,
        }))
      },
      runConcurrentUpdates: async () => {
        await Promise.all([
          updateStoryState((current) => addEntity(current, 'first')),
          updateStoryState((current) => addEntity(current, 'second')),
        ])
      },
    }),
    [updateStoryState],
  )
  return (
    <>
      <span data-testid="loading">{isLoading ? 'loading' : 'idle'}</span>
      <span data-testid="revision">{storyState?.revision ?? 'empty'}</span>
      <span data-testid="entities">
        {Object.keys(storyState?.entities ?? {})
          .sort()
          .join(',')}
      </span>
      <span data-testid="error">{error?.message ?? ''}</span>
      <button
        data-testid="update"
        onClick={() =>
          updateStoryState((current) => ({
            ...(current ?? createStoryState()),
            revision: (current?.revision ?? 0) + 1,
          }))
        }
      >
        update
      </button>
    </>
  )
})

function createStore(load: (workspaceId: string) => Promise<StoryState | undefined>) {
  return {
    load: vi.fn(load),
    save: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
  }
}

function createCasStore(initial: StoryState) {
  let persisted = structuredClone(initial)
  const store = {
    load: vi.fn(async () => structuredClone(persisted)),
    save: vi.fn(async (_workspaceId: string, nextState: StoryState) => {
      await Promise.resolve()
      if (nextState.revision <= persisted.revision) {
        throw new Error(`revision conflict: ${nextState.revision}`)
      }
      persisted = structuredClone(nextState)
    }),
    remove: vi.fn(async () => undefined),
  }
  return { store, read: () => persisted }
}

function addEntity(current: StoryState | undefined, id: string): StoryState {
  const base = current ?? createStoryState()
  return {
    ...base,
    revision: base.revision + 1,
    entities: {
      ...base.entities,
      [id]: createStoryEntity({
        id,
        kind: 'character',
        name: id,
        provenance: createProvenance({ sourceType: 'author', factLevel: 'canonical-fact' }),
      }),
    },
  }
}

describe('StoryStateProvider', () => {
  it('loads the project-scoped state and persists functional updates locally', async () => {
    const initial = createStoryState(3)
    const store = createStore(async (workspaceId) =>
      workspaceId === 'project-a' ? initial : undefined,
    )

    render(
      <StoryStateProvider workspaceId="project-a" store={store}>
        <StateProbe />
      </StoryStateProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('revision')).toHaveTextContent('3'))
    expect(store.load).toHaveBeenCalledWith('project-a')

    fireEvent.click(screen.getByTestId('update'))
    await waitFor(() => expect(screen.getByTestId('revision')).toHaveTextContent('4'))
    expect(store.save).toHaveBeenCalledWith('project-a', expect.objectContaining({ revision: 4 }))
  })

  it('serializes concurrent functional updates against the latest CAS revision', async () => {
    const { store, read } = createCasStore(createStoryState())
    const handle = createRef<StateProbeHandle>()

    render(
      <StoryStateProvider workspaceId="project-a" store={store}>
        <StateProbe ref={handle} />
      </StoryStateProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('revision')).toHaveTextContent('0'))
    await act(async () => {
      await handle.current!.runConcurrentUpdates()
    })

    await waitFor(() => expect(screen.getByTestId('revision')).toHaveTextContent('2'))
    expect(screen.getByTestId('entities')).toHaveTextContent('first,second')
    expect(store.save.mock.calls.map(([, state]) => (state as StoryState).revision)).toEqual([1, 2])
    expect(read()).toMatchObject({
      revision: 2,
      entities: expect.objectContaining({ first: expect.anything(), second: expect.anything() }),
    })
  })

  it('does not flush queued updates into a workspace after switching', async () => {
    const firstSave = deferred<void>()
    const saves: Array<{ workspaceId: string; revision: number }> = []
    const store = {
      load: vi.fn(async (workspaceId: string) =>
        createStoryState(workspaceId === 'project-a' ? 1 : 10),
      ),
      save: vi.fn(async (workspaceId: string, nextState: StoryState) => {
        saves.push({ workspaceId, revision: nextState.revision })
        if (workspaceId === 'project-a') await firstSave.promise
      }),
      remove: vi.fn(async () => undefined),
    }
    const handle = createRef<StateProbeHandle>()
    const { rerender } = render(
      <StoryStateProvider workspaceId="project-a" store={store}>
        <StateProbe ref={handle} />
      </StoryStateProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('revision')).toHaveTextContent('1'))
    const first = handle.current!.runUpdate()
    await waitFor(() => expect(store.save).toHaveBeenCalledTimes(1))
    const second = handle.current!.runUpdate()

    rerender(
      <StoryStateProvider workspaceId="project-b" store={store}>
        <StateProbe ref={handle} />
      </StoryStateProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('revision')).toHaveTextContent('10'))

    firstSave.resolve()
    await act(async () => {
      await Promise.all([first, second])
    })

    expect(saves).toEqual([{ workspaceId: 'project-a', revision: 2 }])
    expect(screen.getByTestId('revision')).toHaveTextContent('10')
  })

  it('discards stale loads when switching projects', async () => {
    const firstLoad = deferred<StoryState | undefined>()
    const secondLoad = deferred<StoryState | undefined>()
    const store = createStore((workspaceId) =>
      workspaceId === 'project-a' ? firstLoad.promise : secondLoad.promise,
    )
    const { rerender } = render(
      <StoryStateProvider workspaceId="project-a" store={store}>
        <StateProbe />
      </StoryStateProvider>,
    )

    rerender(
      <StoryStateProvider workspaceId="project-b" store={store}>
        <StateProbe />
      </StoryStateProvider>,
    )
    await act(async () => {
      firstLoad.resolve(createStoryState(1))
      await Promise.resolve()
    })
    expect(screen.getByTestId('revision')).toHaveTextContent('empty')

    await act(async () => {
      secondLoad.resolve(createStoryState(2))
    })
    await waitFor(() => expect(screen.getByTestId('revision')).toHaveTextContent('2'))
    expect(store.load).toHaveBeenNthCalledWith(1, 'project-a')
    expect(store.load).toHaveBeenNthCalledWith(2, 'project-b')
  })

  it('exposes load failures without crashing the workspace', async () => {
    const store = createStore(async () => {
      throw new Error('indexeddb unavailable')
    })

    render(
      <StoryStateProvider workspaceId="project-a" store={store}>
        <StateProbe />
      </StoryStateProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('indexeddb unavailable'))
    expect(screen.getByTestId('revision')).toHaveTextContent('empty')
    expect(screen.getByTestId('loading')).toHaveTextContent('idle')
  })

  it('reloads the authoritative state after a domain change event', async () => {
    let current = createStoryState(1)
    const store = createStore(async () => current)

    render(
      <StoryStateProvider workspaceId="project-a" store={store}>
        <StateProbe />
      </StoryStateProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('revision')).toHaveTextContent('1'))
    current = createStoryState(2)
    act(() => domainChangeEvents.publish('project-a'))

    await waitFor(() => expect(screen.getByTestId('revision')).toHaveTextContent('2'))
    expect(store.load).toHaveBeenCalledWith('project-a')
  })
})
