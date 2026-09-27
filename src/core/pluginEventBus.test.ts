import { describe, it, expect, vi } from 'vitest'
import { pluginEventBus } from './pluginEventBus'

describe('PluginEventBus', () => {
  it('subscribes and emits events with typed payload', () => {
    const handler = vi.fn()
    const unsubscribe = pluginEventBus.on('POWER_BREACH_DETECTED', handler)

    pluginEventBus.emit('POWER_BREACH_DETECTED', {
      projectId: 'p1',
      protagonistName: '韩立',
      enemyName: '极阴祖师',
      tierDiff: 18,
      riskLevel: 'CRITICAL_COLLAPSE',
      diagnostic: '跨阶严重崩塌',
    })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        protagonistName: '韩立',
        riskLevel: 'CRITICAL_COLLAPSE',
      }),
    )

    unsubscribe()
    pluginEventBus.emit('POWER_BREACH_DETECTED', {
      projectId: 'p1',
      protagonistName: '韩立',
      enemyName: '极阴祖师',
      tierDiff: 18,
      riskLevel: 'CRITICAL_COLLAPSE',
      diagnostic: '跨阶严重崩塌',
    })

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('safely isolates multiple independent event types', () => {
    const timeHandler = vi.fn()
    const gunHandler = vi.fn()

    pluginEventBus.on('UNIFIED_CHAPTER_EVALUATED', timeHandler)
    pluginEventBus.on('FORESHADOW_PLANTED', gunHandler)

    pluginEventBus.emit('UNIFIED_CHAPTER_EVALUATED', {
      projectId: 'p2',
      chapterId: 'c1',
      compositeScore: 82,
      pacingRating: '偏慢',
      cliffhangerScore: 61,
    })

    expect(timeHandler).toHaveBeenCalledTimes(1)
    expect(gunHandler).not.toHaveBeenCalled()
  })
})
