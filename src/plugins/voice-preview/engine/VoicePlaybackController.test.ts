import { afterEach, describe, expect, it, vi } from 'vitest'
import { VoicePlaybackController } from './VoicePlaybackController'

const players: VoicePlaybackController[] = []
afterEach(() => {
  players.splice(0).forEach((p) => p.stop())
  vi.unstubAllGlobals()
})
function fixture() {
  const spoken: SpeechSynthesisUtterance[] = []
  const synth = {
    speaking: false,
    pending: false,
    getVoices: () => [],
    cancel: vi.fn(),
    speak: vi.fn((utterance: SpeechSynthesisUtterance) => spoken.push(utterance)),
  }
  vi.stubGlobal('speechSynthesis', synth)
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      text: string
      constructor(text: string) {
        this.text = text
      }
    },
  )
  const player = new VoicePlaybackController()
  players.push(player)
  return { spoken, synth, player }
}
const callbacks = () => ({ onLine: vi.fn(), onComplete: vi.fn(), onError: vi.fn() })
describe('owned browser speech playback', () => {
  it('ignores delayed completion after stop and never resumes the old source', () => {
    const { player, spoken, synth } = fixture()
    const callback = callbacks()
    player.start(
      [
        { lineIndex: 1, text: '甲', pitch: 1, rate: 1 },
        { lineIndex: 2, text: '乙', pitch: 1, rate: 1 },
      ],
      callback,
    )
    const oldEnd = spoken[0].onend!
    player.stop()
    oldEnd.call(spoken[0], {} as SpeechSynthesisEvent)
    expect(synth.speak).toHaveBeenCalledTimes(1)
    expect(callback.onComplete).not.toHaveBeenCalled()
  })
  it('preserves all Unicode dialogue across playback segments and reports errors', () => {
    const { player, spoken } = fixture()
    const callback = callbacks()
    const text = '对白😀'.repeat(100)
    player.start([{ lineIndex: 1, text, pitch: 1, rate: 1 }], callback)
    for (let index = 0; index < spoken.length; index++)
      spoken[index].onend!.call(spoken[index], {} as SpeechSynthesisEvent)
    expect(spoken.map((s) => s.text).join('')).toBe(text)
    expect(callback.onComplete).toHaveBeenCalledOnce()
    player.start([{ lineIndex: 2, text: '新', pitch: 1, rate: 1 }], callback)
    spoken
      .at(-1)!
      .onerror!.call(spoken.at(-1)!, { error: 'synthesis-failed' } as SpeechSynthesisErrorEvent)
    expect(callback.onError).toHaveBeenCalledWith(expect.stringContaining('synthesis-failed'))
  })
  it('does not cancel another speaker or silently use a missing saved voice', () => {
    const { player, synth } = fixture()
    synth.speaking = true
    expect(() =>
      player.start([{ lineIndex: 1, text: '甲', pitch: 1, rate: 1 }], callbacks()),
    ).toThrow('其他语音')
    expect(synth.cancel).not.toHaveBeenCalled()
    synth.speaking = false
    expect(() =>
      player.start(
        [{ lineIndex: 1, text: '甲', pitch: 1, rate: 1, voiceURI: 'missing' }],
        callbacks(),
      ),
    ).toThrow('声线当前不可用')
  })
})
