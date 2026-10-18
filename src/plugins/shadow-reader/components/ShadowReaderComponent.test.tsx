import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ShadowReaderMasterView } from './ShadowReaderMasterView'
import { ShadowReaderDrawer } from './ShadowReaderDrawer'
import { DesktopPluginHostProvider } from '../../../core/pluginHostContext'

describe('ShadowReader UI Components', () => {
  it('ShadowReaderMasterView renders correctly', () => {
    render(<ShadowReaderMasterView projectId="p1" />)
    expect(screen.getByText(/读者知识与误读复核/)).toBeDefined()
    expect(screen.getByText(/本地定位词项复核问题/)).toBeDefined()
    expect(screen.getByText(/来源：即时规则/)).toBeDefined()
  })

  it('ShadowReaderDrawer renders correctly', () => {
    render(
      <ShadowReaderDrawer projectId="p1" currentText="林凡一剑封喉！全场寂静，倒吸一口凉气！" />,
    )
    expect(screen.getByText(/读者视角问题/)).toBeDefined()
    expect(screen.queryByText(/毒点安全/)).not.toBeInTheDocument()
  })

  it('没有活动章节时不伪造正文，也不允许归档弹幕', () => {
    render(<ShadowReaderMasterView projectId="p1" />)

    expect(screen.getByRole('textbox', { name: /章节正文推演区/ })).toHaveValue('')
    expect(screen.queryByText(/长夜漫漫/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /存入项目弹幕库/ })).toBeDisabled()
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

    const textarea = screen.getByRole('textbox', { name: /章节正文推演区/ })
    expect(textarea).toHaveValue('标题\n甲乙\n丙')
    expect(screen.getByText(/当前章节：/)).toHaveTextContent('第一章')
    expect(screen.getByRole('button', { name: /存入项目弹幕库/ })).toBeDisabled()

    const nextChapter = {
      ...chapter,
      id: 'shadow-reader-chapter-2',
      content: '<p>她没有跪下。</p>',
      revision: 3,
    }
    view.rerender(
      <DesktopPluginHostProvider projectId="p1" activeChapter={nextChapter}>
        <ShadowReaderMasterView projectId="p1" />
      </DesktopPluginHostProvider>,
    )

    await waitFor(() => expect(textarea).toHaveValue('她没有跪下。'))
    fireEvent.click(screen.getByRole('button', { name: /存入项目弹幕库/ }))
    await waitFor(() => expect(screen.getByText('来源保存修订 3')).toBeInTheDocument())

    fireEvent.change(textarea, { target: { value: '她没有跪下，按下报警器。' } })
    fireEvent.click(screen.getByRole('button', { name: /存入项目弹幕库/ }))
    await waitFor(() =>
      expect(screen.getByText('本地编辑副本，未绑定保存修订')).toBeInTheDocument(),
    )
  })
})
