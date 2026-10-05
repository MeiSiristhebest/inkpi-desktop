import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScoreProvenanceBadge } from './ScoreProvenanceBadge'
import { scoreProvenanceLabel } from './scoreProvenance'
import type { ScoreProvenance } from './scoreProvenance'

/**
 * §P2.5 要求评分型功能把来源标出来，而且语言只能是那五种之一：一旦有插件把「即时规则」写成
 * 「模型预测」，作者就会把一个关键词公式当成读者行为的数据看。
 */
const VOCABULARY: ScoreProvenance[] = ['rule', 'ai', 'historical', 'user', 'inference']

describe('ScoreProvenanceBadge（P2.5）', () => {
  it('把来源写在数字旁边，而不是等作者去翻插件说明', () => {
    render(<ScoreProvenanceBadge source="rule" />)
    expect(screen.getByTestId('score-provenance')).toHaveTextContent('来源：即时规则')
  })

  it('覆盖计划规定的全部五种来源', () => {
    expect(VOCABULARY.map(scoreProvenanceLabel)).toEqual([
      '即时规则',
      'AI 分析',
      '历史数据模型',
      '用户设定',
      '推测',
    ])
  })

  it('允许插件补一句这一处评分的口径', () => {
    render(<ScoreProvenanceBadge source="rule" detail="按章尾悬念词与断句密度计分" />)
    expect(screen.getByTestId('score-provenance')).toHaveTextContent('按章尾悬念词与断句密度计分')
  })
})
