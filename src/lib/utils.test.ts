import { describe, expect, it } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn', () => {
  it('忽略 clsx 的 falsy 值', () => {
    expect(cn('a', undefined, null, false, '', 0, 'c')).toBe('a c')
  })

  it('让后声明的工具类覆盖同类冲突', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('保留任意值语法', () => {
    expect(cn('bg-[var(--ink-bg)]', 'text-[11px]')).toBe('bg-[var(--ink-bg)] text-[11px]')
  })
})
