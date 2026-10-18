import { describe, expect, it } from 'vitest'
import { BrainstormSparkEngine } from './BrainstormSparkEngine'
describe('constrained creative options', () => {
  it('does not fill missing goals or invent genre powers and outcomes', () => {
    const options = BrainstormSparkEngine.generateSolutions({
      dilemmaType: 'moral_dilemma',
      coreProblem: '编辑必须公布事实',
      currentSituation: '报社会议',
      protagonistGoal: '保留证人的匿名身份',
      enemyAdvantage: '对方掌握原始录像',
    })
    const text = JSON.stringify(options)
    expect(text).toContain('匿名身份')
    expect(text).not.toMatch(/遁术|灵兵|灵力|天道|雷劫|最佳解法|纳什/)
    expect(options.every((o) => o.status === 'creative_option')).toBe(true)
  })
  it('returns no generated option when the actual problem is blank', () => {
    expect(
      BrainstormSparkEngine.generateSolutions({
        dilemmaType: 'dead_end',
        coreProblem: '',
        currentSituation: '',
        protagonistGoal: '',
        enemyAdvantage: '',
      }),
    ).toEqual([])
  })
})
