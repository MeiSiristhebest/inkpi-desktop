export type SynthesizerSoundType = 'mechanical' | 'typewriter'

export interface AudioSynthesizer {
  playClick(soundType?: SynthesizerSoundType): void
  playDing(): void
  setMuted(muted: boolean): void
  isMuted(): boolean
  setVolume(vol: number): void
  getVolume(): number
}
