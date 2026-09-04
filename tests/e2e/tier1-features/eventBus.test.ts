// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { pluginEventBus } from '../../../src/core/pluginEventBus'
import { createScopedEventBus } from '../harness'

describe('Tier 1: F3 - Decoupled Plugin Event Bus & Tenant Channel Scoping', () => {
  beforeEach(() => {
    pluginEventBus.clear()
  })

  afterEach(() => {
    pluginEventBus.clear()
  })

  it('TC-BUS-01: Dispatches and receives events within the same tenant project scope', () => {
    const projectId = 'proj-bus-alpha'
    const scopedBus = createScopedEventBus(projectId)
    const received: any[] = []

    const unsubscribe = scopedBus.on('POWER_BREACH_DETECTED', (payload) => {
      received.push(payload)
    })

    scopedBus.emit('POWER_BREACH_DETECTED', {
      projectId,
      protagonistName: '楚凌霄',
      enemyName: '黑煞魔尊',
      tierDiff: 3,
      riskLevel: 'CRITICAL_COLLAPSE',
      diagnostic: '筑基期主角逆战化神期魔尊，战力失衡严重！',
    })

    expect(received.length).toBe(1)
    expect(received[0].protagonistName).toBe('楚凌霄')
    expect(received[0].riskLevel).toBe('CRITICAL_COLLAPSE')

    unsubscribe()
  })

  it('TC-BUS-02: Strictly isolates events across different tenant projects (Zero Cross-Tenant Leak)', () => {
    const projectAlpha = 'proj-tenant-alpha'
    const projectBeta = 'proj-tenant-beta'

    const busAlpha = createScopedEventBus(projectAlpha)
    const busBeta = createScopedEventBus(projectBeta)

    const alphaEvents: any[] = []
    const betaEvents: any[] = []

    const unsubAlpha = busAlpha.on('TIMELINE_EVENT_REGISTERED', (p) => alphaEvents.push(p))
    const unsubBeta = busBeta.on('TIMELINE_EVENT_REGISTERED', (p) => betaEvents.push(p))

    // Emit event solely in project Alpha
    busAlpha.emit('TIMELINE_EVENT_REGISTERED', {
      projectId: projectAlpha,
      chapterId: 'chap-101',
      calendarId: 'celestial-calendar',
      universalAbsoluteDay: 1542,
      summary: '仙门大比落幕',
    })

    expect(alphaEvents.length).toBe(1)
    expect(alphaEvents[0].summary).toBe('仙门大比落幕')

    // Beta subscriber must receive ZERO events
    expect(betaEvents.length).toBe(0)

    unsubAlpha()
    unsubBeta()
  })

  it('TC-BUS-03: Supports multiple concurrent subscribers per event channel within the project', () => {
    const projectId = 'proj-bus-multi'
    const bus = createScopedEventBus(projectId)

    let subscriber1Calls = 0
    let subscriber2Calls = 0

    const unsub1 = bus.on('CODEX_ENTITY_TOUCHED', () => {
      subscriber1Calls++
    })
    const unsub2 = bus.on('CODEX_ENTITY_TOUCHED', () => {
      subscriber2Calls++
    })

    bus.emit('CODEX_ENTITY_TOUCHED', {
      projectId,
      entityId: 'ent-001',
      entityName: '九阳神剑',
      category: 'artifact',
    })

    expect(subscriber1Calls).toBe(1)
    expect(subscriber2Calls).toBe(1)

    unsub1()
    unsub2()
  })

  it('TC-BUS-04: Cleanly unregisters subscriber without impacting other listeners', () => {
    const projectId = 'proj-bus-unsub'
    const bus = createScopedEventBus(projectId)

    let countA = 0
    let countB = 0

    const unsubA = bus.on('FORESHADOW_PLANTED', () => {
      countA++
    })
    const unsubB = bus.on('FORESHADOW_PLANTED', () => {
      countB++
    })

    bus.emit('FORESHADOW_PLANTED', {
      projectId,
      gunName: '神秘玉佩',
      plantChapterOrder: 3,
      category: 'treasure',
    })

    expect(countA).toBe(1)
    expect(countB).toBe(1)

    // Unsubscribe A only
    unsubA()

    bus.emit('FORESHADOW_PLANTED', {
      projectId,
      gunName: '残缺阵图',
      plantChapterOrder: 5,
      category: 'map',
    })

    expect(countA).toBe(1) // Not incremented
    expect(countB).toBe(2) // Incremented

    unsubB()
  })

  it('TC-BUS-05: Successfully handles all 5 production event payload types with typed payloads', () => {
    const projectId = 'proj-bus-types'
    const bus = createScopedEventBus(projectId)

    const captured: Record<string, unknown> = {}

    bus.on('TIMELINE_EVENT_REGISTERED', (p) => {
      captured.timeline = p
    })
    bus.on('POWER_BREACH_DETECTED', (p) => {
      captured.power = p
    })
    bus.on('FORESHADOW_PLANTED', (p) => {
      captured.foreshadow = p
    })
    bus.on('CODEX_ENTITY_TOUCHED', (p) => {
      captured.codex = p
    })
    bus.on('CHAPTER_CONTENT_AUDITED', (p) => {
      captured.audit = p
    })

    bus.emit('TIMELINE_EVENT_REGISTERED', {
      projectId,
      chapterId: 'chap-1',
      calendarId: 'cal-1',
      universalAbsoluteDay: 100,
      summary: '事件摘要',
    })
    bus.emit('POWER_BREACH_DETECTED', {
      projectId,
      protagonistName: '主角',
      enemyName: '反派',
      tierDiff: 2,
      riskLevel: 'WARNING',
      diagnostic: '轻微越阶',
    })
    bus.emit('FORESHADOW_PLANTED', {
      projectId,
      gunName: '伏笔道具',
      plantChapterOrder: 1,
      category: 'item',
    })
    bus.emit('CODEX_ENTITY_TOUCHED', {
      projectId,
      entityId: 'ent-1',
      entityName: '设定实体',
      category: 'lore',
    })
    bus.emit('CHAPTER_CONTENT_AUDITED', {
      projectId,
      chapterId: 'chap-1',
      wordCount: 3200,
      waterScore: 12,
    })

    expect(captured.timeline.summary).toBe('事件摘要')
    expect(captured.power.riskLevel).toBe('WARNING')
    expect(captured.foreshadow.gunName).toBe('伏笔道具')
    expect(captured.codex.entityName).toBe('设定实体')
    expect(captured.audit.wordCount).toBe(3200)
  })
})
