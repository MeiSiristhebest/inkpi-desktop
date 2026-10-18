import { MemoryPalaceEngine } from '../engine/MemoryPalaceEngine'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryPalaceMasterView } from './MemoryPalaceMasterView'
import { MemoryPalaceDrawer } from './MemoryPalaceDrawer'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { DesktopPluginHostProvider } from '../../../core/pluginHostContext'
import { chapterSaveEvents } from '../../../ports/chapterSaveEvents'

vi.mock('../../../adapters/indexedDbCodexEntityRepository', () => ({
  indexedDbCodexEntityRepository: {
    getAll: vi.fn(),
  },
}))

vi.mock('../../../adapters/indexedDbProjectRepository', () => ({
  indexedDbProjectRepository: {
    getChaptersByProject: vi.fn(),
    getVolumesByProject: vi.fn(async () => []),
  },
}))

describe('MemoryPalace Components', () => {
  const fakeEntities = [
    {
      id: 'e-1',
      projectId: 'proj-1',
      name: '镇魔钟',
      category: 'item',
      aliases: ['古钟'],
      summary: '敲响可镇压万魔',
      createdAt: 1,
      updatedAt: 1,
    },
  ]

  const fakeChapters = [
    {
      id: 'ch-1',
      projectId: 'proj-1',
      title: '古刹听钟',
      order: 1,
      content: '<p>陆沉手握古钟，感受到了镇魔钟的磅礴灵力。</p>',
    },
  ]

  it('renders MemoryPalaceMasterView and searches entities', async () => {
    vi.mocked(indexedDbCodexEntityRepository.getAll).mockResolvedValue(fakeEntities as any)
    vi.mocked(indexedDbProjectRepository.getChaptersByProject).mockResolvedValue(
      fakeChapters as any,
    )

    render(<MemoryPalaceMasterView projectId="proj-1" />)
    expect(screen.getByText(/记忆宫殿与历史实体快速召回仪/)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getAllByText('镇魔钟').length).toBeGreaterThan(0)
    })
    expect(screen.getByTestId('memory-palace-runtime-search-status')).toHaveTextContent(
      'Runtime 未连接',
    )
  })

  it('suppresses stale Runtime search results after the query changes', async () => {
    let resolveFirst: ((value: unknown) => void) | undefined
    let resolveSecond: ((value: unknown) => void) | undefined
    const onPluginTool = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve
          }),
      )
    vi.mocked(indexedDbCodexEntityRepository.getAll).mockResolvedValue(fakeEntities as any)
    vi.mocked(indexedDbProjectRepository.getChaptersByProject).mockResolvedValue(
      fakeChapters as any,
    )

    render(
      <DesktopPluginHostProvider
        projectId="proj-1"
        activeChapter={null}
        onPluginTool={onPluginTool}
        isAiConnected
      >
        <MemoryPalaceMasterView projectId="proj-1" />
      </DesktopPluginHostProvider>,
    )

    await waitFor(() => expect(onPluginTool).toHaveBeenCalledTimes(1))
    fireEvent.change(screen.getByPlaceholderText(/快速搜索人物名/), { target: { value: '新查询' } })
    await waitFor(() => expect(onPluginTool).toHaveBeenCalledTimes(2))

    resolveFirst?.([
      { entityId: 'old', entityName: '旧查询结果', totalOccurrences: 1, recentSnippets: [] },
    ])
    resolveSecond?.([])

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Runtime 检索完成，未找到相关实体。'),
    )
    expect(screen.queryByText('镇魔钟')).not.toBeInTheDocument()
    expect(screen.queryByText('旧查询结果')).not.toBeInTheDocument()
  })

  it('refreshes Runtime indexing when a chapter is saved', async () => {
    const onPluginTool = vi.fn(async () => null)
    vi.mocked(indexedDbCodexEntityRepository.getAll).mockResolvedValue(fakeEntities as any)
    vi.mocked(indexedDbProjectRepository.getChaptersByProject).mockResolvedValue(
      fakeChapters as any,
    )

    render(
      <DesktopPluginHostProvider
        projectId="proj-1"
        activeChapter={null}
        onPluginTool={onPluginTool}
        isAiConnected
      >
        <MemoryPalaceMasterView projectId="proj-1" />
      </DesktopPluginHostProvider>,
    )

    await waitFor(() => expect(onPluginTool).toHaveBeenCalledTimes(1))
    chapterSaveEvents.publish({
      ...fakeChapters[0],
      content: '<p>保存后的正文包含新的线索。</p>',
    } as any)

    await waitFor(() => expect(onPluginTool).toHaveBeenCalledTimes(2))
    expect(onPluginTool).toHaveBeenLastCalledWith(
      'memory-palace',
      expect.objectContaining({
        chapters: [expect.objectContaining({ content: '保存后的正文包含新的线索。' })],
      }),
    )
  })

  it('renders MemoryPalaceDrawer with detected entities', async () => {
    vi.mocked(indexedDbCodexEntityRepository.getAll).mockResolvedValue(fakeEntities as any)
    render(<MemoryPalaceDrawer projectId="proj-1" currentText="古刹之中，镇魔钟鸣响不绝。" />)
    await waitFor(() => {
      expect(screen.getByText(/本章登场实体速查/)).toBeInTheDocument()
      expect(screen.getByText('镇魔钟', { selector: 'strong' })).toBeInTheDocument()
    })
  })

  it('projects stored chapter HTML before the Runtime search tool boundary', async () => {
    const onPluginTool = vi.fn(async () => null)
    vi.mocked(indexedDbCodexEntityRepository.getAll).mockResolvedValue(fakeEntities as any)
    vi.mocked(indexedDbProjectRepository.getChaptersByProject).mockResolvedValue(
      fakeChapters as any,
    )

    render(
      <DesktopPluginHostProvider
        projectId="proj-1"
        activeChapter={null}
        onPluginTool={onPluginTool}
        isAiConnected
      >
        <MemoryPalaceMasterView projectId="proj-1" />
      </DesktopPluginHostProvider>,
    )

    await waitFor(() => {
      expect(onPluginTool).toHaveBeenCalledWith(
        'memory-palace',
        expect.objectContaining({
          chapters: [
            expect.objectContaining({
              content: '陆沉手握古钟，感受到了镇魔钟的磅礴灵力。',
            }),
          ],
        }),
      )
    })
  })

  it('projects saved entity and volume prose before Runtime search without changing IDs or records', async () => {
    const entity = {
      ...fakeEntities[0],
      id: 'entity-<b>stable</b>',
      name: '<p>镇魔钟</p>',
      aliases: ['<strong>古钟</strong>'],
      summary: '<p>敲响可镇压万魔</p>',
      detailMarkdown: '<blockquote><p>作者确认其只认主人。</p></blockquote>',
      relations: [
        {
          targetId: 'entity-<b>linked</b>',
          targetName: '<p>陆沉</p>',
          relationType: '<strong>持有</strong>',
          description: '<p>他从不离身。</p>',
        },
      ],
    }
    const volume = {
      id: 'volume-1',
      projectId: 'proj-1',
      title: '<p>第一卷</p>',
      order: 1,
      description: '<p>镇魔钟首次出场。</p>',
      createdAt: 1,
      updatedAt: 1,
    }
    const onPluginTool = vi.fn(async (_pluginId: string, input: any) =>
      MemoryPalaceEngine.searchEntityOccurrences({ ...input, projectId: input.workspaceId }),
    )
    vi.mocked(indexedDbCodexEntityRepository.getAll).mockResolvedValue([entity] as any)
    vi.mocked(indexedDbProjectRepository.getChaptersByProject).mockResolvedValue(
      fakeChapters as any,
    )
    vi.mocked(indexedDbProjectRepository.getVolumesByProject).mockResolvedValue([volume] as any)

    render(
      <DesktopPluginHostProvider
        projectId="proj-1"
        activeChapter={null}
        onPluginTool={onPluginTool}
        isAiConnected
      >
        <MemoryPalaceMasterView projectId="proj-1" />
      </DesktopPluginHostProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('memory-palace-runtime-search-status')).toHaveTextContent(
        'Runtime 检索完成。',
      )
    })
    const payload = onPluginTool.mock.calls.at(-1)?.[1] as {
      entities: Array<Record<string, any>>
      volumes: Array<Record<string, any>>
    }
    expect(payload.entities[0]).toMatchObject({
      id: 'entity-<b>stable</b>',
      name: '镇魔钟',
      aliases: ['古钟'],
      summary: '敲响可镇压万魔',
      detailMarkdown: '作者确认其只认主人。',
      relations: [
        {
          targetId: 'entity-<b>linked</b>',
          targetName: '陆沉',
          relationType: '持有',
          description: '他从不离身。',
        },
      ],
    })
    expect(payload.volumes[0]).toMatchObject({
      id: 'volume-1',
      title: '第一卷',
      description: '镇魔钟首次出场。',
    })
    expect(JSON.stringify(payload)).not.toMatch(/<\/?(?:p|strong|blockquote)>/)
    expect(entity.name).toBe('<p>镇魔钟</p>')
    expect(volume.title).toBe('<p>第一卷</p>')
  })

  it('reports Runtime failure, rejects incomplete results, and retries a complete source-bound response', async () => {
    const onPluginTool = vi
      .fn()
      .mockRejectedValueOnce(new Error('daemon unavailable'))
      .mockResolvedValueOnce([])
      .mockImplementationOnce(async (_id, input) =>
        MemoryPalaceEngine.searchEntityOccurrences({ ...input, projectId: input.workspaceId }),
      )
    vi.mocked(indexedDbCodexEntityRepository.getAll).mockResolvedValue(fakeEntities as any)
    vi.mocked(indexedDbProjectRepository.getChaptersByProject).mockResolvedValue(
      fakeChapters as any,
    )

    render(
      <DesktopPluginHostProvider
        projectId="proj-1"
        activeChapter={null}
        onPluginTool={onPluginTool}
        isAiConnected
      >
        <MemoryPalaceMasterView projectId="proj-1" />
      </DesktopPluginHostProvider>,
    )
    fireEvent.change(screen.getByPlaceholderText(/快速搜索人物名/), {
      target: { value: '镇魔钟' },
    })

    await waitFor(() => expect(onPluginTool).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole('alert')).toHaveTextContent('Runtime 检索失败')
    expect(screen.getByRole('alert')).toHaveTextContent('daemon unavailable')
    expect(screen.getAllByText('镇魔钟').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: '重试 Runtime 检索' }))

    await waitFor(() => expect(onPluginTool).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Runtime 检索失败'))
    expect(screen.getAllByText('镇魔钟').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: '重试 Runtime 检索' }))
    await waitFor(() => expect(onPluginTool).toHaveBeenCalledTimes(3))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Runtime 检索完成。'))
    expect(screen.getAllByText('镇魔钟').length).toBeGreaterThan(0)
  })
})
