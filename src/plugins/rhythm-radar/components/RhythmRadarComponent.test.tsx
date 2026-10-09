import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RhythmRadarMasterView } from './RhythmRadarMasterView'
import { RhythmRadarDrawer } from './RhythmRadarDrawer'
import { RhythmRadarEngine } from '../engine/RhythmRadarEngine'

describe('RhythmRadar UI Components', () => {
  it('RhythmRadarMasterView renders correctly', () => {
    render(<RhythmRadarMasterView projectId="p1" />)
    expect(screen.getByText(/剧情节奏与断章雷达/)).toBeDefined()
  })

  it('starts blank and only reports analysis after the author provides text', async () => {
    const analyze = vi.spyOn(RhythmRadarEngine, 'analyzeChapter')
    const onStats = vi.fn()
    render(<RhythmRadarMasterView projectId="p1" onStats={onStats} />)

    const editor = screen.getByPlaceholderText('粘贴章节正文后查看规则分析')
    expect(editor).toHaveValue('')
    expect(analyze).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /归档当前断章雷达评测/ })).toBeDisabled()
    await waitFor(() =>
      expect(onStats).toHaveBeenCalledWith(expect.objectContaining({ wordCount: 0 })),
    )

    fireEvent.change(editor, { target: { value: '章节正文，主角在危机中作出选择。' } })
    expect(analyze).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: /归档当前断章雷达评测/ })).toBeEnabled()
  })

  it('RhythmRadarDrawer renders correctly', () => {
    render(<RhythmRadarDrawer projectId="p1" currentText="林凡拔剑怒斩！" />)
    expect(screen.getByText(/断章张力雷达/)).toBeDefined()
  })
})
