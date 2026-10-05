import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ContextMenu, type ContextMenuItem } from './ContextMenu'

const makeItems = (count = 3): ContextMenuItem[] =>
  Array.from({ length: count }, (_, i) => ({
    key: `item-${i}`,
    label: `Item ${i + 1}`,
    onClick: vi.fn(),
  }))

describe('ContextMenu primitive', () => {
  afterEach(() => cleanup())

  it('renders with role="menu"', () => {
    render(<ContextMenu items={makeItems()} onClose={vi.fn()} />)
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('items have role="menuitem"', () => {
    render(<ContextMenu items={makeItems(3)} onClose={vi.fn()} />)
    expect(screen.getAllByRole('menuitem')).toHaveLength(3)
  })

  it('focuses the first item on open', () => {
    render(<ContextMenu items={makeItems(3)} onClose={vi.fn()} />)
    const items = screen.getAllByRole('menuitem')
    expect(document.activeElement).toBe(items[0])
  })

  it('closes on Escape key', () => {
    const onClose = vi.fn()
    render(<ContextMenu items={makeItems()} onClose={onClose} />)
    // Escape is handled at window level
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('navigates with ArrowDown', () => {
    render(<ContextMenu items={makeItems(3)} onClose={vi.fn()} />)
    const items = screen.getAllByRole('menuitem')
    expect(document.activeElement).toBe(items[0])

    // Fire on the container div which has onKeyDown
    const container = screen.getByRole('menu')
    fireEvent.keyDown(container, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[1])

    fireEvent.keyDown(container, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[2])
  })

  it('navigates with ArrowUp (wraps to end)', () => {
    render(<ContextMenu items={makeItems(3)} onClose={vi.fn()} />)
    const items = screen.getAllByRole('menuitem')

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' })
    expect(document.activeElement).toBe(items[2])
  })

  it('Home moves to first item', () => {
    render(<ContextMenu items={makeItems(3)} onClose={vi.fn()} />)
    const items = screen.getAllByRole('menuitem')
    const container = screen.getByRole('menu')
    fireEvent.keyDown(container, { key: 'ArrowDown' })
    fireEvent.keyDown(container, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[2])

    fireEvent.keyDown(container, { key: 'Home' })
    expect(document.activeElement).toBe(items[0])
  })

  it('End moves to last item', () => {
    render(<ContextMenu items={makeItems(3)} onClose={vi.fn()} />)
    const items = screen.getAllByRole('menuitem')
    expect(document.activeElement).toBe(items[0])

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'End' })
    expect(document.activeElement).toBe(items[2])
  })

  it('Enter activates the focused item', () => {
    const items = makeItems(3)
    render(<ContextMenu items={items} onClose={vi.fn()} />)
    const container = screen.getByRole('menu')
    fireEvent.keyDown(container, { key: 'ArrowDown' })
    fireEvent.keyDown(container, { key: 'Enter' })
    expect(items[1].onClick).toHaveBeenCalledTimes(1)
  })

  it('clicking an item calls its onClick and onClose', () => {
    const onClose = vi.fn()
    const items = makeItems(2)
    render(<ContextMenu items={items} onClose={onClose} />)
    const [first] = screen.getAllByRole('menuitem')
    fireEvent.click(first)
    expect(items[0].onClick).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose on Escape without activating any item', () => {
    const onClose = vi.fn()
    const items = makeItems(2)
    render(<ContextMenu items={items} onClose={onClose} />)
    // Escape handled at window level
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(items[0].onClick).not.toHaveBeenCalled()
    expect(items[1].onClick).not.toHaveBeenCalled()
  })

  it('光标锚定时以 fixed 定位到给定坐标，并渲染非交互标题', () => {
    render(
      <ContextMenu
        items={makeItems(2)}
        position={{ x: 120, y: 340 }}
        header="第一章 测灵大典"
        ariaLabel="章节操作"
        onClose={vi.fn()}
      />,
    )
    const menu = screen.getByRole('menu')
    expect(menu).toHaveClass('fixed')
    expect(menu).toHaveStyle({ left: '120px', top: '340px' })
    expect(menu).toHaveAttribute('aria-label', '章节操作')
    expect(screen.getByText('第一章 测灵大典')).toBeInTheDocument()
    // 标题不得进入焦点序列：只有两个条目是按钮
    expect(screen.getAllByRole('menuitem')).toHaveLength(2)
  })

  it('checked 项渲染为 menuitemradio，键盘导航同样覆盖', () => {
    const items: ContextMenuItem[] = [
      { key: 'a', label: 'A', onClick: vi.fn() },
      { key: 'b', label: 'B', checked: true, onClick: vi.fn() },
      { key: 'c', label: 'C', checked: false, onClick: vi.fn() },
    ]
    render(<ContextMenu items={items} onClose={vi.fn()} />)

    const radios = screen.getAllByRole('menuitemradio')
    expect(radios).toHaveLength(2)
    expect(radios[0]).toHaveAttribute('aria-checked', 'true')
    expect(radios[1]).toHaveAttribute('aria-checked', 'false')
    expect(screen.getAllByRole('menu')).toHaveLength(1)
    expect(screen.getByRole('menuitem')).toBeInTheDocument()
  })

  it('分组小标题与说明只作展示，不占用焦点、也不改写无障碍名称', () => {
    const items: ContextMenuItem[] = [
      {
        key: 'a',
        label: '活体世界书',
        description: '人物与设定的实时档案',
        groupLabel: '设定与世界书',
        onClick: vi.fn(),
      },
      { key: 'b', label: '叙事体检', onClick: vi.fn() },
    ]
    const onClose = vi.fn()
    render(<ContextMenu items={items} onClose={onClose} />)

    expect(screen.getByText('设定与世界书')).toBeInTheDocument()
    expect(screen.getByText('人物与设定的实时档案')).toBeInTheDocument()
    // 分组与说明都不得成为可聚焦条目：焦点序列里只有两个 menuitem
    const menuitems = screen.getAllByRole('menuitem')
    expect(menuitems).toHaveLength(2)
    expect(document.activeElement).toBe(menuitems[0])
    expect(menuitems[0]).toHaveAccessibleName(/^活体世界书/)
    // 条目不挂提示：label 与 description 本来就全部可见，再重复一遍只会挡住键盘焦点
    expect(menuitems[0]).not.toHaveAttribute('title')
    expect(menuitems[1]).not.toHaveAttribute('title')

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(menuitems[1])
  })
})
