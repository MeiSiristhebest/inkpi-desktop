import type { AudioSynthesizer, SynthesizerSoundType } from '../ports/audioSynthesizer'

class WebAudioSynthesizerImpl implements AudioSynthesizer {
  private ctx: AudioContext | null = null
  private muted = true // 默认静音，需用户开启
  private volume = 0.5

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  public setMuted(muted: boolean): void {
    this.muted = muted
  }

  public isMuted(): boolean {
    return this.muted
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol))
  }

  public getVolume(): number {
    return this.volume
  }

  public playClick(soundType: SynthesizerSoundType = 'mechanical'): void {
    if (this.muted) return
    const ctx = this.getContext()
    if (!ctx) return

    try {
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      if (soundType === 'mechanical') {
        // 青轴质感：高频脉冲 + 低频击底
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(2400, now)
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.03)

        gain.gain.setValueAtTime(this.volume * 0.4, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035)

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start(now)
        osc.stop(now + 0.04)
      } else {
        // 打字机质感：钝重撞针
        osc.type = 'square'
        osc.frequency.setValueAtTime(800, now)
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.05)

        gain.gain.setValueAtTime(this.volume * 0.35, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055)

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start(now)
        osc.stop(now + 0.06)
      }
    } catch {
      // 忽略音频调度异常
    }
  }

  public playDing(): void {
    if (this.muted) return
    const ctx = this.getContext()
    if (!ctx) return

    try {
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(1320, now) // E6 清脆铜铃
      osc.frequency.exponentialRampToValueAtTime(1310, now + 0.4)

      gain.gain.setValueAtTime(this.volume * 0.5, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.55)
    } catch {
      // 忽略音频调度异常
    }
  }
}

export const webAudioSynthesizer: AudioSynthesizer = new WebAudioSynthesizerImpl()
