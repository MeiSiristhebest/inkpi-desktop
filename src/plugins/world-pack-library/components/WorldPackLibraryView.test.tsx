import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  compareWorldPack,
  type WorldPackEntitySnapshot,
  type WorldPackSnapshot,
} from '../../../domain/worldPacks/worldPack'
import { worldPackService } from '../../../services/worldPackService'
import { WorldPackLibraryView } from './WorldPackLibraryView'

const pack: WorldPackSnapshot = {
  id: 'world-pack-ui-source-v1',
  schemaVersion: 1,
  sourceProjectId: 'source-work',
  sourceProjectName: 'Source work',
  version: 1,
  createdAt: 100,
  worldbase: { missingRule: 'pack rule', conflictingRule: 'pack value' },
  entities: [entity('source-new', 'New character')],
}

function entity(id: string, name: string): WorldPackEntitySnapshot {
  return {
    id,
    name,
    aliases: [],
    category: 'character',
    attributes: {},
    relations: [],
    summary: `${name} summary`,
    createdAt: 1,
    updatedAt: 1,
  }
}

const diff = compareWorldPack(pack, { conflictingRule: 'target value', targetOnlyRule: 'keep' }, [])

afterEach(() => vi.restoreAllMocks())

describe('WorldPackLibraryView', () => {
  it('shows the target diff and requires explicit confirmation before additive adoption', async () => {
    const listSnapshots = vi.spyOn(worldPackService, 'listSnapshots').mockResolvedValue([pack])
    const compare = vi.spyOn(worldPackService, 'compare').mockResolvedValue(diff)
    const adopt = vi.spyOn(worldPackService, 'adopt').mockResolvedValue({
      addedWorldbaseFields: 1,
      addedEntities: 1,
      unresolvedRelations: 0,
      preservedConflictingWorldbaseFields: 1,
      preservedConflictingEntities: 0,
      ambiguousEntities: 0,
    })

    render(<WorldPackLibraryView projectId="target-work" />)

    expect(await screen.findByText('Source work · v1')).toBeInTheDocument()
    expect(await screen.findByText('missingRule')).toBeInTheDocument()
    expect(screen.getByText('conflictingRule')).toBeInTheDocument()
    expect(screen.getByText('targetOnlyRule')).toBeInTheDocument()
    expect(compare).toHaveBeenCalledWith(pack.id, 'target-work')

    fireEvent.click(screen.getByRole('button', { name: '采用可安全新增的内容到当前作品' }))
    expect(adopt).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '明确采用可新增内容' }))

    await waitFor(() => expect(adopt).toHaveBeenCalledWith(pack.id, 'target-work'))
    expect(await screen.findByRole('status')).toHaveTextContent('采用完成')
    expect(listSnapshots).toHaveBeenCalledTimes(2)
  })

  it('creates a new immutable version and selects it for comparison', async () => {
    vi.spyOn(worldPackService, 'listSnapshots')
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([pack])
    const createSnapshot = vi.spyOn(worldPackService, 'createSnapshot').mockResolvedValue(pack)
    const compare = vi.spyOn(worldPackService, 'compare').mockResolvedValue(diff)

    render(<WorldPackLibraryView projectId="source-work" />)
    fireEvent.click(await screen.findByRole('button', { name: '为当前作品创建新版本' }))

    await waitFor(() => expect(createSnapshot).toHaveBeenCalledWith('source-work'))
    expect(await screen.findByText('已创建不可变快照 v1。旧版本未被改写。')).toBeInTheDocument()
    await waitFor(() => expect(compare).toHaveBeenCalledWith(pack.id, 'source-work'))
  })
})
