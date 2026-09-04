import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db, uid } from './indexedDB'
import type { ChapterRecord, VolumeRecord } from '../types'

const chapter = (over: Partial<ChapterRecord> = {}): ChapterRecord => ({
  id: 'c1',
  projectId: 'p1',
  volumeId: 'v1',
  title: 'T',
  content: 'c',
  wordCount: 1,
  order: 0,
  createdAt: 1,
  updatedAt: 2,
  ...over,
})

const volume = (over: Partial<VolumeRecord> = {}): VolumeRecord => ({
  id: 'v1',
  projectId: 'p1',
  title: 'V',
  order: 0,
  createdAt: 1,
  updatedAt: 1,
  ...over,
})

beforeEach(async () => {
  for (const store of ['volumes', 'chapters'] as const) {
    const all = await db.getAll<{ id: string }>(store)
    await Promise.all(all.map((r) => db.delete(store, r.id)))
  }
})

describe('uid', () => {
  it('uses the given prefix', () => {
    expect(uid('vol')).toMatch(/^vol-/)
  })
  it('defaults the prefix to "id"', () => {
    expect(uid()).toMatch(/^id-/)
  })
  it('produces unique values on repeated calls', () => {
    expect(uid('ch')).not.toBe(uid('ch'))
  })
})

describe('indexedDB entity storage', () => {
  it('put then get returns the same record', async () => {
    const ch = chapter()
    await db.put('chapters', ch)
    expect(await db.get('chapters', 'c1')).toEqual(ch)
  })

  it('get on a missing key returns undefined', async () => {
    expect(await db.get('chapters', 'nope')).toBeUndefined()
  })

  it('put with the same id replaces the record', async () => {
    await db.put('volumes', volume())
    const updated = volume({ title: 'B', order: 1, updatedAt: 2 })
    await db.put('volumes', updated)
    expect(await db.get('volumes', 'v1')).toEqual(updated)
  })

  it('getAll returns every record regardless of projectId', async () => {
    await db.put('chapters', chapter({ id: 'c1', projectId: 'p1' }))
    await db.put('chapters', chapter({ id: 'c2', projectId: 'p2' }))
    const all = await db.getAll<ChapterRecord>('chapters')
    expect(all).toHaveLength(2)
  })

  it('getAll on an empty store returns an empty array', async () => {
    expect(await db.getAll('chapters')).toEqual([])
  })

  it('delete removes a record', async () => {
    await db.put('chapters', chapter())
    await db.delete('chapters', 'c1')
    expect(await db.get('chapters', 'c1')).toBeUndefined()
  })

  it('auto-creates both object stores on first open', async () => {
    await db.put('volumes', volume())
    await db.put('chapters', chapter())
    expect(await db.getAll('volumes')).toHaveLength(1)
    expect(await db.getAll('chapters')).toHaveLength(1)
  })
})

