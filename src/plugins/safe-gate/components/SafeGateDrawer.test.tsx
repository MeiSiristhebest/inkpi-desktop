import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { SafeGateDrawer } from './SafeGateDrawer'

describe('SafeGateDrawer — 写作台敏感词审查随动感知抽屉', () => {
  it('renders clean state when current text has no violations', () => {
    render(<SafeGateDrawer projectId="p1" currentText="山间清风拂面，道人盘膝而坐。" />)
    expect(screen.getByText('实时敏感词审查')).toBeInTheDocument()
    expect(screen.getByText('当前正文合规无风险')).toBeInTheDocument()
  })

  it('detects violations and renders literary replacement pills', async () => {
    render(
      <SafeGateDrawer
        projectId="p1"
        currentText="魔修一掌拍出，顿时血肉横飞！"
      />,
    )

    await waitFor(
      () => {
        expect(screen.getByText('命中「血肉横飞」')).toBeInTheDocument()
        expect(screen.getByText('过度血腥')).toBeInTheDocument()
      },
      { timeout: 1000 },
    )
  })
})
