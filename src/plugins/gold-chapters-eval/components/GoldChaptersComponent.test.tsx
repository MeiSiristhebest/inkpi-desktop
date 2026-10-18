import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GoldChaptersMasterView } from './GoldChaptersMasterView'
import { GoldChaptersDrawer } from './GoldChaptersDrawer'

describe('GoldChaptersEval UI Components', () => {
  it('GoldChaptersMasterView renders correctly', () => {
    render(<GoldChaptersMasterView projectId="p1" />)
    expect(screen.getByText(/黄金三章开篇文本诊断/)).toBeDefined()
    expect(screen.getByText(/不预测签约、订阅或读者反应/)).toBeDefined()
    expect(screen.getByText(/没有正文，无法分析/)).toBeDefined()
    expect(screen.queryByText(/综合规则评分|规则阈值已达标|规则阈值未达标/)).not.toBeInTheDocument()
    expect(screen.queryByText(/过稿|拒签|签约潜力/)).not.toBeInTheDocument()
  })

  it('GoldChaptersDrawer renders correctly', () => {
    render(<GoldChaptersDrawer projectId="p1" currentText="林凡发誓要复仇，觉醒了金手指系统！" />)
    expect(screen.getByText(/黄金三章文本规则检查/)).toBeDefined()
    expect(screen.getByText(/不读取真实平台或读者数据/)).toBeDefined()
    expect(screen.getByText('「复仇」')).toBeDefined()
    expect(screen.queryByText(/规则阈值|\d+ 分/)).not.toBeInTheDocument()
  })
})
