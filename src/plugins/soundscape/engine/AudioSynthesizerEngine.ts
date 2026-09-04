import type { MechanicalSwitchType, AmbienceType, SynthParams } from "../types"
import type { RandomSource } from "../../../ports/randomSource"
import { randomSource as defaultRandomSource } from "../../../adapters/randomSource"

/**
 * AudioSynthesizerEngine
 *
 * 理论基础：纯物理声学建模合成（Web Audio API Physical Acoustic Modeling）
 * - 零外部音频依赖：全部声音由 Oscillator / BufferSource / BiquadFilter 实时物理合成
 * - 青轴 (Clicky): 高频瞬态冲击 (2.5kHz-4kHz) + 腔体共鸣
 * - 茶轴 (Tactile): 800Hz 中频带通衰减
 * - 粉红噪音与篝火白噪音发生器
 */
export class AudioSynthesizerEngine {
  private audioCtx: AudioContext | null = null
  private noiseNode: AudioNode | null = null
  private noiseGain: GainNode | null = null
  private isAmbiencePlaying = false
  private randomSource: RandomSource

  constructor(random?: RandomSource) {
    this.randomSource = random || defaultRandomSource
  }

  public getContext(): AudioContext | null {
    if (typeof window === "undefined") return null
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass()
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {})
    }
    return this.audioCtx
  }

  /**
   * 获得不同机械轴体的物理合成参数
   */
  public static getSwitchParams(switchType: MechanicalSwitchType): SynthParams {
    switch (switchType) {
      case "blue": // 青轴：尖锐段落高音 + 金属撞击
        return {
          transientFreq: 3200,
          resonanceFreq: 320,
          transientDecay: 0.012,
          resonanceDecay: 0.045,
          volume: 0.7,
        }
      case "brown": // 茶轴：沉稳段落，无刺耳高频
        return {
          transientFreq: 1100,
          resonanceFreq: 240,
          transientDecay: 0.018,
          resonanceDecay: 0.035,
          volume: 0.55,
        }
      case "vintage": // 老式打字机：厚重机簧反弹
        return {
          transientFreq: 2200,
          resonanceFreq: 180,
          transientDecay: 0.03,
          resonanceDecay: 0.08,
          volume: 0.8,
        }
      case "silent": // 静音红轴：仅微弱触底阻尼
      default:
        return {
          transientFreq: 600,
          resonanceFreq: 120,
          transientDecay: 0.01,
          resonanceDecay: 0.02,
          volume: 0.3,
        }
    }
  }

  /**
   * 触发单次机械键盘敲击音效 (包含 ±3% 频率微扰，避免机关枪效应)
   */
  public triggerKeyPress(switchType: MechanicalSwitchType, masterVolume = 0.5): void {
    const ctx = this.getContext()
    if (!ctx) return

    const baseParams = AudioSynthesizerEngine.getSwitchParams(switchType)
    // 随机微扰系数 0.97 ~ 1.03
    const jitter = 0.97 + this.randomSource.next() * 0.06
    const now = ctx.currentTime

    // 1. 瞬态冲击发生器 (Transient)
    const oscTransient = ctx.createOscillator()
    const gainTransient = ctx.createGain()

    oscTransient.type = "sine"
    oscTransient.frequency.setValueAtTime(baseParams.transientFreq * jitter, now)
    oscTransient.frequency.exponentialRampToValueAtTime(100, now + baseParams.transientDecay)

    gainTransient.gain.setValueAtTime(baseParams.volume * masterVolume, now)
    gainTransient.gain.exponentialRampToValueAtTime(0.001, now + baseParams.transientDecay)

    oscTransient.connect(gainTransient)
    gainTransient.connect(ctx.destination)

    oscTransient.start(now)
    oscTransient.stop(now + baseParams.transientDecay)

    // 2. 腔体共鸣发生器 (Resonance)
    const oscRes = ctx.createOscillator()
    const gainRes = ctx.createGain()

    oscRes.type = "triangle"
    oscRes.frequency.setValueAtTime(baseParams.resonanceFreq * jitter, now)

    gainRes.gain.setValueAtTime(baseParams.volume * masterVolume * 0.6, now)
    gainRes.gain.exponentialRampToValueAtTime(0.001, now + baseParams.resonanceDecay)

    oscRes.connect(gainRes)
    gainRes.connect(ctx.destination)

    oscRes.start(now)
    oscRes.stop(now + baseParams.resonanceDecay)
  }

  /**
   * 启动环境背景白噪音（雨声/篝火/古刹钟鸣）
   */
  public startAmbience(ambience: AmbienceType, volume = 0.3): void {
    if (ambience === "none") {
      this.stopAmbience()
      return
    }

    const ctx = this.getContext()
    if (!ctx) return
    this.stopAmbience()

    const bufferSize = ctx.sampleRate * 2
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const output = noiseBuffer.getChannelData(0)

    // 生成 1/f 粉红噪音 (Pink Noise)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
    for (let i = 0; i < bufferSize; i++) {
      const white = this.randomSource.next() * 2 - 1
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.96900 * b2 + white * 0.1538520
      b3 = 0.86650 * b3 + white * 0.3104856
      b4 = 0.55000 * b4 + white * 0.5329522
      b5 = -0.7616 * b5 - white * 0.0168980
      output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362
      output[i] *= 0.11
      b6 = white * 0.115926
    }

    const whiteNoise = ctx.createBufferSource()
    whiteNoise.buffer = noiseBuffer
    whiteNoise.loop = true

    const filter = ctx.createBiquadFilter()
    if (ambience === "rain") {
      filter.type = "lowpass"
      filter.frequency.value = 1000 // 雨声低通滤波
    } else if (ambience === "campfire") {
      filter.type = "bandpass"
      filter.frequency.value = 500 // 篝火频段
    } else {
      filter.type = "lowpass"
      filter.frequency.value = 400
    }

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(volume * 0.5, ctx.currentTime)

    whiteNoise.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)

    whiteNoise.start()
    this.noiseNode = whiteNoise
    this.noiseGain = gain
    this.isAmbiencePlaying = true
  }

  /**
   * 停止背景白噪音
   */
  public stopAmbience(): void {
    if (this.noiseNode && "stop" in this.noiseNode) {
      try {
        (this.noiseNode as AudioScheduledSourceNode).stop()
      } catch {}
      this.noiseNode.disconnect()
      this.noiseNode = null
    }
    if (this.noiseGain) {
      this.noiseGain.disconnect()
      this.noiseGain = null
    }
    this.isAmbiencePlaying = false
  }

  public getIsAmbiencePlaying(): boolean {
    return this.isAmbiencePlaying
  }
}