// 错误韧性：覆盖 openDB / getAll / get / put / delete 的 onerror reject 分支。
// 这些分支只有在 IndexedDB 自身失败时才会触发，需用桩替换全局 indexedDB 来验证。
describe('indexedDB — 错误韧性（onerror 分支）', () => {
  it('rejects when the database fails to open', async () => {
    const fake = {
      open: () => {
        const req: any = {}
        queueMicrotask(() => {
          req.error = new Error('simulated open failure')
          req.onerror && req.onerror()
        })
        return req
      },
    }
    vi.stubGlobal('indexedDB', fake)
    vi.resetModules()
    const { db: failingDb } = await import('./indexedDB')
    await expect(failingDb.getAll('chapters')).rejects.toThrow()
    vi.unstubAllGlobals()
  })

  it('rejects read/write operations when a request or transaction errors', async () => {
    const storeReq = (fail: boolean) => {
      const req: any = {}
      queueMicrotask(() => {
        if (fail) {
          req.error = new Error('simulated op failure')
          req.onerror && req.onerror()
        } else {
          req.result = undefined
          req.onsuccess && req.onsuccess()
        }
      })
      return req
    }
    const dbObj: any = {
      objectStoreNames: { contains: () => false },
      createObjectStore: () => ({}),
    }
    const makeTx = (fail: boolean) => {
      const t: any = {
        objectStore: () => ({
          get: () => storeReq(fail),
          getAll: () => storeReq(fail),
          put: () => storeReq(fail),
          delete: () => storeReq(fail),
        }),
        oncomplete: null,
        onerror: null,
      }
      queueMicrotask(() => {
        if (fail) {
          t.error = new Error('simulated tx failure')
          t.onerror && t.onerror()
        } else {
          t.oncomplete && t.oncomplete()
        }
      })
      return t
    }
    dbObj.transaction = () => makeTx(true)
    const fake: any = {
      open: () => {
        const req: any = { result: dbObj }
        queueMicrotask(() => {
          req.onupgradeneeded && req.onupgradeneeded()
          req.onsuccess && req.onsuccess()
        })
        return req
      },
    }
    vi.stubGlobal('indexedDB', fake)
    vi.resetModules()
    const { db: failingDb } = await import('./indexedDB')
    await expect(failingDb.getAll('chapters')).rejects.toThrow()
    await expect(failingDb.get('chapters', 'x')).rejects.toThrow()
    await expect(failingDb.put('chapters', { id: 'x' } as never)).rejects.toThrow()
    await expect(failingDb.delete('chapters', 'x')).rejects.toThrow()
    vi.unstubAllGlobals()
  })

  it('skips store creation when it already exists and tolerates a falsy getAll result', async () => {
    const storeReq = (result: unknown) => {
      const req: any = {}
      queueMicrotask(() => {
        req.result = result
        req.onsuccess && req.onsuccess()
      })
      return req
    }
    const dbObj: any = {
      // chapters 已存在 -> onupgradeneeded 中跳过创建（覆盖 else 分支）
      objectStoreNames: { contains: (name: string) => name === 'chapters' },
      createObjectStore: () => ({}),
    }
    const makeTx = () => {
      const t: any = {
        objectStore: () => ({
          get: () => storeReq(undefined),
          getAll: () => storeReq(undefined),
          put: () => storeReq(undefined),
          delete: () => storeReq(undefined),
        }),
        oncomplete: null,
        onerror: null,
      }
      queueMicrotask(() => t.oncomplete && t.oncomplete())
      return t
    }
    dbObj.transaction = () => makeTx()
    const fake: any = {
      open: () => {
        const req: any = { result: dbObj }
        queueMicrotask(() => {
          req.onupgradeneeded && req.onupgradeneeded()
          req.onsuccess && req.onsuccess()
        })
        return req
      },
    }
    vi.stubGlobal('indexedDB', fake)
    vi.resetModules()
    const { db: g } = await import('./indexedDB')
    // getAll 成功但结果为 undefined -> 走 `|| []` 回退
    expect(await g.getAll('chapters')).toEqual([])
    expect(await g.get('chapters', 'x')).toBeUndefined()
    vi.unstubAllGlobals()
  })

  it('supports CRUD operations on new stores: promiseLedger, timelineNodes, narrativeThreads', async () => {
    await db.put('promiseLedger', { id: 'p1', clueName: 'Test Promise' })
    expect(await db.get('promiseLedger', 'p1')).toEqual({ id: 'p1', clueName: 'Test Promise' })

    await db.put('timelineNodes', { id: 'n1', eventTitle: 'Test Node' })
    expect(await db.get('timelineNodes', 'n1')).toEqual({ id: 'n1', eventTitle: 'Test Node' })

    await db.put('narrativeThreads', { id: 't1', name: 'Main Thread' })
    expect(await db.get('narrativeThreads', 't1')).toEqual({ id: 't1', name: 'Main Thread' })

    await db.delete('promiseLedger', 'p1')
    expect(await db.get('promiseLedger', 'p1')).toBeUndefined()
  })

  it('supports CRUD operations on stores: readerHooks, clueMatrices, waterAuditSnapshots', async () => {
    await db.put('readerHooks', { id: 'rh1', chapterId: 'ch1', type: 'crisis' })
    expect(await db.get('readerHooks', 'rh1')).toEqual({ id: 'rh1', chapterId: 'ch1', type: 'crisis' })

    await db.put('clueMatrices', { id: 'cm1', clueId: 'clue-1', characterId: 'hero' })
    expect(await db.get('clueMatrices', 'cm1')).toEqual({ id: 'cm1', clueId: 'clue-1', characterId: 'hero' })

    await db.put('waterAuditSnapshots', { id: 'ws1', chapterId: 'ch1', waterScore: 12 })
    expect(await db.get('waterAuditSnapshots', 'ws1')).toEqual({ id: 'ws1', chapterId: 'ch1', waterScore: 12 })

    await db.delete('readerHooks', 'rh1')
    expect(await db.get('readerHooks', 'rh1')).toBeUndefined()
  })

  it('supports CRUD operations on stores: volumeArcs, dialogueVoiceprints, factionDiplomacies', async () => {
    await db.put('volumeArcs', { id: 'va1', volumeId: 'v1', targetWordCount: 200000 })
    expect(await db.get('volumeArcs', 'va1')).toEqual({ id: 'va1', volumeId: 'v1', targetWordCount: 200000 })

    await db.put('dialogueVoiceprints', { id: 'dv1', characterName: '陆沉', asl: 12.5 })
    expect(await db.get('dialogueVoiceprints', 'dv1')).toEqual({ id: 'dv1', characterName: '陆沉', asl: 12.5 })

    await db.put('factionDiplomacies', { id: 'fd1', factionAId: 'f1', factionBId: 'f2', stance: 'allied' })
    expect(await db.get('factionDiplomacies', 'fd1')).toEqual({ id: 'fd1', factionAId: 'f1', factionBId: 'f2', stance: 'allied' })

    await db.delete('volumeArcs', 'va1')
    expect(await db.get('volumeArcs', 'va1')).toBeUndefined()
  })

  it('supports CRUD operations on stores: paywallAudits, memoryPalaceSnapshots, pressExportConfigs', async () => {
    await db.put('paywallAudits', { id: 'pa1', chapterId: 'ch-vip-1', ppiScore: 88 })
    expect(await db.get('paywallAudits', 'pa1')).toEqual({ id: 'pa1', chapterId: 'ch-vip-1', ppiScore: 88 })

    await db.put('memoryPalaceSnapshots', { id: 'mp1', entityId: 'ent-1', entityName: '九霄玄铁' })
    expect(await db.get('memoryPalaceSnapshots', 'mp1')).toEqual({ id: 'mp1', entityId: 'ent-1', entityName: '九霄玄铁' })

    await db.put('pressExportConfigs', { projectId: 'p1', presetId: 'qidian-standard', fontSizePt: 10.5 })
    expect(await db.get('pressExportConfigs', 'p1')).toEqual({ projectId: 'p1', presetId: 'qidian-standard', fontSizePt: 10.5 })

    await db.delete('paywallAudits', 'pa1')
    expect(await db.get('paywallAudits', 'pa1')).toBeUndefined()
    await db.delete('pressExportConfigs', 'p1')
    expect(await db.get('pressExportConfigs', 'p1')).toBeUndefined()
  })

  it('supports CRUD operations on stores: emotionAudits, subPlotStrands, brainstormSparks', async () => {
    await db.put('emotionAudits', { id: 'ea1', chapterId: 'ch-1', netPolarity: 45 })
    expect(await db.get('emotionAudits', 'ea1')).toEqual({ id: 'ea1', chapterId: 'ch-1', netPolarity: 45 })

    await db.put('subPlotStrands', { id: 'sp1', title: '魔教暗子调查', status: 'active' })
    expect(await db.get('subPlotStrands', 'sp1')).toEqual({ id: 'sp1', title: '魔教暗子调查', status: 'active' })

    await db.put('brainstormSparks', { id: 'bs1', dilemmaType: 'dead_end', coreProblem: '死局解脱' })
    expect(await db.get('brainstormSparks', 'bs1')).toEqual({ id: 'bs1', dilemmaType: 'dead_end', coreProblem: '死局解脱' })

    await db.delete('emotionAudits', 'ea1')
    expect(await db.get('emotionAudits', 'ea1')).toBeUndefined()
    await db.delete('subPlotStrands', 'sp1')
    expect(await db.get('subPlotStrands', 'sp1')).toBeUndefined()
  })

  it('supports CRUD operations on stores: readerSimulations, chekhovGuns, rhythmCadences', async () => {
    await db.put('readerSimulations', { id: 'rs1', chapterId: 'ch-1', toxicityIndex: 12 })
    expect(await db.get('readerSimulations', 'rs1')).toEqual({ id: 'rs1', chapterId: 'ch-1', toxicityIndex: 12 })

    await db.put('chekhovGuns', { id: 'cg1', gunName: '生锈的铁剑', status: 'dormant' })
    expect(await db.get('chekhovGuns', 'cg1')).toEqual({ id: 'cg1', gunName: '生锈的铁剑', status: 'dormant' })

    await db.put('rhythmCadences', { projectId: 'p1', currentMicroStep: 2, currentMesoStep: 14 })
    expect(await db.get('rhythmCadences', 'p1')).toEqual({ projectId: 'p1', currentMicroStep: 2, currentMesoStep: 14 })

    await db.delete('readerSimulations', 'rs1')
    expect(await db.get('readerSimulations', 'rs1')).toBeUndefined()
    await db.delete('rhythmCadences', 'p1')
    expect(await db.get('rhythmCadences', 'p1')).toBeUndefined()
  })

  it('supports CRUD operations on stores: geoMapGrids, combatDuels, multiCalendars', async () => {
    await db.put('geoMapGrids', { id: 'map1', locationId: 'loc-1', scaleKmPerCell: 10 })
    expect(await db.get('geoMapGrids', 'map1')).toEqual({ id: 'map1', locationId: 'loc-1', scaleKmPerCell: 10 })

    await db.put('combatDuels', { id: 'duel1', protagonistTier: '金丹初期', enemyTier: '金丹后期' })
    expect(await db.get('combatDuels', 'duel1')).toEqual({ id: 'duel1', protagonistTier: '金丹初期', enemyTier: '金丹后期' })

    await db.put('multiCalendars', { id: 'cal1', projectId: 'p1', calendarName: '大炎天历' })
    expect(await db.get('multiCalendars', 'cal1')).toEqual({ id: 'cal1', projectId: 'p1', calendarName: '大炎天历' })

    await db.delete('geoMapGrids', 'map1')
    expect(await db.get('geoMapGrids', 'map1')).toBeUndefined()
    await db.delete('combatDuels', 'duel1')
    expect(await db.get('combatDuels', 'duel1')).toBeUndefined()
    await db.delete('multiCalendars', 'cal1')
    expect(await db.get('multiCalendars', 'cal1')).toBeUndefined()
  })

  it('supports CRUD operations on stores: povSnapshots, linterRulesConfigs, diffReviews', async () => {
    await db.put('povSnapshots', { id: 'pov1', projectId: 'p1', currentPovCharacter: '林凡' })
    expect(await db.get('povSnapshots', 'pov1')).toEqual({ id: 'pov1', projectId: 'p1', currentPovCharacter: '林凡' })

    await db.put('linterRulesConfigs', { projectId: 'p1', enabledRuleIds: ['RULE_HEAD_HOPPING'] })
    expect(await db.get('linterRulesConfigs', 'p1')).toEqual({ projectId: 'p1', enabledRuleIds: ['RULE_HEAD_HOPPING'] })

    await db.put('diffReviews', { id: 'diff1', projectId: 'p1', title: 'Chapter 1 revision' })
    expect(await db.get('diffReviews', 'diff1')).toEqual({ id: 'diff1', projectId: 'p1', title: 'Chapter 1 revision' })

    await db.delete('povSnapshots', 'pov1')
    expect(await db.get('povSnapshots', 'pov1')).toBeUndefined()
    await db.delete('linterRulesConfigs', 'p1')
    expect(await db.get('linterRulesConfigs', 'p1')).toBeUndefined()
    await db.delete('diffReviews', 'diff1')
    expect(await db.get('diffReviews', 'diff1')).toBeUndefined()
  })

  it('supports CRUD operations on stores: ironChamberRecords, soundscapeConfigs, scrapbookFragments', async () => {
    await db.put('ironChamberRecords', { id: 'ic1', projectId: 'p1', mode: 'words', targetWords: 3000, status: 'locked' })
    expect(await db.get('ironChamberRecords', 'ic1')).toEqual({ id: 'ic1', projectId: 'p1', mode: 'words', targetWords: 3000, status: 'locked' })

    await db.put('soundscapeConfigs', { projectId: 'p1', switchType: 'blue', backgroundAmbience: 'rain', enabled: true })
    expect(await db.get('soundscapeConfigs', 'p1')).toEqual({ projectId: 'p1', switchType: 'blue', backgroundAmbience: 'rain', enabled: true })

    await db.put('scrapbookFragments', { id: 'sf1', projectId: 'p1', snippet: '一段被删减的精彩打斗废稿', wordCount: 15 })
    expect(await db.get('scrapbookFragments', 'sf1')).toEqual({ id: 'sf1', projectId: 'p1', snippet: '一段被删减的精彩打斗废稿', wordCount: 15 })

    await db.delete('ironChamberRecords', 'ic1')
    expect(await db.get('ironChamberRecords', 'ic1')).toBeUndefined()
    await db.delete('soundscapeConfigs', 'p1')
    expect(await db.get('soundscapeConfigs', 'p1')).toBeUndefined()
    await db.delete('scrapbookFragments', 'sf1')
    expect(await db.get('scrapbookFragments', 'sf1')).toBeUndefined()
  })

  it('supports CRUD operations on stores: aftermathPatches, subtextDialogues, narrativeArchetypes, rhythmRadarReports', async () => {
    await db.put('aftermathPatches', { id: 'ap1', projectId: 'p1', entityId: 'ent1', changeType: 'attribute_update' })
    expect(await db.get('aftermathPatches', 'ap1')).toEqual({ id: 'ap1', projectId: 'p1', entityId: 'ent1', changeType: 'attribute_update' })

    await db.put('subtextDialogues', { id: 'sd1', projectId: 'p1', spoken: '我很好', subtext: '内心极度痛苦' })
    expect(await db.get('subtextDialogues', 'sd1')).toEqual({ id: 'sd1', projectId: 'p1', spoken: '我很好', subtext: '内心极度痛苦' })

    await db.put('narrativeArchetypes', { id: 'na1', name: '反叛者', category: 'character_archetype_36' })
    expect(await db.get('narrativeArchetypes', 'na1')).toEqual({ id: 'na1', name: '反叛者', category: 'character_archetype_36' })

    await db.put('rhythmRadarReports', { id: 'rr1', projectId: 'p1', tensionScore: 0.85, pacingStatus: 'optimal' })
    expect(await db.get('rhythmRadarReports', 'rr1')).toEqual({ id: 'rr1', projectId: 'p1', tensionScore: 0.85, pacingStatus: 'optimal' })

    await db.delete('aftermathPatches', 'ap1')
    expect(await db.get('aftermathPatches', 'ap1')).toBeUndefined()
    await db.delete('subtextDialogues', 'sd1')
    expect(await db.get('subtextDialogues', 'sd1')).toBeUndefined()
    await db.delete('narrativeArchetypes', 'na1')
    expect(await db.get('narrativeArchetypes', 'na1')).toBeUndefined()
    await db.delete('rhythmRadarReports', 'rr1')
    expect(await db.get('rhythmRadarReports', 'rr1')).toBeUndefined()
  })

  it('supports CRUD operations on stores: goldChapterEvals, shadowDanmakus, authorOpsProfiles', async () => {
    await db.put('goldChapterEvals', { id: 'ge1', projectId: 'p1', score: 88, isQualified: true })
    expect(await db.get('goldChapterEvals', 'ge1')).toEqual({ id: 'ge1', projectId: 'p1', score: 88, isQualified: true })

    await db.put('shadowDanmakus', { id: 'sdm1', projectId: 'p1', chapterId: 'ch1', personaType: 'critical_toxic', content: '这也太毒了' })
    expect(await db.get('shadowDanmakus', 'sdm1')).toEqual({ id: 'sdm1', projectId: 'p1', chapterId: 'ch1', personaType: 'critical_toxic', content: '这也太毒了' })

    await db.put('authorOpsProfiles', { projectId: 'p1', authorName: '天蚕土豆' })
    expect(await db.get('authorOpsProfiles', 'p1')).toEqual({ projectId: 'p1', authorName: '天蚕土豆' })

    await db.delete('goldChapterEvals', 'ge1')
    expect(await db.get('goldChapterEvals', 'ge1')).toBeUndefined()
    await db.delete('shadowDanmakus', 'sdm1')
    expect(await db.get('shadowDanmakus', 'sdm1')).toBeUndefined()
    await db.delete('authorOpsProfiles', 'p1')
    expect(await db.get('authorOpsProfiles', 'p1')).toBeUndefined()
  })

  it('supports CRUD operations on stores: multiverseBranches, voiceScriptCasts, storyboardScenes', async () => {
    await db.put('multiverseBranches', { id: 'mb1', projectId: 'p1', forkChapterIndex: 15, name: '未救女配线' })
    expect(await db.get('multiverseBranches', 'mb1')).toEqual({ id: 'mb1', projectId: 'p1', forkChapterIndex: 15, name: '未救女配线' })

    await db.put('voiceScriptCasts', { id: 'vsc1', projectId: 'p1', characterId: 'c1', characterName: '林凡', pitch: 1.0 })
    expect(await db.get('voiceScriptCasts', 'vsc1')).toEqual({ id: 'vsc1', projectId: 'p1', characterId: 'c1', characterName: '林凡', pitch: 1.0 })

    await db.put('storyboardScenes', { id: 'sb1', projectId: 'p1', chapterId: 'ch1', sceneTitle: '退婚之辱' })
    expect(await db.get('storyboardScenes', 'sb1')).toEqual({ id: 'sb1', projectId: 'p1', chapterId: 'ch1', sceneTitle: '退婚之辱' })

    await db.delete('multiverseBranches', 'mb1')
    expect(await db.get('multiverseBranches', 'mb1')).toBeUndefined()
    await db.delete('voiceScriptCasts', 'vsc1')
    expect(await db.get('voiceScriptCasts', 'vsc1')).toBeUndefined()
    await db.delete('storyboardScenes', 'sb1')
    expect(await db.get('storyboardScenes', 'sb1')).toBeUndefined()
  })
})

