import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { indexedDbSettingsKVRepository } from '../../../adapters/indexedDbSettingsKVRepository'
import { db } from '../../../db/indexedDB'
import type { ProjectRecord } from '../../../types'
import { ProjectStartGuide, PROJECT_START_GUIDE_STORAGE_KEY } from './ProjectStartGuide'

const projectId = 'project-start-guide-test'

function makeProject(id = projectId): ProjectRecord {
  return { id, name: '雾港', createdAt: 1, updatedAt: 1 }
}

function renderGuide(id = projectId) {
  return render(
    <ProjectStartGuide
      projectId={id}
      project={makeProject(id)}
      volumes={[]}
      chapters={[]}
      onOpenView={() => {}}
    />,
  )
}

afterEach(async () => {
  cleanup()
  await indexedDbSettingsKVRepository.remove(projectId, PROJECT_START_GUIDE_STORAGE_KEY)
  await indexedDbSettingsKVRepository.remove(`${projectId}-other`, PROJECT_START_GUIDE_STORAGE_KEY)
  await db.delete('formData', `${projectId}::positioning`)
  await db.delete('formData', `${projectId}::worldbase`)
})

describe('ProjectStartGuide', () => {
  it('persists defer and ignore states per project and allows restoring a suggestion', async () => {
    const view = renderGuide()
    await screen.findByTestId('project-start-suggestion-project-positioning')
    await screen.findByTestId('project-start-suggestion-world-setting')

    fireEvent.click(screen.getByRole('button', { name: '暂缓建议：明确作品定位' }))
    await waitFor(() =>
      expect(screen.queryByTestId('project-start-suggestion-project-positioning')).toBeNull(),
    )
    expect(
      await indexedDbSettingsKVRepository.get(projectId, PROJECT_START_GUIDE_STORAGE_KEY, null),
    ).toMatchObject({
      version: 1,
      dispositions: { 'project-positioning': 'deferred' },
    })

    fireEvent.click(screen.getByRole('button', { name: '忽略建议：搭建世界设定底稿' }))
    await waitFor(() =>
      expect(screen.queryByTestId('project-start-suggestion-world-setting')).toBeNull(),
    )
    expect(
      await indexedDbSettingsKVRepository.get(projectId, PROJECT_START_GUIDE_STORAGE_KEY, null),
    ).toMatchObject({
      version: 1,
      dispositions: {
        'project-positioning': 'deferred',
        'world-setting': 'ignored',
      },
    })

    view.unmount()
    const reloaded = renderGuide()
    expect(
      await screen.findByRole('button', { name: '恢复建议：明确作品定位' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '恢复建议：搭建世界设定底稿' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '恢复建议：搭建世界设定底稿' }))
    await screen.findByTestId('project-start-suggestion-world-setting')
    expect(
      await indexedDbSettingsKVRepository.get(projectId, PROJECT_START_GUIDE_STORAGE_KEY, null),
    ).toMatchObject({
      dispositions: { 'project-positioning': 'deferred' },
    })

    reloaded.rerender(
      <ProjectStartGuide
        projectId={`${projectId}-other`}
        project={makeProject(`${projectId}-other`)}
        volumes={[]}
        chapters={[]}
        onOpenView={() => {}}
      />,
    )
    await screen.findByTestId('project-start-suggestion-project-positioning')
    expect(
      await indexedDbSettingsKVRepository.get(
        `${projectId}-other`,
        PROJECT_START_GUIDE_STORAGE_KEY,
        null,
      ),
    ).toBeNull()
  })
})
