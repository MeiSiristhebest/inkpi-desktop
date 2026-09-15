import { describe, it, expect } from 'vitest'
import { createTaskScope, resolveTaskScope } from './taskScope'
import { buildDurableTaskId } from './durableTaskId'

describe('TaskScope & Durable Task ID (P0.9 - P0.13)', () => {
  it('enforces non-empty workspaceId on TaskScope creation (INV-03, INV-06)', () => {
    expect(() =>
      createTaskScope({
        workspaceId: '',
      }),
    ).toThrow(/workspaceId/)

    const scope = createTaskScope({
      workspaceId: 'proj-123',
      workspaceRevision: 42,
      documentId: 'ch-1',
      documentRevision: 2,
      selection: { from: 10, to: 20 },
    })

    expect(scope.workspaceId).toBe('proj-123')
    expect(scope.workspaceRevision).toBe(42)
    expect(scope.document?.id).toBe('ch-1')
    expect(scope.document?.revision).toBe(2)
    expect(scope.selection?.from).toBe(10)
  })

  it('safely resolves TaskScope from legacy or mixed payloads', () => {
    const scope = resolveTaskScope({
      projectId: 'proj-legacy',
      chapterId: 'ch-5',
      revision: 3,
    })

    expect(scope.workspaceId).toBe('proj-legacy')
    expect(scope.document?.id).toBe('ch-5')
    expect(scope.document?.revision).toBe(3)
  })

  it('builds formatted durable task ID avoiding global static name collisions (P0.13)', () => {
    const id = buildDurableTaskId({
      workspaceId: 'proj_123',
      operation: 'distill',
      sourceFingerprint: 'a8d32f123456',
      instance: 'chunk-3',
    })

    expect(id).toBe('proj_123:distill:a8d32f1234:chunk-3')
  })
})
