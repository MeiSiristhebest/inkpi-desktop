import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ProjectRecord, VolumeRecord } from '../../../types'
import type { ManuscriptImportPreview } from '../../../domain/manuscript/importParser'
import type { ManuscriptImportResult } from '../../../services/manuscriptImportService'

const loadManuscriptFile = vi.hoisted(() => vi.fn())
vi.mock('../../../services/manuscriptImportFile', () => ({
  loadManuscriptFile,
  MAX_MANUSCRIPT_FILE_BYTES: 20 * 1024 * 1024,
}))

import { ManuscriptImportDialog } from './ManuscriptImportDialog'

const preview: ManuscriptImportPreview = {
  fileName: '外部稿件.txt',
  format: 'txt',
  warnings: ['未识别到章节标题；每个分卷的正文会合并为一个章节。'],
  volumes: [
    {
      sourceKey: 'source-volume-1',
      title: '源卷',
      chapters: [
        { sourceKey: 'chapter-1', title: '第1章', content: '正文内容', included: true },
        { sourceKey: 'chapter-2', title: '第2章', content: '第二章内容', included: true },
      ],
    },
  ],
}

const projects: ProjectRecord[] = [
  { id: 'project-1', name: '已有作品', createdAt: 1, updatedAt: 1 },
]
const volumes: VolumeRecord[] = [
  { id: 'volume-1', projectId: 'project-1', title: '第一卷', order: 1, createdAt: 1, updatedAt: 1 },
  { id: 'volume-2', projectId: 'project-1', title: '第二卷', order: 2, createdAt: 1, updatedAt: 1 },
]
const importedResult: ManuscriptImportResult = {
  projectId: 'project-1',
  projectName: '已有作品',
  chapterCount: 2,
  volumeTitles: ['第二卷'],
}

function chooseFile() {
  fireEvent.change(screen.getByLabelText('选择稿件文件'), {
    target: { files: [new File(['正文'], '外部稿件.txt', { type: 'text/plain' })] },
  })
}

describe('ManuscriptImportDialog', () => {
  it('previews editable chapters and imports to a new project by default', async () => {
    loadManuscriptFile.mockResolvedValueOnce(preview)
    const onImport = vi.fn(async (_preview, _destination, reportProgress) => {
      reportProgress({ completedChapters: 2, totalChapters: 2 })
      return { ...importedResult, projectName: '我的新书', volumeTitles: ['源卷'] }
    })
    const onClose = vi.fn()

    render(
      <ManuscriptImportDialog
        projects={[]}
        onLoadProjectVolumes={vi.fn().mockResolvedValue([])}
        onImport={onImport}
        onClose={onClose}
      />,
    )
    chooseFile()

    expect(await screen.findByText(/外部稿件\.txt/)).toBeInTheDocument()
    expect(screen.getByText(preview.warnings[0])).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '新项目名称' })).toHaveValue('外部稿件')
    fireEvent.change(screen.getByRole('textbox', { name: '章节标题 1' }), {
      target: { value: '修改后的标题' },
    })
    fireEvent.click(screen.getByRole('button', { name: '导入 2 章' }))

    await waitFor(() => expect(onImport).toHaveBeenCalledOnce())
    expect(onImport).toHaveBeenCalledWith(
      expect.objectContaining({
        volumes: [
          expect.objectContaining({
            chapters: [expect.objectContaining({ title: '修改后的标题' }), expect.any(Object)],
          }),
        ],
      }),
      { kind: 'new-project', projectName: '外部稿件', genre: '' },
      expect.any(Function),
    )
    expect(await screen.findByRole('status')).toHaveTextContent('稿件导入完成')
    fireEvent.click(screen.getByRole('button', { name: '完成' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('loads the chosen project volumes and supports appending into one existing volume', async () => {
    loadManuscriptFile.mockResolvedValueOnce(preview)
    const onLoadProjectVolumes = vi.fn().mockResolvedValue(volumes)
    const onImport = vi.fn().mockResolvedValue(importedResult)

    render(
      <ManuscriptImportDialog
        projects={projects}
        onLoadProjectVolumes={onLoadProjectVolumes}
        onImport={onImport}
        onClose={vi.fn()}
      />,
    )
    chooseFile()
    await screen.findByText(/外部稿件\.txt/)
    fireEvent.change(screen.getByRole('combobox', { name: '导入方式' }), {
      target: { value: 'existing-volume' },
    })
    await waitFor(() => expect(onLoadProjectVolumes).toHaveBeenCalledWith('project-1'))
    expect(await screen.findByRole('option', { name: '第二卷' })).toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: '目标分卷' }), {
      target: { value: 'volume-2' },
    })
    fireEvent.click(screen.getByRole('button', { name: '导入 2 章' }))

    await waitFor(() => expect(onImport).toHaveBeenCalledOnce())
    expect(onImport.mock.calls[0][1]).toEqual({
      kind: 'existing-volume',
      projectId: 'project-1',
      volumeId: 'volume-2',
    })
  })

  it('supports creating new volumes in an existing project', async () => {
    loadManuscriptFile.mockResolvedValueOnce(preview)
    const onImport = vi.fn().mockResolvedValue(importedResult)
    render(
      <ManuscriptImportDialog
        projects={projects}
        onLoadProjectVolumes={vi.fn().mockResolvedValue(volumes)}
        onImport={onImport}
        onClose={vi.fn()}
      />,
    )
    chooseFile()
    await screen.findByText(/外部稿件\.txt/)
    fireEvent.change(screen.getByRole('combobox', { name: '导入方式' }), {
      target: { value: 'new-volumes' },
    })
    fireEvent.click(screen.getByRole('button', { name: '导入 2 章' }))

    await waitFor(() => expect(onImport).toHaveBeenCalledOnce())
    expect(onImport.mock.calls[0][1]).toEqual({ kind: 'new-volumes', projectId: 'project-1' })
  })

  it('shows file parsing errors without attempting an import', async () => {
    loadManuscriptFile.mockRejectedValueOnce(new Error('仅支持 TXT、Markdown（.md）和 DOCX 文件。'))
    const onImport = vi.fn()
    render(
      <ManuscriptImportDialog
        projects={[]}
        onLoadProjectVolumes={vi.fn()}
        onImport={onImport}
        onClose={vi.fn()}
      />,
    )
    chooseFile()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '仅支持 TXT、Markdown（.md）和 DOCX 文件。',
    )
    expect(onImport).not.toHaveBeenCalled()
  })
})
