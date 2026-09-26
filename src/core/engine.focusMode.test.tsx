import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import {
  render as baseRender,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  act,
} from '@testing-library/react'
import { Engine } from './engine'
import { SettingsProvider } from './settings'

// 只记录写作内核的挂载/卸载：聚焦模式可以收起周边界面，但不能把编辑器换掉，
// 否则自动存盘、写作时长心跳与草稿日志会跟着一起被拆掉（P3.11）。
const kernel = vi.hoisted(() => ({ mounts: 0, unmounts: 0 }))

vi.mock('@tiptap/react', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  const React = await import('react')
  const noop = () => {}
  const makeCommands = () => ({
    setContent: vi.fn(),
    insertContent: vi.fn(),
    focus: () => ({ toggleBold: () => ({ run: noop }), toggleItalic: () => ({ run: noop }) }),
    chain: () => ({
      focus: () => ({ toggleBold: () => ({ run: noop }), toggleItalic: () => ({ run: noop }) }),
    }),
  })
  const useEditor = () => ({
    getHTML: () => '<p>x</p>',
    getText: () => 'x',
    isActive: () => false,
    commands: makeCommands(),
    state: { doc: { textBetween: () => '', content: { size: 0 } }, selection: { from: 0, to: 0 } },
    view: {
      state: { selection: { to: 0 }, doc: { content: { size: 0 } }, tr: { setMeta: vi.fn() } },
      dispatch: vi.fn(),
    },
  })
  const EditorContent = () => {
    React.useEffect(() => {
      kernel.mounts += 1
      return () => {
        kernel.unmounts += 1
      }
    }, [])
    return React.createElement('div', { 'data-testid': 'tiptap-editor' })
  }
  const BubbleMenu = ({ children }: { children?: ReactNode }) =>
    React.createElement(React.Fragment, null, children)
  return { ...actual, useEditor, EditorContent, BubbleMenu }
})

// 依赖 SettingsProvider：Engine 默认挂载 RichEditor，而后者通过 useSettings 取设置。
const render = (ui: Parameters<typeof baseRender>[0], options?: Parameters<typeof baseRender>[1]) =>
  baseRender(<SettingsProvider>{ui}</SettingsProvider>, options)

const setViewportWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
}

const defaultViewportWidth = window.innerWidth

beforeEach(() => {
  setViewportWidth(1440)
  kernel.mounts = 0
  kernel.unmounts = 0
})

afterEach(() => {
  cleanup()
  setViewportWidth(defaultViewportWidth)
})

describe('Engine — 聚焦模式只收起界面外壳（P3.11）', () => {
  it('进入聚焦：三层外壳都不在，写作内核还是同一个实例', () => {
    render(
      <Engine
        projectId="p1"
        defaultRightOpen={true}
        rightPanel={<div data-testid="right-probe" />}
      />,
    )

    expect(screen.getByTestId('sidebar-nav')).toBeInTheDocument()
    expect(screen.getByTestId('project-engine-right-panel')).toBeInTheDocument()
    expect(screen.getByText('章节目录')).toBeInTheDocument()
    expect(kernel).toEqual({ mounts: 1, unmounts: 0 })

    fireEvent.click(screen.getByTitle('聚焦模式（仅留写作画布）'))

    expect(screen.queryByTestId('sidebar-nav')).not.toBeInTheDocument()
    expect(screen.queryByTestId('project-engine-right-panel')).not.toBeInTheDocument()
    expect(screen.queryByText('章节目录')).not.toBeInTheDocument()
    // 外壳收起来了，但编辑器没有被卸载重挂：自动存盘与会话统计继续跑
    expect(screen.getByTestId('tiptap-editor')).toBeInTheDocument()
    expect(kernel).toEqual({ mounts: 1, unmounts: 0 })
  })

  it('Esc 退出聚焦：外壳原样回来，写作内核依旧没有被重建', () => {
    render(
      <Engine
        projectId="p1"
        defaultRightOpen={true}
        rightPanel={<div data-testid="right-probe" />}
      />,
    )
    fireEvent.click(screen.getByTitle('聚焦模式（仅留写作画布）'))
    expect(screen.getByText(/退出聚焦/)).toBeInTheDocument()

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })

    expect(screen.queryByText(/退出聚焦/)).not.toBeInTheDocument()
    expect(screen.getByTestId('sidebar-nav')).toBeInTheDocument()
    expect(screen.getByTestId('project-engine-right-panel')).toBeInTheDocument()
    expect(screen.getByText('章节目录')).toBeInTheDocument()
    expect(kernel).toEqual({ mounts: 1, unmounts: 0 })
  })

  it('正对照：真正切走视图时计数器会记录卸载，所以「不增不减」不是死数字', async () => {
    render(<Engine projectId="p1" />)
    expect(kernel).toEqual({ mounts: 1, unmounts: 0 })

    fireEvent.click(screen.getByText('写作面板'))

    await waitFor(() => expect(kernel).toEqual({ mounts: 1, unmounts: 1 }))
    fireEvent.click(screen.getAllByText('正文写作')[0])
    await waitFor(() => expect(kernel).toEqual({ mounts: 2, unmounts: 1 }))
  })
})
