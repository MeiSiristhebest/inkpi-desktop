import { db } from '../db/indexedDB'
import type { IronChamberRecord, IronChamberRepository } from '../ports/ironChamberRepository'

export const indexedDbIronChamberRepository: IronChamberRepository = {
  async getAll(projectId: string): Promise<IronChamberRecord[]> {
    return db.getByIndex<IronChamberRecord>('ironChamberRecords', 'projectId', projectId)
  },

  async getActive(projectId: string): Promise<IronChamberRecord | undefined> {
    const scoped = await db.getByIndex<IronChamberRecord>(
      'ironChamberRecords',
      'projectId',
      projectId,
    )
    return scoped.find((r) => r.status === 'locked')
  },

  async get(id: string): Promise<IronChamberRecord | undefined> {
    return await db.get<IronChamberRecord>('ironChamberRecords', id)
  },

  async save(record: IronChamberRecord): Promise<void> {
    await db.put('ironChamberRecords', record)
  },

  async startSession(record: IronChamberRecord): Promise<void> {
    if (!record.projectId.trim() || record.status !== 'locked')
      throw new Error('专注会话记录无效。')
    await db.runTransaction(['ironChamberRecords'], (transaction, fail) => {
      const store = transaction.objectStore('ironChamberRecords')
      const request = store.index('projectId').getAll(record.projectId)
      request.onerror = () => fail(request.error ?? new Error('会话读取失败。'))
      request.onsuccess = () => {
        try {
          if (
            (request.result as IronChamberRecord[]).some((existing) => existing.status === 'locked')
          )
            throw new Error('本项目已有进行中的会话，请先结束。')
          store.add(record)
        } catch (error) {
          fail(error)
        }
      }
    })
  },

  async finishSession(record: IronChamberRecord): Promise<void> {
    if (!['completed', 'emergency_abort'].includes(record.status)) throw new Error('结束状态无效。')
    await db.runTransaction(['ironChamberRecords'], (transaction, fail) => {
      const store = transaction.objectStore('ironChamberRecords')
      const request = store.get(record.id)
      request.onerror = () => fail(request.error ?? new Error('会话读取失败。'))
      request.onsuccess = () => {
        try {
          const existing = request.result as IronChamberRecord | undefined
          if (!existing || existing.projectId !== record.projectId || existing.status !== 'locked')
            throw new Error('会话不存在或已由其他窗口结束。')
          store.put(record)
        } catch (error) {
          fail(error)
        }
      }
    })
  },

  async delete(id: string): Promise<void> {
    await db.delete('ironChamberRecords', id)
  },
}
