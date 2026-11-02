import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReferenceSourceRecord } from '../../../domain/references/referenceMaterials'
import * as localDocumentText from '../../../services/localDocumentText'
import { referenceLibraryService } from '../../../services/referenceLibraryService'
import { ReferenceLibraryView } from './ReferenceLibraryView'

const source: ReferenceSourceRecord = {
  id: 'reference-urban',
  title: '都市交通',
  originalFileName: 'urban.md',
  format: 'md',
  text: '北京地铁改变城市通勤。',
  tags: ['都市'],
  contentFingerprint: 'fingerprint',
  importedAt: 1,
  updatedAt: 1,
}

afterEach(() => vi.restoreAllMocks())

describe('ReferenceLibraryView', () => {
  it('lists global sources and toggles their link to the current project', async () => {
    const listSources = vi
      .spyOn(referenceLibraryService, 'listProjectSources')
      .mockResolvedValueOnce([{ source, attached: false }])
      .mockResolvedValueOnce([{ source, attached: true }])
    const attach = vi.spyOn(referenceLibraryService, 'attachToProject').mockResolvedValue()
    const detach = vi.spyOn(referenceLibraryService, 'detachFromProject').mockResolvedValue()

    render(<ReferenceLibraryView projectId="project-1" />)

    expect(await screen.findByText('都市交通')).toBeInTheDocument()
    const link = screen.getByRole('checkbox', { name: '关联到当前作品 都市交通' })
    expect(link).not.toBeChecked()
    fireEvent.click(link)

    await waitFor(() => expect(attach).toHaveBeenCalledWith('project-1', source.id))
    await waitFor(() => expect(listSources).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('checkbox', { name: '关联到当前作品 都市交通' })).toBeChecked()
    expect(detach).not.toHaveBeenCalled()
  })

  it('previews locally extracted text before saving and linking it', async () => {
    vi.spyOn(referenceLibraryService, 'listProjectSources').mockResolvedValue([])
    const extracted = {
      fileName: 'city-guide.md',
      format: 'md' as const,
      text: '地铁线路与街区变迁。',
      warnings: [],
    }
    const extract = vi
      .spyOn(localDocumentText, 'extractLocalDocumentText')
      .mockResolvedValue(extracted)
    const create = vi.spyOn(referenceLibraryService, 'createSource').mockResolvedValue(source)
    const attach = vi.spyOn(referenceLibraryService, 'attachToProject').mockResolvedValue()

    render(<ReferenceLibraryView projectId="project-1" />)
    const file = new File(['地铁线路与街区变迁。'], 'city-guide.md', { type: 'text/markdown' })
    fireEvent.change(screen.getByTestId('reference-file-input'), { target: { files: [file] } })

    expect(await screen.findByText('地铁线路与街区变迁。')).toBeInTheDocument()
    expect(extract).toHaveBeenCalledWith(file)
    fireEvent.click(screen.getByRole('button', { name: '保存并关联到当前作品' }))

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({ extracted, title: 'city-guide', tags: [] }),
    )
    expect(attach).toHaveBeenCalledWith('project-1', source.id)
  })
})
