import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { VoicePreviewMasterView } from './VoicePreviewMasterView'
import { VoicePreviewDrawer } from './VoicePreviewDrawer'

describe('VoicePreview UI Components', () => {
  it('VoicePreviewMasterView renders correctly', () => {
    render(<VoicePreviewMasterView projectId="p1" />)
    expect(screen.getByText(/角色拟真有声对白试听器/)).toBeDefined()
  })

  it('starts without sample chapter text or counted writing words', async () => {
    const onStats = vi.fn()
    render(<VoicePreviewMasterView projectId="p1" onStats={onStats} />)

    expect(screen.getByRole('textbox')).toHaveValue('')
    expect(screen.getByPlaceholderText('粘贴章节正文以提取对白台本')).toBeInTheDocument()
    expect(screen.getByText(/等待正文：粘贴包含角色对白/)).toBeInTheDocument()
    expect(screen.queryByText('【示例文本】')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(onStats).toHaveBeenLastCalledWith(expect.objectContaining({ wordCount: 0 }))
    })
  })

  it('VoicePreviewDrawer renders correctly', () => {
    render(<VoicePreviewDrawer projectId="p1" currentText="林凡冷笑道：“今日之辱，来日必报！”" />)
    expect(screen.getByText(/广播剧对白试听/)).toBeDefined()
  })
})
