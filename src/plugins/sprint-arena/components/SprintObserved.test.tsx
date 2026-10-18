import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SprintArenaDrawer } from './SprintArenaDrawer'
import { clock } from '../../../adapters/clock'
import { indexedDbSprintRepository } from '../../../adapters/indexedDbSprintRepository'
import { DesktopPluginHostProvider } from '../../../core/pluginHostContext'

afterEach(() => vi.restoreAllMocks())
describe('sprint observed source and persistence', () => {
  it('uses real time and signed Unicode net changes, retaining the same record for retry', async () => {
    let now = 1000
    vi.spyOn(clock, 'now').mockImplementation(() => now)
    const save = vi
      .spyOn(indexedDbSprintRepository, 'save')
      .mockRejectedValueOnce(new Error('disk failure'))
      .mockResolvedValue(undefined)
    const { rerender } = render(<SprintArenaDrawer projectId="p" currentText="😀甲" />)
    fireEvent.click(screen.getByText('开启极速冲刺'))
    now += 10000
    rerender(<SprintArenaDrawer projectId="p" currentText="😀" />)
    expect(screen.getByText('冲刺净增字数：-1')).toBeInTheDocument()
    fireEvent.click(screen.getByText('结算'))
    expect(await screen.findByRole('alert')).toHaveTextContent('disk failure')
    expect(save.mock.calls[0][0]).toMatchObject({
      wordsWritten: -1,
      durationSeconds: 10,
      startCharacters: 2,
      endCharacters: 1,
      metricVersion: 2,
    })
    fireEvent.click(screen.getByText('重试保存'))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    expect(save.mock.calls[1][0]).toEqual(save.mock.calls[0][0])
    expect(await screen.findByText('冲刺记录已保存。')).toBeInTheDocument()
  })
  it('does not continue a session in another chapter', () => {
    const chapter = {
      id: 'c1',
      projectId: 'p',
      volumeId: 'v',
      order: 0,
      title: '章一',
      content: '',
      wordCount: 0,
      createdAt: 1,
      updatedAt: 1,
    }
    const view = (id: string) => (
      <DesktopPluginHostProvider projectId="p" activeChapter={{ ...chapter, id }}>
        <SprintArenaDrawer projectId="p" currentText="甲" />
      </DesktopPluginHostProvider>
    )
    const { rerender } = render(view('c1'))
    fireEvent.click(screen.getByText('开启极速冲刺'))
    rerender(view('c2'))
    expect(screen.getByText('开启极速冲刺')).toBeInTheDocument()
    expect(screen.queryByText(/冲刺中/)).not.toBeInTheDocument()
  })
})
