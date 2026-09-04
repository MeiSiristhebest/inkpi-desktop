import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../../src/db/indexedDB'
import type { ChapterRecord, VolumeRecord } from '../../../src/types'

describe('Tier 1: F4, F5, F6 - Tenant Data Isolation & Namespace Enforcement', () => {
  const projA = 'proj-tenant-isolate-aaa'
  const projB = 'proj-tenant-isolate-bbb'

  beforeEach(async () => {
    const codex = await db.getAll<any>('codexEntities')
    for (const c of codex) {
      if (c.id) await db.delete('codexEntities', c.id)
    }
  })

  it('TC-ISO-01: Composite primary key enforcement prevents collisions for identical entity IDs', async () => {
    const rawId = 'hero-char-001'
    const keyA = `${projA}::${rawId}`
    const keyB = `${projB}::${rawId}`

    await db.put('codexEntities', {
      id: keyA,
      projectId: projA,
      name: '楚凌霄',
      category: 'character',
      summary: 'Project A Protagonist',
      updatedAt: Date.now(),
    })

    await db.put('codexEntities', {
      id: keyB,
      projectId: projB,
      name: '林踏天',
      category: 'character',
      summary: 'Project B Protagonist',
      updatedAt: Date.now(),
    })

    const entityA = await db.get<any>('codexEntities', keyA)
    const entityB = await db.get<any>('codexEntities', keyB)

    expect(entityA).toBeDefined()
    expect(entityB).toBeDefined()
    expect(entityA.name).toBe('楚凌霄')
    expect(entityB.name).toBe('林踏天')
    expect(entityA.projectId).toBe(projA)
    expect(entityB.projectId).toBe(projB)
  })

  it('TC-ISO-02: Eradication of permissive matching (!record.projectId): Querying Project A rejects unassigned & foreign records', async () => {
    // Seed records: one for A, one for B, one defective record without projectId
    const idA = `${projA}::codex-1`
    const idB = `${projB}::codex-2`
    const idDefective = `unassigned::codex-3`

    await db.put('codexEntities', {
      id: idA,
      projectId: projA,
      name: '青云宗',
      category: 'faction',
    })
    await db.put('codexEntities', {
      id: idB,
      projectId: projB,
      name: '天魔教',
      category: 'faction',
    })
    await db.put('codexEntities', {
      id: idDefective,
      name: '无主散修', // Missing projectId
      category: 'faction',
    })

    const all = await db.getAll<any>('codexEntities')

    // Strict tenant filter: record.projectId === projA (Eradicating !e.projectId || e.projectId === projA)
    const strictFilteredA = all.filter((e) => e.projectId === projA)
    const permissiveFilteredA = all.filter((e) => !e.projectId || e.projectId === projA)

    expect(strictFilteredA.length).toBe(1)
    expect(strictFilteredA[0].name).toBe('青云宗')

    // Proves that permissive filter leaks defective unassigned records
    expect(permissiveFilteredA.length).toBe(2)
    expect(permissiveFilteredA.some((e) => e.name === '无主散修')).toBe(true)

    // Strict filter must never contain foreign or defective items
    expect(strictFilteredA.some((e) => e.name === '无主散修')).toBe(false)
    expect(strictFilteredA.some((e) => e.name === '天魔教')).toBe(false)
  })

  it('TC-ISO-03: Voiceprint collision resolution: Identical character names across projects do not overwrite each other', async () => {
    const charName = '李寻欢'
    // Composite key pattern: ${projectId}::vp-${characterName}
    const keyVoiceA = `${projA}::vp-${charName}`
    const keyVoiceB = `${projB}::vp-${charName}`

    await db.put('dialogueVoiceprints', {
      id: keyVoiceA,
      projectId: projA,
      characterName: charName,
      tone: '潇洒自嘲',
      pitch: 1.1,
    })

    await db.put('dialogueVoiceprints', {
      id: keyVoiceB,
      projectId: projB,
      characterName: charName,
      tone: '阴沉冷酷',
      pitch: 0.8,
    })

    const recordA = await db.get<any>('dialogueVoiceprints', keyVoiceA)
    const recordB = await db.get<any>('dialogueVoiceprints', keyVoiceB)

    expect(recordA.tone).toBe('潇洒自嘲')
    expect(recordB.tone).toBe('阴沉冷酷')
    expect(recordA.id).not.toBe(recordB.id)
  })

  it('TC-ISO-04: Form data storage isolation: Identical tabId preserves distinct state per project', async () => {
    const tabId = 'editor-general-options'
    const keyA = `${projA}::${tabId}`
    const keyB = `${projB}::${tabId}`

    await db.put('formData', {
      id: keyA,
      projectId: projA,
      tabId,
      data: { autoSaveInterval: 15, theme: 'parchment' },
    })

    await db.put('formData', {
      id: keyB,
      projectId: projB,
      tabId,
      data: { autoSaveInterval: 60, theme: 'dark' },
    })

    const formA = await db.get<any>('formData', keyA)
    const formB = await db.get<any>('formData', keyB)

    expect(formA.data.theme).toBe('parchment')
    expect(formB.data.theme).toBe('dark')
    expect(formA.data.autoSaveInterval).toBe(15)
    expect(formB.data.autoSaveInterval).toBe(60)
  })

  it('TC-ISO-05: Chapters and volumes are strictly quarantined by projectId', async () => {
    const volA: VolumeRecord = {
      id: `vol-${projA}-1`,
      title: '卷A',
      order: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const volB: VolumeRecord = {
      id: `vol-${projB}-1`,
      title: '卷B',
      order: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    const chapA: ChapterRecord = {
      id: `chap-${projA}-1`,
      volumeId: volA.id,
      title: '章A1',
      order: 1,
      content: 'A内容',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const chapB: ChapterRecord = {
      id: `chap-${projB}-1`,
      volumeId: volB.id,
      title: '章B1',
      order: 1,
      content: 'B内容',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    // Attach projectId to records
    await db.put('volumes', { ...volA, projectId: projA })
    await db.put('volumes', { ...volB, projectId: projB })
    await db.put('chapters', { ...chapA, projectId: projA })
    await db.put('chapters', { ...chapB, projectId: projB })

    const allChapters = await db.getAll<any>('chapters')
    const isolatedChaptersA = allChapters.filter((c) => c.projectId === projA)
    const isolatedChaptersB = allChapters.filter((c) => c.projectId === projB)

    expect(isolatedChaptersA.length).toBe(1)
    expect(isolatedChaptersA[0].id).toBe(chapA.id)
    expect(isolatedChaptersB.length).toBe(1)
    expect(isolatedChaptersB[0].id).toBe(chapB.id)
  })
})
