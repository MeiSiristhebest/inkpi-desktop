import { describe, it, expect, vi, afterEach } from 'vitest'
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

  it('锚点滚出视口时仍把菜单放在可见区域内', () => {
    const widthDescriptor = Object.getOwnPropertyDescriptor(window, 'innerWidth')
    const heightDescriptor = Object.getOwnPropertyDescriptor(window, 'innerHeight')
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 900 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })

    const makeRect = (x: number, y: number, width: number, height: number) =>
      ({
        x,
        y,
        width,
        height,
        top: y,
        left: x,
        right: x + width,
        bottom: y + height,
        toJSON: () => ({}),
      }) as DOMRect
    const anchorRect = makeRect(864, -90, 26, 26)
    const menuRect = makeRect(572, -64, 318, 630)
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        if (this.getAttribute('role') === 'menu') return menuRect
        if (this.classList.contains('relative')) return anchorRect
        return makeRect(0, 0, 0, 0)
      })

    let unmount = () => {}
    try {
      const view = render(
        <div className="relative">
          <ContextMenu items={makeItems()} onClose={vi.fn()} />
        </div>,
      )
      unmount = view.unmount

      expect(screen.getByRole('menu')).toHaveStyle({ left: '572px', top: '8px' })
    } finally {
      unmount()
      rectSpy.mockRestore()
      if (widthDescriptor) Object.defineProperty(window, 'innerWidth', widthDescriptor)
      else Reflect.deleteProperty(window, 'innerWidth')
      if (heightDescriptor) Object.defineProperty(window, 'innerHeight', heightDescriptor)
      else Reflect.deleteProperty(window, 'innerHeight')
    }
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

  it('disabled 条目具备 aria-disabled="true"，点击或回车均不触发动作且不关闭菜单', () => {
    const disabledOnClick = vi.fn()
    const normalOnClick = vi.fn()
    const onClose = vi.fn()
    const items: ContextMenuItem[] = [
      { key: 'dis', label: '不可用操作', disabled: true, onClick: disabledOnClick },
      { key: 'ok', label: '可用操作', onClick: normalOnClick },
    ]
    render(<ContextMenu items={items} onClose={onClose} />)

    const menuitems = screen.getAllByRole('menuitem')
    expect(menuitems[0]).toHaveAttribute('aria-disabled', 'true')
    expect(menuitems[1]).toHaveAttribute('aria-disabled', 'false')

    // 点击禁用项
    fireEvent.click(menuitems[0])
    expect(disabledOnClick).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()

    // 回车激活禁用项
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Enter' })
    expect(disabledOnClick).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()

    // 导航到可用项并回车
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(menuitems[1])
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Enter' })
    expect(normalOnClick).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
