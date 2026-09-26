import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import * as facade from './index'
import { Button } from './button'

describe('Button 门面', () => {
  it('渲染可聚焦的原生 button，并保持文本内容', () => {
    render(<Button>保存到书架</Button>)
    expect(screen.getByRole('button', { name: '保存到书架' })).toBeInTheDocument()
  })

  it('variant 只通过 Tailwind 工具类表达，default 与 outline 取色不同', () => {
    const { unmount } = render(<Button variant="default">a</Button>)
    const defaultClass = screen.getByRole('button', { name: 'a' }).className
    unmount()

    render(<Button variant="outline">b</Button>)
    const outlineClass = screen.getByRole('button', { name: 'b' }).className

    expect(defaultClass).toContain('bg-primary')
    expect(outlineClass).toContain('border-border')
    expect(outlineClass).not.toContain('bg-primary')
  })

  it('调用点的 className 覆盖变体，而不是与变体并列冲突', () => {
    render(
      <Button variant="outline" className="border-primary">
        c
      </Button>,
    )
    const cls = screen.getByRole('button', { name: 'c' }).className
    expect(cls).toContain('border-primary')
    expect(cls).not.toContain('border-border')
  })

  it('门面只导出 InkPi 自己的组件名，不泄漏引擎符号', () => {
    expect(Object.keys(facade).sort()).toEqual(['Button', 'buttonVariants'])
  })
})
