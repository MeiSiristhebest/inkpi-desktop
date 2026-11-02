import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { indexedDbSettingsKVRepository } from '../adapters/indexedDbSettingsKVRepository'
import { PluginBookshelfActionSlot } from './pluginExtensionSlots'
import { PluginProvider, saveEnabledPluginIds } from './pluginRegistry'

afterEach(async () => {
  await indexedDbSettingsKVRepository.remove('import-source-workspace', 'enabledPlugins')
  await indexedDbSettingsKVRepository.remove('__global__', 'enabledPlugins')
})

const actionProps = {
  projects: [],
  onLoadProjectVolumes: async () => [],
  onImportManuscript: async () => ({
    projectId: 'imported-project',
    projectName: '导入作品',
    chapterCount: 1,
    volumeTitles: ['正文卷'],
  }),
}

function treeFor(workspaceId?: string) {
  return (
    <PluginProvider workspaceId={workspaceId}>
      <PluginBookshelfActionSlot {...actionProps} />
    </PluginProvider>
  )
}

describe('PluginBookshelfActionSlot', () => {
  it('keeps library-level manuscript import available across workspace scope changes', async () => {
    await indexedDbSettingsKVRepository.remove('__global__', 'enabledPlugins')
    await saveEnabledPluginIds(new Set(), 'import-source-workspace')

    const view = render(treeFor('import-source-workspace'))
    const importButton = await screen.findByRole('button', { name: '导入稿件' })

    view.rerender(treeFor())

    fireEvent.click(importButton)
    expect(await screen.findByRole('dialog', { name: '导入外部稿件' })).toBeInTheDocument()
  })
})
