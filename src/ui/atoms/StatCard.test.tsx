import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Flame } from 'lucide-react'
import { StatCard } from './StatCard'

describe('StatCard atom', () => {
  afterEach(() => cleanup())

  it('renders semantic dl/dt/dd structure with label, value, and sub', () => {
    render(<StatCard label="总字数" value="128,450" sub="较昨日 +3,200" icon={Flame} />)
    expect(screen.getByText('总字数').tagName).toBe('DT')
    expect(screen.getByText('128,450').closest('dd')).toBeInTheDocument()
    expect(screen.getByText('较昨日 +3,200').tagName).toBe('DD')
  })

  it('renders trend indicator with accessible aria-label', () => {
    render(
      <StatCard
        label="时速"
        value="1,850"
        icon={Flame}
        trend={{ direction: 'up', label: '环比上升 12%' }}
      />,
    )
    const trend = screen.getByLabelText('环比上升 12%')
    expect(trend).toBeInTheDocument()
    expect(trend).toHaveTextContent('↑')
  })
})
