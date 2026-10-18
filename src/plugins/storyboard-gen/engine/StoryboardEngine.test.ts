import { describe, expect, it } from 'vitest'
import { StoryboardEngine } from './StoryboardEngine'

describe('StoryboardEngine', () => {
  it('selects only source passages and preserves the actual beginning and ending', () => {
    const text = '门开了。\r\n她停下。\r\n远处传来脚步声。\r\n她关灯。\r\n有人敲门。'
    const result = StoryboardEngine.extractStoryboard('chapter-1', '夜班', text)

    expect(result.frames).toHaveLength(4)
    expect(result.frames[0].sourceQuote).toBe('门开了。')
    expect(result.frames.at(-1)?.sourceQuote).toBe('有人敲门。')
    for (const frame of result.frames)
      expect(text.slice(frame.sourceStart, frame.sourceEnd)).toBe(frame.sourceQuote)
    expect(result.suggestedCharacters).toEqual([])
    expect(result.coverage).toEqual({ totalPassages: 5, suppliedPassages: 4, complete: false })
  })

  it('creates a record with the actual source frame and supplied author appearance', () => {
    const text = '林岚把门闩落下。'
    const extracted = StoryboardEngine.extractStoryboard('ch_02', '第二章', text, {
      characters: [{ id: 'character-1', name: '林岚', visualFeatures: '短发，深色外套' }],
      artStyle: '黑白木刻',
      sceneGoal: '确认门外来者身份',
    })
    const record = StoryboardEngine.createSceneRecord('sb_02', 'p1', 'ch_02', extracted, 123456)

    expect(record.id).toBe('sb_02')
    expect(record.projectId).toBe('p1')
    expect(record.chapterId).toBe('ch_02')
    expect(record.shotFrames).toHaveLength(1)
    expect(record.shotFrames[0].sourceQuote).toBe(text)
    expect(record.characterCards).toEqual([
      expect.objectContaining({ characterName: '林岚', visualFeatures: '短发，深色外套' }),
    ])
    expect(record.shotFrames[0].visualPrompt).toContain('黑白木刻')
  })
})
