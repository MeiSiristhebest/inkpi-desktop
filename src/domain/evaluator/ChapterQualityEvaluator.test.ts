import { describe, it, expect, vi } from 'vitest'
import { ChapterQualityEvaluator } from './ChapterQualityEvaluator'
import { pluginEventBus } from '../../core/pluginEventBus'
describe('Chapter review aggregation', () => {
  it('broadcasts measured observations without quality or payment scores', () => {
    const listener = vi.fn()
    const unsubscribe = pluginEventBus.on('UNIFIED_CHAPTER_EVALUATED', listener)
    const report = ChapterQualityEvaluator.evaluateChapter({
      projectId: 'p',
      chapterId: 'c',
      chapterTitle: '',
      chapterOrder: 1,
      content: '😀谁？',
    })
    expect(report).toMatchObject({ qualityStatus: 'not_assessed', ending: { characters: 3 } })
    expect(report).not.toHaveProperty('compositeScore')
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaVersion: 2,
        qualityStatus: 'not_assessed',
        characterCount: 3,
      }),
    )
    expect(listener.mock.calls[0][0]).not.toHaveProperty('compositeScore')
    unsubscribe()
  })
})
