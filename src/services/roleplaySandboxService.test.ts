import { describe, expect, it } from 'vitest'
import type { RoleplaySession } from '../domain/roleplay/roleplaySession'
import type { Clock } from '../ports/clock'
import type { IdGenerator } from '../ports/idGenerator'
import type { RoleplaySessionRepository } from '../ports/roleplaySessionRepository'
import { RoleplaySandboxService } from './roleplaySandboxService'

class MemoryRoleplaySessionRepository implements RoleplaySessionRepository {
  readonly records = new Map<string, RoleplaySession>()

  async listByProject(projectId: string): Promise<RoleplaySession[]> {
    return [...this.records.values()].filter((session) => session.projectId === projectId)
  }

  async get(id: string): Promise<RoleplaySession | undefined> {
    const session = this.records.get(id)
    return session ? structuredClone(session) : undefined
  }

  async save(session: RoleplaySession): Promise<void> {
    this.records.set(session.id, structuredClone(session))
  }

  async delete(id: string): Promise<void> {
    this.records.delete(id)
  }
}

function createHarness() {
  const repository = new MemoryRoleplaySessionRepository()
  let id = 0
  let now = 100
  const ids: IdGenerator = { generate: (prefix) => `${prefix}-${++id}` }
  const clock: Clock = { now: () => now++ }
  return {
    repository,
    service: new RoleplaySandboxService({ sessions: repository, ids, clock }),
  }
}

describe('RoleplaySandboxService', () => {
  it('durably records the user turn before task execution and completes it as sandbox chat', async () => {
    const { repository, service } = createHarness()
    const created = await service.createSession('project-a')

    const pending = await service.beginTurn('project-a', created.id, '我推开石门。')

    expect(repository.records.get(created.id)).toMatchObject({
      turnStatus: 'running',
      pendingTurnId: pending.pendingTurnId,
      messages: [{ role: 'user', text: '我推开石门。' }],
    })
    const completed = await service.completeTurn(
      'project-a',
      created.id,
      pending.pendingTurnId!,
      '门后传来一阵脚步声。',
    )
    expect(completed).toMatchObject({
      turnStatus: 'ready',
      messages: [
        { role: 'user', text: '我推开石门。' },
        { role: 'assistant', text: '门后传来一阵脚步声。' },
      ],
    })
    expect(completed.pendingTurnId).toBeUndefined()
  })

  it('recovers interrupted requests and keeps the same task id for retry', async () => {
    const { repository, service } = createHarness()
    const created = await service.createSession('project-a')
    const pending = await service.beginTurn('project-a', created.id, '尝试逃出迷宫。')
    await repository.save({ ...pending, turnStatus: 'running' })

    const [recovered] = await service.listSessions('project-a')
    expect(recovered).toMatchObject({
      turnStatus: 'interrupted',
      pendingTurnId: pending.pendingTurnId,
      lastError: expect.any(String),
    })

    const retried = await service.retryPendingTurn('project-a', created.id)
    expect(retried.pendingTurnId).toBe(pending.pendingTurnId)
    expect(retried.turnStatus).toBe('running')
  })

  it('marks failures recoverable and requires explicit abandonment before another turn', async () => {
    const { service } = createHarness()
    const created = await service.createSession('project-a')
    const pending = await service.beginTurn('project-a', created.id, '寻找出口。')
    const failed = await service.failTurn('project-a', created.id, pending.pendingTurnId!)

    expect(failed.turnStatus).toBe('failed')
    await expect(service.beginTurn('project-a', created.id, '继续前进。')).rejects.toThrow(
      'Retry or explicitly skip',
    )

    const abandoned = await service.abandonPendingTurn('project-a', created.id)
    expect(abandoned.turnStatus).toBe('ready')
    expect(abandoned.messages).toHaveLength(1)
    expect(abandoned.pendingTurnId).toBeUndefined()
    await expect(service.beginTurn('project-a', created.id, '继续前进。')).resolves.toMatchObject({
      turnStatus: 'running',
    })
  })

  it('isolates reads, writes, and deletion by project ownership', async () => {
    const { repository, service } = createHarness()
    const session = await service.createSession('project-a')
    expect(await service.listSessions('project-b')).toEqual([])
    await expect(service.saveSession({ ...session, projectId: 'project-b' })).rejects.toThrow(
      'belongs to another project',
    )
    await service.deleteSession('project-b', session.id)
    expect(repository.records.has(session.id)).toBe(true)
    await service.deleteSession('project-a', session.id)
    expect(repository.records.has(session.id)).toBe(false)
  })
})
