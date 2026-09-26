import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsView } from './SettingsView'
import { SettingsProvider } from '../../core/settings'

// §P4.1：分区导航必须是真正的 tablist——ARIA 语义 + 组内方向键 + 每组一个 Tab 停靠点。
// 断言只认角色与属性，不认样式类：配色变了不算无障碍坏了，角色没了才算。
const renderSettings = () =>
  render(
    <SettingsProvider>
      <SettingsView open onClose={vi.fn()} />
    </SettingsProvider>,
  )

const tabs = () => Array.from(screen.getAllByRole('tab')) as HTMLElement[]
const stopTabs = () => tabs().filter((tab) => tab.tabIndex === 0)
const stopTabIds = () => stopTabs().map((tab) => tab.id)

describe('§P4.1 设置分区导航是一张可键盘操作的 tablist', () => {
  it('三个分组各自成组，且当前分区只有一个被选中', () => {
    renderSettings()

    const tablists = screen.getAllByRole('tablist')
    expect(tablists).toHaveLength(3)
    expect(tablists.map((list) => list.getAttribute('aria-label'))).toEqual([
      '功能偏好',
      '能力与连接',
      '系统',
    ])
    tablists.forEach((list) => expect(list).toHaveAttribute('aria-orientation', 'vertical'))

    const selected = screen.getAllByRole('tab', { selected: true })
    expect(selected).toHaveLength(1)
    expect(selected[0].textContent).toContain('外观')
  })

  it('面板由当前 tab 命名，换分区后面板 id 与指向一起跟着换', () => {
    renderSettings()

    const first = document.getElementById('settings-panel-appearance')
    expect(first).not.toBeNull()
    expect(first).toHaveAttribute('role', 'tabpanel')
    expect(first).toHaveAttribute('aria-labelledby', 'settings-tab-appearance')

    fireEvent.click(screen.getByText('关于'))

    expect(document.getElementById('settings-panel-appearance')).toBeNull()
    const next = document.getElementById('settings-panel-about')
    expect(next).not.toBeNull()
    expect(next).toHaveAttribute('aria-labelledby', 'settings-tab-about')
  })

  it('方向键在组内切换并立即激活，焦点跟着走', () => {
    renderSettings()

    const appearance = screen.getByText('外观').closest('[role="tab"]') as HTMLElement
    appearance.focus()
    fireEvent.keyDown(appearance, { key: 'ArrowDown' })

    const editor = screen.getByText('编辑器').closest('[role="tab"]') as HTMLElement
    expect(editor).toHaveAttribute('aria-selected', 'true')
    expect(document.activeElement).toBe(editor)
    expect(document.getElementById('settings-panel-editor')).not.toBeNull()

    // 组内绕回：从第二项连按三次向上，落回同组末尾，而不是掉出这个 tablist
    fireEvent.keyDown(editor, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(appearance)
    fireEvent.keyDown(appearance, { key: 'ArrowUp' })
    const shortcuts = screen.getByText('快捷键').closest('[role="tab"]') as HTMLElement
    expect(document.activeElement).toBe(shortcuts)
    expect(shortcuts).toHaveAttribute('aria-selected', 'true')
  })

  it('Home / End 落在本组首尾，不会跳到别的分组', () => {
    renderSettings()

    // 用「功能偏好」组做验证：这组四项都渲染纯本地面板，切到「插件管理」会拉起另一套 Provider 依赖
    const shortcuts = screen.getByText('快捷键').closest('[role="tab"]') as HTMLElement
    shortcuts.focus()
    fireEvent.keyDown(shortcuts, { key: 'Home' })

    const appearance = screen.getByText('外观').closest('[role="tab"]') as HTMLElement
    expect(document.activeElement).toBe(appearance)
    expect(appearance).toHaveAttribute('aria-selected', 'true')
    expect(document.getElementById('settings-panel-appearance')).not.toBeNull()

    fireEvent.keyDown(appearance, { key: 'End' })
    expect(document.activeElement).toBe(shortcuts)
    expect(screen.getByText('插件管理').closest('[role="tab"]')).toHaveAttribute(
      'aria-selected',
      'false',
    )
  })

  it('每个 tablist 都留一个 Tab 停靠点，键盘用户进得去也出得来', () => {
    renderSettings()

    // 10 个分区 / 3 个分组：选中项所在组用选中项当停靠点，其余组各用本组第一项
    expect(tabs()).toHaveLength(10)
    expect(stopTabIds()).toEqual([
      'settings-tab-appearance',
      'settings-tab-plugins',
      'settings-tab-advanced',
    ])

    fireEvent.click(screen.getByText('高级'))
    expect(stopTabIds()).toEqual([
      'settings-tab-appearance',
      'settings-tab-plugins',
      'settings-tab-advanced',
    ])
  })
})
