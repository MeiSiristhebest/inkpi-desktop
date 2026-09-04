import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { SelectionToolbar } from './SelectionToolbar'

// 用可受控的假编辑器验证：空选区不渲染、有选区才渲染，且全程不抛错（不依赖 tippy/portal）
const makeEditor = (selection: { from: number; to: number }) => {
  const handlers: Record<string, (() => void) | undefined> = {}
  const editor: any = {
    isActive: () => false,
    state: {
      selection,
      doc: { textBetween: () => '选中文本' },
    },
    view: {
      coordsAtPos: () => ({ top: 100, left: 50, right: 150, bottom: 120 }),
    },
    on: (evt: string, cb: () => void) => {
      handlers[evt] = cb
    },
    off: () => {},
    chain: () => ({ focus: () => ({ toggleBold: () => ({ run: vi.fn() }) }) }),
  }
  return { editor, handlers }
}

const containerRef: any = {
  current: {
    getBoundingClientRect: () => ({ top: 0, left: 0, right: 800, bottom: 600 }),
    scrollTop: 0,
  },
}

describe('SelectionToolbar', () => {
  it('空选区时不渲染任何工具按钮（返回 null，避免 DOM 冲突）', () => {
    const { editor } = makeEditor({ from: 0, to: 0 })
    render(<SelectionToolbar editor={editor} containerRef={containerRef} />)
    expect(screen.queryByTitle('加粗')).toBeNull()
  })

  it('有选区时渲染加粗/斜体/AI 润色，且触发 selectionUpdate 后能正确显示', () => {
    const { editor, handlers } = makeEditor({ from: 0, to: 5 })
    render(<SelectionToolbar editor={editor} containerRef={containerRef} />)

    // 初始仍不渲染
    expect(screen.queryByTitle('加粗')).toBeNull()

    // 模拟编辑器发出选区变化事件
    act(() => {
      handlers['selectionUpdate']?.()
    })

    expect(screen.getByTitle('加粗')).toBeInTheDocument()
    expect(screen.getByTitle('斜体')).toBeInTheDocument()
    expect(screen.getByText('AI 润色')).toBeInTheDocument()
  })

  it('编辑器无 on/off（或已销毁）时不附加监听、不崩溃', () => {
    const { editor } = makeEditor({ from: 0, to: 5 })
    delete editor.on
    delete editor.off
    render(<SelectionToolbar editor={editor} containerRef={containerRef} />)
    expect(screen.queryByTitle('加粗')).toBeNull()
  })
})
