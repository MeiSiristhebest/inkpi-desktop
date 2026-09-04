import { describe, it, expect } from 'vitest'
import { waterMeterEngine } from './WaterMeterEngine'

describe('WaterMeterEngine', () => {
  it('computes Shannon entropy correctly for varied text', () => {
    const text = '天道无情，万物刍狗。剑修一生只求一击碎苍穹。'
    const entropy = waterMeterEngine.computeShannonEntropy(text)
    expect(entropy).toBeGreaterThan(3.5)
  })

  it('detects phantom cliches and recap bloat', () => {
    const wateryText =
      '众所周知，在整个修仙界中，所有人都忍不住倒吸了一口凉气。陆沉心中掀起惊涛骇浪，暗暗心惊，只觉得自己整个人都不好了。'
    const report = waterMeterEngine.auditText(wateryText)

    expect(report.waterScore).toBeGreaterThan(40)
    expect(report.bloatItems.length).toBeGreaterThan(3)
    const types = report.bloatItems.map((b) => b.type)
    expect(types).toContain('phantom')
    expect(types).toContain('recap')
    expect(report.advice.length).toBeGreaterThan(0)
  })

  it('rates fast-paced action text as lean', () => {
    const leanActionText =
      '陆沉拔剑疾冲，剑锋横斩敌首。轰然一声巨响，山石崩塌，狂风席卷，他凌空腾跃，反手再刺一枪！'
    const report = waterMeterEngine.auditText(leanActionText)

    expect(report.actionVerbRatio).toBeGreaterThan(0.08)
    expect(report.waterLevel).toBe('lean')
    expect(report.bloatItems.length).toBe(0)
  })

  it('handles short or empty texts gracefully', () => {
    const report = waterMeterEngine.auditText('你好')
    expect(report.waterScore).toBe(0)
    expect(report.totalWordCount).toBe(2)
  })
})
