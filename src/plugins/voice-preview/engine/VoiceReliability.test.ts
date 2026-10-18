import { describe, expect, it } from 'vitest'
import { VoicePreviewEngine } from './VoicePreviewEngine'
describe('source-bound dialogue preview', () => {
  it('retains all short, long and trailing-attributed dialogue with exact positions', () => {
    const text = 'A+B说：“好”。“不去”，甲答道。甲说：“' + '长对白😀'.repeat(40) + '”。'
    const script = VoicePreviewEngine.extractScript(text, ['A+B', '甲'])
    expect(script.totalLines).toBe(3)
    expect(script.lines.map((l) => l.speakerName)).toEqual(['A+B', '甲', '甲'])
    for (const line of script.lines)
      expect(text.slice(line.sourceStart, line.sourceEnd)).toBe(line.dialogueText)
  })
  it('does not infer emotion from a quoted keyword or pitch and villain role from age', () => {
    expect(VoicePreviewEngine.extractScript('甲说：“我没有杀人。”', ['甲']).lines[0].emotion).toBe(
      'unassigned',
    )
    const profile = VoicePreviewEngine.deriveDefaultProfile('甲', 'male', 'elder')
    expect(profile).toMatchObject({ pitch: 1, rate: 1, timbreFilter: 'standard' })
  })
})
