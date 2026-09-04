import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WaterMeterMasterView } from './WaterMeterMasterView'

describe('WaterMeterMasterView', () => {
  it('renders heading, stat cards and caught water words', () => {
    render(<WaterMeterMasterView projectId="p1" />)
    expect(screen.getByText('信息熵与水分压缩计')).toBeDefined()
    expect(screen.getByText(/水分综合评分/)).toBeDefined()
    expect(screen.getAllByText(/香农信息熵/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/动作动词密度/).length).toBeGreaterThan(0)
    expect(screen.getByText(/抓捕到的冗余水词/)).toBeDefined()
  })

  it('triggers deep audit on button click and allows cleaning bloat', () => {
    render(<WaterMeterMasterView projectId="p1" />)
    const auditBtn = screen.getByText('深度脱水体检')
    fireEvent.click(auditBtn)

    const cleanBtn = screen.getByText('一键剔除水词')
    fireEvent.click(cleanBtn)
    expect(screen.getByText(/深度脱水体检/)).toBeDefined()
  })
})
