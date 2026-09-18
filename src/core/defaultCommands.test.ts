import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  registerDefaultCommands,
  setNavigationHandler,
  type NavigationHandler,
} from './defaultCommands'
import { commandRegistry } from './commandRegistry'

describe('defaultCommands', () => {
  const mockHandler: NavigationHandler = {
    openView: vi.fn(),
    openAssistant: vi.fn(),
    openActivityCenter: vi.fn(),
    openSettings: vi.fn(),
    openInspector: vi.fn(),
    openDrawer: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    setNavigationHandler(mockHandler)
  })

  it('registers core commands and routes open-assistant to openInspector', () => {
    const unregister = registerDefaultCommands()

    const assistantCmd = commandRegistry.get('cmd-open-assistant')
    expect(assistantCmd).toBeDefined()
    assistantCmd!.execute()
    expect(mockHandler.openInspector).toHaveBeenCalledWith('assistant')

    const activityCmd = commandRegistry.get('cmd-open-activity-center')
    expect(activityCmd).toBeDefined()
    activityCmd!.execute()
    expect(mockHandler.openInspector).toHaveBeenCalledWith('activity')

    unregister()
  })

  it('routes capabilities according to their surfaces', () => {
    const unregister = registerDefaultCommands()

    // living-codex has navigation surface -> openView
    const codexCmd = commandRegistry.get('cmd-capability-living-codex')
    expect(codexCmd).toBeDefined()
    expect(codexCmd!.title).toContain('打开')
    codexCmd!.execute()
    expect(mockHandler.openView).toHaveBeenCalledWith('living-codex')

    // consistency-sentinel has inspector surface -> openInspector('plugin', 'consistency-sentinel')
    const sentinelCmd = commandRegistry.get('cmd-capability-consistency-sentinel')
    expect(sentinelCmd).toBeDefined()
    expect(sentinelCmd!.title).toContain('在右栏审查')
    sentinelCmd!.execute()
    expect(mockHandler.openInspector).toHaveBeenCalledWith('plugin', 'consistency-sentinel')

    // water-meter has drawer surface -> openDrawer('water-meter')
    const waterCmd = commandRegistry.get('cmd-capability-water-meter')
    expect(waterCmd).toBeDefined()
    expect(waterCmd!.title).toContain('呼出抽屉')
    waterCmd!.execute()
    expect(mockHandler.openDrawer).toHaveBeenCalledWith('water-meter')

    unregister()
  })
})
