import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, vi } from 'vitest'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { WaterMeterMasterView } from './WaterMeterMasterView'

afterEach(() => vi.restoreAllMocks())

describe('WaterMeterMasterView', () => {
  it('renders heading, stat cards and caught water words', () => {
    render(<WaterMeterMasterView projectId="p1" />)
    expect(screen.getByText('文本统计与词项复核')).toBeDefined()
    expect(screen.getByText(/字符频率熵/)).toBeDefined()
    expect(screen.getByText(/动作词表字符占比/)).toBeDefined()
    expect(screen.getByText(/可定位的词项/)).toBeDefined()
    expect(screen.queryByText(/水分综合评分|精炼高能/)).not.toBeInTheDocument()
  })

  it('concatenates chapters in project reading order across volumes', async () => {
    vi.spyOn(indexedDbProjectRepository, 'getChaptersByProject').mockResolvedValue([
      {
        id: 'chapter-one',
        projectId: 'p1',
        volumeId: 'volume-one',
        title: '第一卷正文',
        content: '第一卷正文',
        order: 1,
      },
      {
        id: 'chapter-two',
        projectId: 'p1',
        volumeId: 'volume-two',
        title: '第二卷正文',
        content: '第二卷正文',
        order: 0,
      },
    ] as any)
    vi.spyOn(indexedDbProjectRepository, 'getVolumesByProject').mockResolvedValue([
      { id: 'volume-one', projectId: 'p1', title: '第一卷', order: 0 },
      { id: 'volume-two', projectId: 'p1', title: '第二卷', order: 1 },
    ] as any)

    render(<WaterMeterMasterView projectId="p1" />)
    await userEvent.click(await screen.findByRole('combobox', { name: '筛选章节' }))
    await userEvent.click(await screen.findByRole('option', { name: '全书章节采样' }))

    expect(screen.getByRole('textbox')).toHaveValue('第一卷正文\n\n第二卷正文')
  })

  it('recalculates actual input and previews removal of only one selected occurrence', () => {
    render(<WaterMeterMasterView projectId="p1" />)
    const editor = screen.getByRole('textbox')
    fireEvent.change(editor, { target: { value: '他忍不住笑了，她忍不住哭了。' } })
    const auditBtn = screen.getByText('重新计算文本统计')
    fireEvent.click(auditBtn)

    const removals = screen.getAllByRole('button', { name: '移除该处词项（预览）' })
    expect(removals).toHaveLength(2)
    fireEvent.click(removals[0])
    expect(editor).toHaveValue('他笑了，她忍不住哭了。')
    expect(screen.getAllByRole('button', { name: '移除该处词项（预览）' })).toHaveLength(1)
  })
})
