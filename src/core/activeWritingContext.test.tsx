import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { FC, ReactNode } from 'react'
import {
  ActiveWritingContextProvider,
  useActiveWritingContext,
  useOptionalActiveWritingContext,
} from './activeWritingContext'
import { domainChangeEvents } from '../ports/domainChangeEvents'
import type { ChapterRecord } from '../types'

// The provider constructs IndexedDbDomainChangeStore itself inside its effects, so the store is
// the only external I/O here; the domain event channel is exercised for real to prove the
// subscription wiring, not just the reducer.
const { latestRevision } = vi.hoisted(() => ({ latestRevision: vi.fn() }))
vi.mock('../adapters/indexedDbDomainChangeStore', () => ({
  IndexedDbDomainChangeStore: class {
    latestRevision = latestRevision
  },
}))

const chapter: ChapterRecord = {
  id: 'ch-1',
  projectId: 'ws-a',
  volumeId: 'vol-1',
  title: '第一章',
  content: '正文内容',
  order: 0,
  wordCount: 4,
  revision: 3,
  createdAt: 1,
  updatedAt: 1,
}

function renderAWC(workspaceId: string) {
  const wrapper: FC<{ children: ReactNode }> = ({ children }) => (
    <ActiveWritingContextProvider workspaceId={workspaceId}>
      {children}
    </ActiveWritingContextProvider>
  )
  return renderHook(() => useActiveWritingContext(), { wrapper })
}

describe('ActiveWritingContextProvider', () => {
  beforeEach(() => {
    latestRevision.mockReset()
  })

  it('hydrates the workspace revision from the durable journal head', async () => {
    latestRevision.mockResolvedValue(7)
    const { result } = renderAWC('ws-a')

    await waitFor(() => expect(result.current.workspaceRevision).toBe(7))
    expect(latestRevision).toHaveBeenCalledWith('ws-a')
  })

  it('never lets the initial revision regress below the journal head', async () => {
    // The provider starts optimistic at initialRevision=1; the max() guard is what stops a lagging
    // durable read from dropping the author back a revision.
    latestRevision.mockResolvedValue(0)
    const { result } = renderAWC('ws-a')

    await waitFor(() => expect(latestRevision).toHaveBeenCalled())
    expect(result.current.workspaceRevision).toBe(1)
  })

  it('keeps the initial revision for a blank workspace and skips the journal read', () => {
    const { result } = renderAWC('   ')

    expect(result.current.workspaceRevision).toBe(1)
    expect(latestRevision).not.toHaveBeenCalled()
  })

  it('falls back to the initial revision when the journal read rejects', async () => {
    latestRevision.mockRejectedValue(new Error('quota'))
    const { result } = renderAWC('ws-a')

    await waitFor(() => expect(latestRevision).toHaveBeenCalled())
    expect(result.current.workspaceRevision).toBe(1)
  })

  it('advances monotonically on published domain events and ignores a stale revision', async () => {
    latestRevision.mockResolvedValue(5)
    const { result } = renderAWC('ws-a')
    await waitFor(() => expect(result.current.workspaceRevision).toBe(5))

    act(() => {
      domainChangeEvents.publish('ws-a', 9)
    })
    expect(result.current.workspaceRevision).toBe(9)

    // A late-arriving older change must not walk the revision backwards.
    act(() => {
      domainChangeEvents.publish('ws-a', 3)
    })
    expect(result.current.workspaceRevision).toBe(9)
  })

  it('re-reads the journal head when an event carries no revision', async () => {
    latestRevision.mockResolvedValue(5)
    const { result } = renderAWC('ws-a')
    await waitFor(() => expect(result.current.workspaceRevision).toBe(5))

    latestRevision.mockResolvedValue(12)
    act(() => {
      domainChangeEvents.publish('ws-a')
    })

    await waitFor(() => expect(result.current.workspaceRevision).toBe(12))
  })

  it('ignores events published for a different workspace', async () => {
    latestRevision.mockResolvedValue(5)
    const { result } = renderAWC('ws-a')
    await waitFor(() => expect(result.current.workspaceRevision).toBe(5))

    act(() => {
      domainChangeEvents.publish('ws-b', 99)
    })
    expect(result.current.workspaceRevision).toBe(5)
  })

  it('derives the semantic chapter projection and reacts to setActiveChapter', () => {
    latestRevision.mockResolvedValue(1)
    const { result } = renderAWC('ws-a')

    expect(result.current.chapter).toBeUndefined()

    act(() => {
      result.current.setActiveChapter(chapter)
    })

    expect(result.current.chapter?.id).toBe('ch-1')
    expect(result.current.chapter?.wordCount).toBe(4)
    expect(result.current.chapter?.semanticDocument).toBeDefined()
    // volumeId is sourced from the active chapter so the AI surfaces target the right volume.
    expect(result.current.volumeId).toBe('vol-1')
  })

  it('exposes selection and dirty writers', () => {
    latestRevision.mockResolvedValue(1)
    const { result } = renderAWC('ws-a')

    act(() => {
      result.current.setSelection({ from: 0, to: 2, text: '正文' })
      result.current.setDirty(true)
    })

    expect(result.current.selection).toEqual({ from: 0, to: 2, text: '正文' })
    expect(result.current.dirty).toBe(true)
  })

  it('resets selection and dirty when the workspace switches', async () => {
    latestRevision.mockResolvedValue(1)
    // The provider is keyed by a closure variable so rerender() re-renders the tree with a new
    // workspaceId, which is what triggers the provider's reset effect.
    let currentWorkspaceId = 'ws-a'
    const wrapper: FC<{ children: ReactNode }> = ({ children }) => (
      <ActiveWritingContextProvider workspaceId={currentWorkspaceId}>
        {children}
      </ActiveWritingContextProvider>
    )
    const { result, rerender } = renderHook(() => useActiveWritingContext(), { wrapper })

    act(() => {
      result.current.setSelection({ from: 0, to: 1, text: 'a' })
      result.current.setDirty(true)
    })
    expect(result.current.dirty).toBe(true)

    currentWorkspaceId = 'ws-b'
    act(() => {
      rerender({})
    })

    await waitFor(() => expect(result.current.workspaceId).toBe('ws-b'))
    expect(result.current.dirty).toBe(false)
    expect(result.current.selection).toBeUndefined()
    expect(result.current.chapter).toBeUndefined()
  })

  it('guards direct hook usage outside the provider', () => {
    expect(() => renderHook(() => useActiveWritingContext())).toThrow(
      /useActiveWritingContext must be used within/,
    )

    const { result } = renderHook(() => useOptionalActiveWritingContext())
    expect(result.current).toBeNull()
  })
})
