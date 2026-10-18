import type { MechanicalSwitchType, AmbienceType, SynthParams } from '../types'
import type { RandomSource } from '../../../ports/randomSource'
import { randomSource as defaultRandomSource } from '../../../adapters/randomSource'

export class AudioSynthesizerEngine {
  private audioCtx: AudioContext | null = null
  private ambienceNodes: AudioNode[] = []
  private ambienceGain: GainNode | null = null
  private ambienceSources = new Set<AudioScheduledSourceNode>()
  private sources = new Set<AudioScheduledSourceNode>()
  private nodes = new Set<AudioNode>()
  private ambienceTimer: ReturnType<typeof setInterval> | null = null
  private isAmbiencePlaying = false
  private ambienceGeneration = 0
  private contextGeneration = 0
  private readonly randomSource: RandomSource
  constructor(random?: RandomSource) {
    this.randomSource = random ?? defaultRandomSource
  }
  getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (AudioContextClass) this.audioCtx = new AudioContextClass()
    }
    return this.audioCtx
  }
  private async ready(): Promise<AudioContext> {
    const generation = this.contextGeneration
    const context = this.getContext()
    if (!context) throw new Error('当前环境不支持 Web Audio。')
    if (context.state === 'suspended') await context.resume()
    if (generation !== this.contextGeneration || context !== this.audioCtx)
      throw new Error('音频请求已结束。')
    if (context.state !== 'running') throw new Error('音频上下文尚未运行。')
    return context
  }
  private validateVolume(volume: number): void {
    if (!Number.isFinite(volume) || volume < 0 || volume > 1)
      throw new Error('音量必须在 0–1 之间。')
  }
  private random(): number {
    const value = this.randomSource.next()
    if (!Number.isFinite(value) || value < 0 || value >= 1)
      throw new Error('随机源必须返回 [0,1) 内的有限数。')
    return value
  }
  static getSwitchParams(type: MechanicalSwitchType): SynthParams {
    if (type === 'blue')
      return {
        transientFreq: 3200,
        resonanceFreq: 320,
        transientDecay: 0.012,
        resonanceDecay: 0.045,
        volume: 0.7,
      }
    if (type === 'brown')
      return {
        transientFreq: 1100,
        resonanceFreq: 240,
        transientDecay: 0.018,
        resonanceDecay: 0.035,
        volume: 0.55,
      }
    if (type === 'vintage')
      return {
        transientFreq: 2200,
        resonanceFreq: 180,
        transientDecay: 0.03,
        resonanceDecay: 0.08,
        volume: 0.8,
      }
    if (type === 'silent')
      return { transientFreq: 0, resonanceFreq: 0, transientDecay: 0, resonanceDecay: 0, volume: 0 }
    throw new Error('未知按键音效。')
  }
  private tone(
    context: AudioContext,
    frequency: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    destination?: AudioNode,
  ): void {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, context.currentTime)
    gain.gain.setValueAtTime(volume, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration)
    oscillator.connect(gain)
    gain.connect(destination ?? context.destination)
    if (destination) this.ambienceSources.add(oscillator)
    this.sources.add(oscillator)
    this.nodes.add(oscillator)
    this.nodes.add(gain)
    oscillator.onended = () => {
      oscillator.disconnect()
      gain.disconnect()
      this.sources.delete(oscillator)
      this.ambienceSources.delete(oscillator)
      this.nodes.delete(oscillator)
      this.nodes.delete(gain)
    }
    oscillator.start(context.currentTime)
    oscillator.stop(context.currentTime + duration)
  }
  async triggerKeyPress(type: MechanicalSwitchType, volume = 0.5): Promise<boolean> {
    this.validateVolume(volume)
    const parameters = AudioSynthesizerEngine.getSwitchParams(type)
    if (parameters.volume === 0 || volume === 0) return false
    const context = await this.ready()
    const jitter = 0.97 + this.random() * 0.06
    this.tone(
      context,
      parameters.transientFreq * jitter,
      parameters.transientDecay,
      parameters.volume * volume,
      'sine',
    )
    this.tone(
      context,
      parameters.resonanceFreq * jitter,
      parameters.resonanceDecay,
      parameters.volume * volume * 0.6,
      'triangle',
    )
    return true
  }
  async startAmbience(ambience: AmbienceType, volume = 0.3): Promise<boolean> {
    this.validateVolume(volume)
    if (!['none', 'rain', 'campfire', 'temple'].includes(ambience)) throw new Error('未知背景音。')
    this.stopAmbience()
    if (ambience === 'none' || volume === 0) return false
    const generation = this.ambienceGeneration
    const context = await this.ready()
    if (generation !== this.ambienceGeneration) return false
    if (ambience === 'temple') {
      const bus = context.createGain()
      bus.gain.setValueAtTime(volume * 0.5, context.currentTime)
      bus.connect(context.destination)
      this.ambienceGain = bus
      this.ambienceNodes = [bus]
      this.nodes.add(bus)
      const bell = () => {
        if (generation !== this.ambienceGeneration) return
        for (const [index, frequency] of [196, 293.66, 392, 587.33].entries())
          this.tone(context, frequency, 3 / (index + 1), 0.12 / (index + 1), 'sine', bus)
      }
      bell()
      this.ambienceTimer = setInterval(bell, 7000)
      this.isAmbiencePlaying = true
      return true
    }
    const size = Math.ceil(context.sampleRate * 2)
    const buffer = context.createBuffer(2, size, context.sampleRate)
    for (let channel = 0; channel < 2; channel++) {
      const output = buffer.getChannelData(channel)
      let b0 = 0,
        b1 = 0,
        b2 = 0,
        b3 = 0,
        b4 = 0,
        b5 = 0,
        b6 = 0
      for (let index = 0; index < size; index++) {
        const white = this.random() * 2 - 1
        b0 = 0.99886 * b0 + white * 0.0555179
        b1 = 0.99332 * b1 + white * 0.0750759
        b2 = 0.969 * b2 + white * 0.153852
        b3 = 0.8665 * b3 + white * 0.3104856
        b4 = 0.55 * b4 + white * 0.5329522
        b5 = -0.7616 * b5 - white * 0.016898
        let sample = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
        b6 = white * 0.115926
        if (ambience === 'campfire' && index % 2400 < 15 && this.random() > 0.85)
          sample += (this.random() * 2 - 1) * 0.85
        output[index] = Math.max(-1, Math.min(1, sample))
      }
    }
    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const gain = context.createGain()
    source.buffer = buffer
    source.loop = true
    filter.type = ambience === 'rain' ? 'lowpass' : 'bandpass'
    filter.frequency.value = ambience === 'rain' ? 1000 : 600
    gain.gain.setValueAtTime(volume * 0.5, context.currentTime)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(context.destination)
    this.sources.add(source)
    this.ambienceSources.add(source)
    this.ambienceGain = gain
    this.ambienceNodes = [source, filter, gain]
    for (const node of this.ambienceNodes) this.nodes.add(node)
    source.start()
    this.isAmbiencePlaying = true
    return true
  }
  stopAmbience(): void {
    this.ambienceGeneration++
    if (this.ambienceTimer !== null) clearInterval(this.ambienceTimer)
    this.ambienceTimer = null
    for (const source of this.ambienceSources) {
      try {
        source.stop()
      } catch {
        /* already ended */
      }
      this.sources.delete(source)
    }
    this.ambienceSources.clear()
    this.ambienceGain = null
    for (const node of this.ambienceNodes) {
      node.disconnect()
      this.nodes.delete(node)
    }
    this.ambienceNodes = []
    this.isAmbiencePlaying = false
  }
  close(): void {
    this.contextGeneration++
    this.stopAmbience()
    for (const source of this.sources) {
      try {
        source.stop()
      } catch {
        /* already ended */
      }
    }
    for (const node of this.nodes) node.disconnect()
    this.sources.clear()
    this.nodes.clear()
    const context = this.audioCtx
    this.audioCtx = null
    if (context && context.state !== 'closed') void context.close().catch(() => {})
  }
  setAmbienceVolume(volume: number): void {
    this.validateVolume(volume)
    if (this.ambienceGain && this.audioCtx)
      this.ambienceGain.gain.setValueAtTime(volume * 0.5, this.audioCtx.currentTime)
  }
  getIsAmbiencePlaying(): boolean {
    return this.isAmbiencePlaying
  }
}
