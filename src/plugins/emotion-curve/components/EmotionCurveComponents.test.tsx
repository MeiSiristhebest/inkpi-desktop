import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EmotionCurveMasterView } from './EmotionCurveMasterView'
import { EmotionCurveDrawer } from './EmotionCurveDrawer'
import { indexedDbEmotionAuditRepository as repo } from '../../../adapters/indexedDbEmotionAuditRepository'
vi.mock('../../../adapters/indexedDbProjectRepository', () => ({
  indexedDbProjectRepository: {
    getChaptersByProject: vi.fn().mockResolvedValue([
      {
        id: 'c',
        projectId: 'p',
        volumeId: 'v',
        title: '保存章',
        order: 0,
        content: '作者喜悦。',
        revision: 2,
      },
    ]),
    getVolumesByProject: vi.fn().mockResolvedValue([{ id: 'v', projectId: 'p', order: 0 }]),
  },
}))
vi.mock('../../../adapters/indexedDbEmotionAuditRepository', () => ({
  indexedDbEmotionAuditRepository: {
    getAll: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
  },
}))
describe('EmotionCurve views', () => {
  it('saves only explicit author values and binds evidence to the actual chapter', async () => {
    render(<EmotionCurveMasterView projectId="p" />)
    await screen.findByText('作者喜悦。')
    fireEvent.change(screen.getByLabelText('作者喜悦标注'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('作者标注说明'), {
      target: { value: '作者安排的情绪转折' },
    })
    fireEvent.change(screen.getByLabelText('标注原文引用'), { target: { value: '喜悦' } })
    fireEvent.click(screen.getByRole('button', { name: '保存作者情绪标注' }))
    await waitFor(() =>
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'p',
          chapterId: 'c',
          chapterOrder: 1,
          sourceText: '作者喜悦。',
          sourceRevision: 2,
          annotation: {
            values: { joy: 0 },
            note: '作者安排的情绪转折',
            quote: '喜悦',
            start: 2,
            end: 4,
          },
        }),
      ),
    )
    const record = vi.mocked(repo.save).mock.calls.at(-1)![0]
    expect(record).not.toHaveProperty('resonanceScore')
  })
  it('shows no false reader-emotion verdict in the drawer', () => {
    const { rerender } = render(<EmotionCurveDrawer projectId="p" currentText="没有喜悦。" />)
    expect(screen.getByText(/「喜悦」/)).toBeInTheDocument()
    expect(screen.queryByText(/共鸣深度/)).not.toBeInTheDocument()
    rerender(<EmotionCurveDrawer projectId="p" currentText="天气晴朗。" />)
    expect(screen.queryByText(/「喜悦」/)).not.toBeInTheDocument()
  })
})
