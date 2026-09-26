import { describe, it, expect } from 'vitest'
import type { ReactElement } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tooltip, TooltipProvider } from './tooltip'

const wrap = (ui: ReactElement) => render(<TooltipProvider delay={0}>{ui}</TooltipProvider>)

describe('Tooltip 门面', () => {
  it('悬停后显示内容，离开后消失', async () => {
    wrap(
      <Tooltip content="切换到草稿">
        <button>草稿</button>
      </Tooltip>,
    )
    expect(screen.queryByText('切换到草稿')).not.toBeInTheDocument()
    const trigger = screen.getByRole('button', { name: '草稿' })
    await userEvent.hover(trigger)
    // Base UI 的 Tooltip 气泡是 role=presentation：关联靠 aria-describedby 建立，
    // 所以这里按文本查，不假设它是个 role=tooltip 的 landmark。
    expect(await screen.findByText('切换到草稿')).toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-describedby')
    await userEvent.unhover(trigger)
    expect(screen.queryByText('切换到草稿')).not.toBeInTheDocument()
  })

  it('纯图标触发器自动补 aria-label，迁走 title 后不掉可访问名', () => {
    wrap(
      <Tooltip content="导出为 Markdown">
        <button>{null}</button>
      </Tooltip>,
    )
    expect(screen.getByRole('button', { name: '导出为 Markdown' })).toBeInTheDocument()
  })

  it('已有 aria-label 的触发器不被覆盖', () => {
    wrap(
      <Tooltip content="提示文案">
        <button aria-label="既有名称" />
      </Tooltip>,
    )
    expect(screen.getByRole('button', { name: '既有名称' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '提示文案' })).not.toBeInTheDocument()
  })

  it('有可见文字的触发器不补 aria-label，避免名称与文字脱钩', () => {
    wrap(
      <Tooltip content="说明">
        <button>保存</button>
      </Tooltip>,
    )
    const btn = screen.getByRole('button')
    expect(btn.getAttribute('aria-label')).toBeNull()
    expect(btn).toHaveAccessibleName('保存')
  })
})
