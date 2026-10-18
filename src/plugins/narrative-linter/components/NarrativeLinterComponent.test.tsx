import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NarrativeLinterMasterView } from './NarrativeLinterMasterView'
import { NarrativeLinterDrawer } from './NarrativeLinterDrawer'
import { DesktopPluginHostProvider } from '../../../core/pluginHostContext'

const { getChaptersByProject, getVolumesByProject, getConfig, saveConfig } = vi.hoisted(() => ({
  getChaptersByProject: vi.fn(),
  getVolumesByProject: vi.fn(async () => [{ id: 'v1', projectId: 'p1', order: 0 }]),
  getConfig: vi.fn(async () => undefined),
  saveConfig: vi.fn(async () => {}),
}))

vi.mock('../../../adapters/indexedDbProjectRepository', () => ({
  indexedDbProjectRepository: { getChaptersByProject, getVolumesByProject },
}))
vi.mock('../../../adapters/indexedDbNarrativeLinterRepository', () => ({
  indexedDbNarrativeLinterRepository: { getConfig, saveConfig },
}))

describe('NarrativeLinter UI Components', () => {
  beforeEach(() => {
    getChaptersByProject.mockResolvedValue([
      {
        id: 'chapter-1',
        projectId: 'p1',
        volumeId: 'v1',
        title: '第一章',
        order: 1,
        content: '<p>第一章正文</p>',
        revision: 1,
      },
      {
        id: 'chapter-2',
        projectId: 'p1',
        volumeId: 'v1',
        title: '第二章',
        order: 2,
        content: '<h2>第二章</h2><p>第二章正文</p>',
        revision: 4,
      },
    ])
  })

  it('NarrativeLinterMasterView renders correctly', () => {
    render(<NarrativeLinterMasterView projectId="p1" />)
    expect(screen.getByText(/规则模型门禁/)).toBeDefined()
  })

  it('NarrativeLinterDrawer renders correctly with score', () => {
    render(<NarrativeLinterDrawer projectId="p1" currentText="林凡拔出了长剑。" />)
    expect(screen.getByText(/规则信号门禁巡检/)).toBeDefined()
  })

  it('projects selected chapter HTML into semantic text before rules and AI', async () => {
    const onAiTask = vi.fn(async () => null)
    render(
      <DesktopPluginHostProvider
        projectId="p1"
        activeChapter={null}
        onAiTask={onAiTask}
        isAiConnected
      >
        <NarrativeLinterMasterView projectId="p1" />
      </DesktopPluginHostProvider>,
    )

    const selector = await screen.findByRole('combobox')
    expect(screen.getByDisplayValue('第一章正文')).toBeInTheDocument()
    await userEvent.click(selector)
    await userEvent.click(await screen.findByRole('option', { name: '第 2 章 · 第二章' }))

    const textarea = screen.getByRole('textbox', { name: '待审章节正文' })
    await waitFor(() => expect(textarea).toHaveValue('第二章\n第二章正文'))
    screen.getByRole('button', { name: 'AI 叙事深度体检' }).click()

    expect(onAiTask).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          payload: expect.objectContaining({
            analysisInput: expect.objectContaining({
              schemaVersion: 'plugin-review-v2',
              input: expect.objectContaining({
                chapter: { id: 'chapter-2', chapterNumber: 2, revision: 4, title: '第二章' },
                text: '第二章\n第二章正文',
              }),
            }),
          }),
        }),
      }),
    )
  })
  it('preserves author thresholds across a failed save and retries the same configuration', async () => {
    saveConfig.mockRejectedValueOnce(new Error('disk'))
    render(<NarrativeLinterMasterView projectId="p1" />)
    await waitFor(() => expect(screen.getByRole('button', { name: '保存规则配置' })).toBeEnabled())
    const threshold = screen.getByRole('spinbutton', { name: '分句长度定位阈值' })
    await userEvent.clear(threshold)
    await userEvent.type(threshold, '12')
    await userEvent.click(screen.getByRole('button', { name: '保存规则配置' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('规则保存失败')
    expect(threshold).toHaveValue(12)
    await userEvent.click(screen.getByRole('button', { name: '保存规则配置' }))
    await waitFor(() =>
      expect(saveConfig).toHaveBeenLastCalledWith(
        expect.objectContaining({
          projectId: 'p1',
          rules: expect.arrayContaining([
            expect.objectContaining({ ruleId: 'LINT_RUN_ON_SENTENCE', customThreshold: 12 }),
          ]),
        }),
      ),
    )
  })
})
