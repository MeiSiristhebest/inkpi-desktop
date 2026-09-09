import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { StoryState } from '../domain/story'
import { createStoryState } from '../domain/story/storyState'
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

function StateProbe() {
  const { storyState, isLoading, error, updateStoryState } = useStoryState()
  return (
    <>
      <span data-testid="loading">{isLoading ? 'loading' : 'idle'}</span>
      <span data-testid="revision">{storyState?.revision ?? 'empty'}</span>
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
}

function createStore(load: (workspaceId: string) => Promise<StoryState | undefined>) {
  return {
    load: vi.fn(load),
    save: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
  }
}

describe('StoryStateProvider', () => {
  it('loads the project-scoped state and persists functional updates locally', async () => {
    const initial = createStoryState(3)
    const store = createStore(async (workspaceId) => (workspaceId === 'project-a' ? initial : undefined))

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
})
