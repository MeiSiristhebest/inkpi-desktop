import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ArchetypeMasterView } from './ArchetypeMasterView'
import { ArchetypeDrawer } from './ArchetypeDrawer'

describe('ArchetypeCards UI Components', () => {
  it('ArchetypeMasterView renders correctly', () => {
    render(<ArchetypeMasterView projectId="p1" />)
    expect(screen.getByText(/人格原型素材库与叙事母题卡牌/)).toBeDefined()
  })

  it('keeps the classic personality inspiration cards in the ArchetypeCards plugin', () => {
    render(<ArchetypeMasterView projectId="p1" />)
    fireEvent.click(screen.getByText('经典人物性格原型（6 张）'))

    expect(screen.getByText('清冷白月光')).toBeDefined()
    expect(screen.getByText('温润如玉君子')).toBeDefined()
  })

  it('ArchetypeDrawer renders correctly', () => {
    render(<ArchetypeDrawer projectId="p1" currentText="林凡走在大街上。" />)
    expect(screen.getByText(/人格原型灵感卡/)).toBeDefined()
  })
})
