import { afterEach, describe, expect, it } from 'vitest'
import { db } from '../db/indexedDB'
import { indexedDbGoldChaptersRepository as repository } from './indexedDbGoldChaptersRepository'
import { GoldChaptersEngine } from '../plugins/gold-chapters-eval/engine/GoldChaptersEngine'
import type { GoldChapterEvalRecord } from '../ports/goldChaptersRepository'

const oldRecord: GoldChapterEvalRecord = {
  id: 'gold-legacy-test',
  projectId: 'gold-compatibility-test',
  score: 91,
  isQualified: true,
  motiveScore: 95,
  goldFingerScore: 90,
  conflictScore: 90,
  expectationScore: 88,
  keyDiagnosis: ['historical rule output'],
  suggestions: [],
  evaluatedAt: 1,
}

afterEach(async () => {
  await db.delete('goldChapterEvals', oldRecord.id)
  await db.delete('goldChapterEvals', 'gold-evidence-test')
})

describe('opening evidence persistence compatibility', () => {
  it('round trips the new source snapshot and retains legacy records without rewriting scores', async () => {
    const snapshot = GoldChaptersEngine.evaluate('本文没有复仇。')
    const record: GoldChapterEvalRecord = {
      id: 'gold-evidence-test',
      projectId: oldRecord.projectId,
      observationSnapshot: snapshot,
      keyDiagnosis: [],
      suggestions: [],
      evaluatedAt: 2,
    }
    await repository.save(oldRecord)
    await repository.save(record)
    expect(await repository.get(oldRecord.id)).toEqual(oldRecord)
    expect(await repository.get(record.id)).toEqual(record)
    const records = await repository.getAll(oldRecord.projectId)
    expect(records).toEqual(expect.arrayContaining([oldRecord, record]))
    expect(await repository.getAll('another-project')).toEqual([])
  })
})
