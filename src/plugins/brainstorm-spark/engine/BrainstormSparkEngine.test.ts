import { describe, it, expect } from 'vitest'
import { BrainstormSparkEngine } from './BrainstormSparkEngine'

describe('BrainstormSparkEngine', () => {
  it('returns reviewable options that carry the supplied goal and opposing conditions', () => {
    const solutions = BrainstormSparkEngine.generateSolutions({
      dilemmaType: 'dead_end',
      coreProblem: '主角被元婴老怪大阵封锁',
      currentSituation: '四面楚歌，退路断绝',
      protagonistGoal: '突围遁走',
      enemyAdvantage: '大阵灵力无穷且境界压制',
      knownResources: ['一枚烟雾弹'],
      constraints: ['不能伤害同伴'],
    })

    expect(solutions).toHaveLength(8)
    expect(solutions[0].operatorId).toBe('op_space_swap')
    expect(solutions[0].concretePlot).toContain('突围遁走')
    expect(solutions[0].concretePlot).toContain('一枚烟雾弹')
    expect(solutions[0].concretePlot).toContain('不能伤害同伴')
    expect(solutions[0].cons).toContain('大阵灵力无穷且境界压制')
    expect(solutions.every((solution) => solution.status === 'creative_option')).toBe(true)
    expect(solutions[2].operatorId).toBe('op_third_party')
  })
})
