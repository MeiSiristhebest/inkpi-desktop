import { describe, it, expect, vi } from 'vitest'
import type { ReactElement } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tooltip, TooltipProvider } from './tooltip'
import { Modal } from '../molecules/Modal'

const wrap = (ui: ReactElement) => render(<TooltipProvider delay={0}>{ui}</TooltipProvider>)

describe('Tooltip 门面', () => {
  it('悬停后显示内容，离开后消失', async () => {
    wrap(
      <Tooltip content="切换到草稿">
        <button>草稿</button>
      </Tooltip>,
    )
    const trigger = screen.getByRole('button', { name: '草稿' })
    // 关联只在气泡存在时建立：关闭态不留隐藏节点，也不留指向空 id 的 describedby
    expect(document.querySelector('[data-slot="tooltip-content"]')).toBeNull()
    expect(trigger).not.toHaveAttribute('aria-describedby')

    await userEvent.hover(trigger)
    // Base UI 的 Tooltip 气泡是 role=presentation：关联靠 aria-describedby 建立，
    // 所以这里按 data-slot 查可见气泡，不假设它是个 role=tooltip 的 landmark。
    const popup = await waitFor(() => {
      const el = document.querySelector('[data-slot="tooltip-content"]')
      expect(el).not.toBeNull()
      return el
    })
    expect(popup).toHaveTextContent('切换到草稿')
    expect(trigger).toHaveAttribute('aria-describedby', popup.id)

    await userEvent.unhover(trigger)
    await waitFor(() => expect(document.querySelector('[data-slot="tooltip-content"]')).toBeNull())
    expect(trigger).not.toHaveAttribute('aria-describedby')
  })

  it('浮层里的提示不吞掉 Esc：焦点提示关闭后按键仍交给对话框', async () => {
    const onClose = vi.fn()
    render(
      <Modal onClose={onClose}>
        <Tooltip content="切换到草稿">
          <button>草稿</button>
        </Tooltip>
      </Modal>,
    )
    // 对话框的初始聚焦会顺手把提示打开，此前 useDismiss 在这一步 stopPropagation
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
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
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
    expect(screen.getByRole('button').getAttribute('aria-label')).toBeNull()
  })

  it('图标与文字混排的触发器同样以可见文字为名', () => {
    wrap(
      <Tooltip content="提交到仓库">
        <button>
          <svg data-testid="icon" />
          提交
        </button>
      </Tooltip>,
    )
    expect(screen.getByRole('button', { name: '提交' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '提交到仓库' })).not.toBeInTheDocument()
  })

  it('content 为空时不生成气泡，触发器原样返回', () => {
    wrap(
      <Tooltip content={undefined}>
        <button>取消</button>
      </Tooltip>,
    )
    const btn = screen.getByRole('button', { name: '取消' })
    expect(btn.hasAttribute('data-base-ui-tooltip-trigger')).toBe(false)
    expect(btn).not.toHaveAttribute('aria-describedby')
    expect(document.querySelector('[data-slot="tooltip-content"]')).toBeNull()
  })
})
