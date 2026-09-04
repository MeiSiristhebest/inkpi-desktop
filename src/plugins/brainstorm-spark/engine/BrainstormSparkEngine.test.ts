import { describe, it, expect } from 'vitest'
import { BrainstormSparkEngine } from './BrainstormSparkEngine'

describe('BrainstormSparkEngine', () => {
  it('generates 8 structured inversion solutions for any dilemma', () => {
    const solutions = BrainstormSparkEngine.generateSolutions({
      dilemmaType: 'dead_end',
      coreProblem: '主角被元婴老怪大阵封锁',
      currentSituation: '四面楚歌，退路断绝',
      protagonistGoal: '突围遁走',
      enemyAdvantage: '大阵灵力无穷且境界压制',
    })

    expect(solutions).toHaveLength(8)
    expect(solutions[0].operatorId).toBe('op_space_swap')
    expect(solutions[0].concretePlot).toContain('大阵灵力无穷')
    expect(solutions[2].operatorId).toBe('op_third_party')
  })
})
