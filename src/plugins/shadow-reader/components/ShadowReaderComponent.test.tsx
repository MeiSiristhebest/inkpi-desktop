import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ShadowReaderMasterView } from './ShadowReaderMasterView'
import { ShadowReaderDrawer } from './ShadowReaderDrawer'
import { DesktopPluginHostProvider } from '../../../core/pluginHostContext'

describe('ShadowReader UI Components', () => {
  it('ShadowReaderMasterView renders correctly', () => {
    render(<ShadowReaderMasterView projectId="p1" />)
    expect(screen.getByText(/读者弹幕与毒点预判模拟器/)).toBeDefined()
  })

  it('ShadowReaderDrawer renders correctly', () => {
    render(
      <ShadowReaderDrawer projectId="p1" currentText="林凡一剑封喉！全场寂静，倒吸一口凉气！" />,
    )
    expect(screen.getByText(/读者弹幕哨兵/)).toBeDefined()
  })

  it('projects active chapter HTML into the local reader simulation', async () => {
    const chapter = {
      id: 'shadow-reader-chapter',
      projectId: 'p1',
      volumeId: 'v1',
      title: '第一章',
      content: '<h2>标题</h2><p>甲<strong>乙</strong><br>丙</p>',
      wordCount: 6,
      order: 1,
      revision: 2,
      createdAt: 1,
      updatedAt: 1,
    }

    const view = render(
      <DesktopPluginHostProvider projectId="p1" activeChapter={chapter}>
        <ShadowReaderMasterView projectId="p1" />
      </DesktopPluginHostProvider>,
    )

    expect(screen.getAllByRole('textbox')[1]).toHaveValue('标题\n甲乙\n丙')

    const nextChapter = { ...chapter, id: 'shadow-reader-chapter-2', content: '<p>新章节。</p>' }
    view.rerender(
      <DesktopPluginHostProvider projectId="p1" activeChapter={nextChapter}>
        <ShadowReaderMasterView projectId="p1" />
      </DesktopPluginHostProvider>,
    )

    await waitFor(() => expect(screen.getAllByRole('textbox')[1]).toHaveValue('新章节。'))
  })
})
