import { VoicePreviewEngine } from './VoicePreviewEngine'
export interface VoicePlaybackLine {
  lineIndex: number
  text: string
  pitch: number
  rate: number
  voiceURI?: string
  language?: string
}
interface PlaybackCallbacks {
  onLine: (line: number) => void
  onComplete: () => void
  onError: (message: string) => void
}
let owner: VoicePlaybackController | null = null
export class VoicePlaybackController {
  private generation = 0
  private synthesis: SpeechSynthesis | null = null
  isAvailable(): boolean {
    return (
      typeof window !== 'undefined' &&
      !!window.speechSynthesis &&
      typeof SpeechSynthesisUtterance !== 'undefined'
    )
  }
  start(lines: VoicePlaybackLine[], callbacks: PlaybackCallbacks): void {
    if (!this.isAvailable()) throw new Error('当前环境未提供浏览器语音合成。')
    if (!lines.length) throw new Error('没有可播放的对白。')
    for (const line of lines) VoicePreviewEngine.validateProfile(line)
    const synth = window.speechSynthesis
    if ((owner && owner !== this) || (!owner && (synth.speaking || synth.pending)))
      throw new Error('已有其他语音任务，请先结束它。')
    if (owner === this) this.stop()
    const voices = typeof synth.getVoices === 'function' ? synth.getVoices() : []
    for (const line of lines)
      if (line.voiceURI && !voices.some((v) => v.voiceURI === line.voiceURI))
        throw new Error('已选择的声线当前不可用，请重新选择。')
    const segments = lines.flatMap((line) => {
      const characters = Array.from(line.text)
      const result: VoicePlaybackLine[] = []
      for (let index = 0; index < characters.length; index += 200)
        result.push({ ...line, text: characters.slice(index, index + 200).join('') })
      return result
    })
    owner = this
    this.synthesis = synth
    const generation = ++this.generation
    let index = 0
    const fail = (message: string) => {
      if (generation !== this.generation || owner !== this) return
      this.stop()
      callbacks.onError(message)
    }
    const next = () => {
      if (generation !== this.generation || owner !== this) return
      if (index >= segments.length) {
        owner = null
        this.synthesis = null
        callbacks.onComplete()
        return
      }
      const line = segments[index]
      const utterance = new SpeechSynthesisUtterance(line.text)
      utterance.pitch = line.pitch
      utterance.rate = line.rate
      utterance.voice = voices.find((v) => v.voiceURI === line.voiceURI) ?? null
      utterance.lang = line.language || utterance.voice?.lang || 'zh-CN'
      utterance.onend = () => {
        if (generation !== this.generation || owner !== this) return
        index++
        next()
      }
      utterance.onerror = (event) => fail('语音播放失败：' + event.error)
      callbacks.onLine(line.lineIndex)
      try {
        synth.speak(utterance)
      } catch (cause) {
        fail('语音播放失败：' + String(cause))
      }
    }
    next()
  }
  stop(): void {
    this.generation++
    if (owner === this) {
      owner = null
      const synth = this.synthesis
      this.synthesis = null
      synth?.cancel()
    }
  }
}
