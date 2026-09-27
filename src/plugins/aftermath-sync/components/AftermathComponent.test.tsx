import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AftermathMasterView } from './AftermathMasterView'
import { AftermathDrawer } from './AftermathDrawer'
import { indexedDbAftermathRepository } from '../../../adapters/indexedDbAftermathRepository'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'
import type { CodexEntity } from '../../living-codex/types'

const makeEntity = (patch: Partial<CodexEntity> & { id: string; name: string }): CodexEntity => ({
  projectId: 'p1',
  aliases: [],
  category: 'character',
  attributes: {},
  relations: [],
  summary: '',
  createdAt: 100,
  updatedAt: 100,
  ...patch,
})

const clearWorkspace = async () => {
  const entities = await indexedDbCodexEntityRepository.getAll()
  await Promise.all(entities.map((e) => indexedDbCodexEntityRepository.delete(e.id)))
  const patches = await indexedDbAftermathRepository.getAll('p1')
  await Promise.all(patches.map((p) => indexedDbAftermathRepository.delete(p.id)))
}

describe('AftermathSync UI Components', () => {
  beforeEach(async () => {
    await clearWorkspace()
  })

  it('untouched workspace starts blank and reports no invented content (§P2.4)', async () => {
    const onStats = vi.fn()
    render(<AftermathMasterView projectId="p1" onStats={onStats} />)

    expect(screen.getByText(/章后桥段设定回写器/)).toBeInTheDocument()
    // 旧的示例正文会被算成作者已写字数（INV-09），现在文本框必须为空。
    expect(screen.getByPlaceholderText(/粘贴你写完的章节正文/)).toHaveValue('')
    expect(onStats).toHaveBeenCalledWith(expect.objectContaining({ wordCount: 0 }))
    expect(await screen.findByText('设定库暂无可对照实体')).toBeInTheDocument()
    // 旧界面靠硬造的名单出卡片，这类修真口径的字串现在一处都不许出现。
    expect(screen.queryByText('未指定角色')).not.toBeInTheDocument()
    expect(screen.queryByText('未命名物品')).not.toBeInTheDocument()
    expect(screen.queryByText('筑基大圆满')).not.toBeInTheDocument()
    expect(screen.queryByText('神秘角色')).not.toBeInTheDocument()
  })

  it('scanning without own text produces nothing', async () => {
    render(<AftermathMasterView projectId="p1" />)
    await screen.findByText(/设定库暂无可对照实体/)

    fireEvent.click(screen.getByText('扫描章节设定变迁'))

    expect(await screen.findByText(/未输入正文/)).toBeInTheDocument()
    expect(await indexedDbAftermathRepository.getAll('p1')).toHaveLength(0)
  })

  it('no codex entities in this workspace means no fabricated roster and no patches', async () => {
    // 别的书里的实体不能被当作本工作区的对照名单。
    await indexedDbCodexEntityRepository.save(
      makeEntity({ id: 'other-1', name: '林凡', projectId: 'other' }),
    )

    render(<AftermathMasterView projectId="p1" />)
    await screen.findByText('设定库暂无可对照实体')

    fireEvent.change(screen.getByPlaceholderText(/粘贴你写完的章节正文/), {
      target: { value: '林凡盘膝而坐，轰然一声巨响，林凡一举迈入筑基初期！' },
    })
    fireEvent.click(screen.getByText('扫描章节设定变迁'))

    expect(
      await screen.findByText(/设定库暂无可对照实体：先去设定库录入角色或物品/),
    ).toBeInTheDocument()
    expect(await indexedDbAftermathRepository.getAll('p1')).toHaveLength(0)
  })

  it('scans against the author own codex entities and keeps the real tier', async () => {
    await indexedDbCodexEntityRepository.save(
      makeEntity({ id: 'e-lin', name: '林凡', attributes: { realm: '练气九层' } }),
    )

    render(<AftermathMasterView projectId="p1" />)
    await screen.findByText(/对照名单：本书设定库中的 1 个角色\/物品/)

    fireEvent.change(screen.getByPlaceholderText(/粘贴你写完的章节正文/), {
      target: { value: '林凡盘膝而坐，轰然一声巨响，林凡一举迈入筑基初期！' },
    })
    fireEvent.click(screen.getByText('扫描章节设定变迁'))

    expect(await screen.findByText('林凡')).toBeInTheDocument()
    // beforeValue 必须来自作者自己写的设定，而不是硬造的「筑基大圆满」。
    expect(screen.getByText('练气九层')).toBeInTheDocument()
    expect(screen.getByText('筑基初期')).toBeInTheDocument()

    const saved = await indexedDbAftermathRepository.getAll('p1')
    expect(saved).toHaveLength(1)
    expect(saved[0].chapterId).toBe('ch-manual')
    // 本面板没有选定章节，就不该冒认「第 1 章」。
    expect(saved[0].chapterOrder).toBeUndefined()
  })

  // 批准的回写必须落在设定库读取的键上，否则同一条变更会被反复提案。
  it('applying a realm patch writes attributes.realm so the rescan has nothing left', async () => {
    await indexedDbCodexEntityRepository.save(
      makeEntity({ id: 'e-lin', name: '林凡', attributes: { realm: '练气九层' } }),
    )

    render(<AftermathMasterView projectId="p1" />)
    await screen.findByText(/对照名单/)
    fireEvent.change(screen.getByPlaceholderText(/粘贴你写完的章节正文/), {
      target: { value: '林凡盘膝而坐，轰然一声巨响，林凡一举迈入筑基初期！' },
    })
    fireEvent.click(screen.getByText('扫描章节设定变迁'))

    fireEvent.click(await screen.findByLabelText('采纳回写'))

    await waitFor(async () => {
      const entities = await indexedDbCodexEntityRepository.getAll()
      expect(entities.find((e) => e.id === 'e-lin')?.attributes?.realm).toBe('筑基初期')
    })
    const entities = await indexedDbCodexEntityRepository.getAll()
    const lin = entities.find((e) => e.id === 'e-lin')
    expect(lin?.attributes?.['战力境界']).toBeUndefined()

    fireEvent.click(screen.getByText('扫描章节设定变迁'))
    expect(
      await screen.findByText(/扫描完成：正文里没有命中可对照实体的状态变迁/),
    ).toBeInTheDocument()
    expect(await indexedDbAftermathRepository.getAll('p1')).toHaveLength(1)
  })

  it('scanning real text that hits nothing says so instead of staying silent', async () => {
    await indexedDbCodexEntityRepository.save(
      makeEntity({ id: 'e-lin', name: '林凡', attributes: { realm: '练气九层' } }),
    )

    render(<AftermathMasterView projectId="p1" />)
    await screen.findByText(/对照名单/)

    fireEvent.change(screen.getByPlaceholderText(/粘贴你写完的章节正文/), {
      target: { value: '林凡在灯下把旧信又读了一遍。' },
    })
    fireEvent.click(screen.getByText('扫描章节设定变迁'))

    expect(
      await screen.findByText(/扫描完成：正文里没有命中可对照实体的状态变迁/),
    ).toBeInTheDocument()
    expect(screen.getByText('暂无待审阅的设定回写补丁')).toBeInTheDocument()
  })

  it('AftermathDrawer renders correctly', () => {
    render(<AftermathDrawer projectId="p1" currentText="林凡突破到了金丹初期。" />)
    expect(screen.getByText(/设定回写提案/)).toBeInTheDocument()
  })
})
