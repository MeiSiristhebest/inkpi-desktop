import { describe, it, expect } from 'vitest'
import { AudioSynthesizerEngine } from './AudioSynthesizerEngine'

describe('AudioSynthesizerEngine (机械键盘物理声学合成引擎)', () => {
  it('根据不同轴体输出准确的瞬态与共鸣频率参数', () => {
    const blueParams = AudioSynthesizerEngine.getSwitchParams('blue')
    expect(blueParams.transientFreq).toBe(3200)
    expect(blueParams.transientDecay).toBeLessThan(0.02)

    const brownParams = AudioSynthesizerEngine.getSwitchParams('brown')
    expect(brownParams.transientFreq).toBe(1100)

    const vintageParams = AudioSynthesizerEngine.getSwitchParams('vintage')
    expect(vintageParams.transientFreq).toBe(2200)
    expect(vintageParams.resonanceDecay).toBeGreaterThan(0.05)
  })

  it('在未提供 Web Audio 的环境报告明确错误并允许安全停止', async () => {
    const engine = new AudioSynthesizerEngine()
    await expect(engine.triggerKeyPress('blue')).rejects.toThrow('不支持 Web Audio')
    await expect(engine.startAmbience('rain')).rejects.toThrow('不支持 Web Audio')
    expect(() => engine.stopAmbience()).not.toThrow()
  })
})
