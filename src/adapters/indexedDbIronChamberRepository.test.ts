import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/indexedDB'
import { indexedDbIronChamberRepository as repository } from './indexedDbIronChamberRepository'
import type { IronChamberRecord } from '../ports/ironChamberRepository'
const session = (id: string, projectId = 'p'): IronChamberRecord => ({
  id,
  projectId,
  chapterId: 'chapter',
  measurementUnit: 'unicode_non_whitespace',
  mode: 'words',
  targetWords: 10,
  targetMinutes: 0,
  startWords: 1,
  currentWords: 1,
  pledgedAt: 1,
  status: 'locked',
})
beforeEach(async () => {
  for (const record of await db.getAll<IronChamberRecord>('ironChamberRecords'))
    await repository.delete(record.id)
})
describe('Focus session transactional lifecycle', () => {
  it('allows exactly one concurrent active session per project and keeps projects separate', async () => {
    const results = await Promise.allSettled([
      repository.startSession(session('one')),
      repository.startSession(session('two')),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    expect(
      (await repository.getAll('p')).filter((record) => record.status === 'locked'),
    ).toHaveLength(1)
    await repository.startSession(session('foreign', 'other'))
    expect((await repository.getActive('other'))?.id).toBe('foreign')
  })
  it('does not overwrite a session already finished by another window', async () => {
    const record = session('one')
    await repository.startSession(record)
    await repository.finishSession({ ...record, status: 'emergency_abort' })
    await expect(repository.finishSession({ ...record, status: 'completed' })).rejects.toThrow(
      '已由其他窗口结束',
    )
    expect((await repository.get('one'))?.status).toBe('emergency_abort')
    await repository.startSession(session('replacement'))
    expect((await repository.getActive('p'))?.id).toBe('replacement')
  })
})
