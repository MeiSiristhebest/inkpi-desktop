import { render, waitFor } from '@testing-library/react'
import { useEffect, useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AiTask, TaskResult } from '@inkpi/protocol'
import type { PluginWorkflowOutcome } from '../types/pluginHost'
import type { CodexEntity } from '../plugins/living-codex/types'
import { indexedDbCodexEntityRepository } from '../adapters/indexedDbCodexEntityRepository'
import { codexApplicationService } from '../services/domainApplicationServices'
import type { ChapterRecord } from '../types'
import { DesktopPluginHostProvider, usePluginHostContext } from './pluginHostContext'

const codexEntity: CodexEntity = {
  id: 'entity-1',
  projectId: 'project-1',
  name: '主角',
  aliases: [],
  category: 'character',
  attributes: {},
  relations: [],
  summary: '当前项目实体',
  createdAt: 1,
  updatedAt: 1,
}

function CodexMutationProbe({
  entityId,
  patch,
  onResult,
}: {
  entityId: string
  patch: Partial<CodexEntity>
  onResult: (value: unknown) => void
}) {
  const { mutateCodexEntity } = usePluginHostContext()

  useEffect(() => {
    void mutateCodexEntity(entityId, () => patch).then(
      () => onResult({ status: 'saved' }),
      (error: unknown) =>
        onResult({
          status: 'failed',
          message: error instanceof Error ? error.message : String(error),
        }),
    )
  }, [entityId, mutateCodexEntity, onResult, patch])

  return null
}

function CodexMutationAfterProjectSwitchProbe({
  projectId,
  onResult,
}: {
  projectId: string
  onResult: (value: unknown) => void
}) {
  const { mutateCodexEntity } = usePluginHostContext()

  useEffect(() => {
    if (projectId !== 'project-2') return

    void mutateCodexEntity('entity-2', () => ({ summary: 'updated in project 2' })).then(
      () => onResult({ status: 'saved' }),
      (error: unknown) =>
        onResult({
          status: 'failed',
          message: error instanceof Error ? error.message : String(error),
        }),
    )
  }, [mutateCodexEntity, onResult, projectId])

  return null
}

afterEach(() => vi.restoreAllMocks())

function Probe({ onOutcome }: { onOutcome: (value: unknown) => void }) {
  const host = usePluginHostContext()
  void host.aiAssistant
    ?.runPluginOutcome?.('demo-plugin', '正文', { apiKey: 'secret' })
    .then(onOutcome)
  return null
}

function AnalysisProbe({ onOutcome }: { onOutcome: (value: unknown) => void }) {
  const host = usePluginHostContext()
  const { aiAssistant } = host
  const chapterRevision =
    host.bookHierarchy.chapters.find((chapter) => chapter.id === 'chapter-1')?.revision ??
    (host.activeChapter?.id === 'chapter-1' ? host.activeChapter.revision : undefined)
  const lastRunKey = useRef<string | null>(null)

  useEffect(() => {
    const runKey = `chapter-1:${chapterRevision ?? 'unknown'}`
    if (!aiAssistant || lastRunKey.current === runKey) return
    lastRunKey.current = runKey
    void aiAssistant
      .runPluginOutcome?.('demo-plugin', '正文', undefined, {
        kind: 'saved-chapter',
        documentId: 'chapter-1',
      })
      .then(onOutcome)
  }, [aiAssistant, chapterRevision, onOutcome])

  return null
}

function WorkspaceAnalysisProbe({ onOutcome }: { onOutcome: (value: unknown) => void }) {
  const { aiAssistant } = usePluginHostContext()
  const hasRun = useRef(false)

  useEffect(() => {
    if (!aiAssistant || hasRun.current) return
    hasRun.current = true
    void aiAssistant.runPluginOutcome?.('demo-plugin', '正文').then(onOutcome)
  }, [aiAssistant, onOutcome])

  return null
}

function SelectedChapterAnalysisProbe({ onOutcome }: { onOutcome: (value: unknown) => void }) {
  const { aiAssistant } = usePluginHostContext()

  useEffect(() => {
    void aiAssistant
      ?.runPluginOutcome?.('demo-plugin', { chapterId: 'chapter-b' }, undefined, {
        kind: 'saved-chapter',
        documentId: 'chapter-b',
      })
      .then(onOutcome)
  }, [aiAssistant, onOutcome])

  return null
}

function RawTaskProbe({ onResult }: { onResult: (value: unknown) => void }) {
  const host = usePluginHostContext()
  void host.aiAssistant
    ?.runTask({
      id: 'raw-task',
      kind: 'plugin.demo-plugin.analysis',
      input: { payload: { apiKey: 'task-secret' } },
    } as AiTask)
    .then(onResult)
  return null
}

function LegacyProbe({ onOutput }: { onOutput: (value: unknown) => void }) {
  const host = usePluginHostContext()
  void host.aiAssistant?.runPluginTask?.('demo-plugin', '正文', { apiKey: 'secret' }).then(onOutput)
  return null
}

function BoundaryProbe({ onResult }: { onResult: (value: unknown) => void }) {
  const host = usePluginHostContext()
  void Promise.all([
    host.aiAssistant?.runPluginTool?.('demo-plugin', {
      password: 'tool-password',
      note: 'Bearer tool-token',
    }),
    host.aiAssistant?.runPluginWorkflow?.(
      'demo-plugin',
      { authorization: 'workflow-authorization', note: 'token=workflow-token' },
      { password: 'metadata-password' },
    ),
  ]).then(onResult)
  return null
}

describe('Desktop plugin workflow outcomes', () => {
  const renderProbe = (result: TaskResult, onOutcome: (value: unknown) => void) =>
    render(
      <DesktopPluginHostProvider
        projectId="workspace-1"
        activeChapter={null}
        isAiConnected
        onAiTask={vi.fn(async () => result)}
      >
        <Probe onOutcome={onOutcome} />
      </DesktopPluginHostProvider>,
    )

  it('returns completed artifact content and redacted provenance', async () => {
    const outcome = vi.fn()
    renderProbe(
      {
        taskId: 'runtime-task',
        kind: 'plugin.demo-plugin.analysis',
        status: 'completed',
        output: { format: 'text', text: 'artifact正文 apiKey=output-secret' },
        artifactIds: ['artifact-1'],
        provenance: { routeId: 'local', apiKey: 'secret', provider: 'local-provider' },
      },
      outcome,
    )
    await waitFor(() => expect(outcome).toHaveBeenCalled())
    expect(outcome.mock.calls[0][0]).toMatchObject({
      status: 'completed',
      artifactId: 'artifact-1',
      artifactContent: 'artifact正文 apiKey=[redacted]',
      provenance: { routeId: 'local', provider: 'local-provider' },
    })
    expect(JSON.stringify(outcome.mock.calls[0][0])).not.toContain('secret')
    expect(JSON.stringify(outcome.mock.calls[0][0])).not.toContain('output-secret')
  })

  it('uses the selected saved chapter revision for plugin analysis tasks', async () => {
    const activeChapter: ChapterRecord = {
      id: 'chapter-1',
      projectId: 'workspace-1',
      volumeId: 'volume-1',
      title: '第一章',
      content: '正文',
      wordCount: 2,
      order: 1,
      revision: 2,
      createdAt: 1,
      updatedAt: 1,
    }
    const onAiTask = vi.fn(async (task: AiTask) => ({
      taskId: task.id,
      kind: task.kind,
      status: 'completed' as const,
      output: { format: 'text' as const, text: '分析结果' },
    }))
    const outcome = vi.fn()
    const view = render(
      <DesktopPluginHostProvider
        projectId="workspace-1"
        activeChapter={activeChapter}
        isAiConnected
        onAiTask={onAiTask}
      >
        <AnalysisProbe onOutcome={outcome} />
      </DesktopPluginHostProvider>,
    )

    view.rerender(
      <DesktopPluginHostProvider
        projectId="workspace-1"
        activeChapter={{ ...activeChapter, revision: 5 }}
        isAiConnected
        onAiTask={onAiTask}
      >
        <AnalysisProbe onOutcome={outcome} />
      </DesktopPluginHostProvider>,
    )

    await waitFor(() => expect(onAiTask).toHaveBeenCalledTimes(2))
    expect(onAiTask.mock.calls[1]?.[0]).toMatchObject({
      scope: { document: { id: 'chapter-1', revision: 5 } },
      metadata: { sourceKind: 'saved-chapter' },
    })
    await waitFor(() => expect(outcome).toHaveBeenCalledTimes(2))
    expect(outcome.mock.calls[1]?.[0]).toMatchObject({
      provenance: {
        sourceKind: 'saved-chapter',
        documentId: 'chapter-1',
        documentRevision: 5,
      },
    })
  })

  it('uses a plugin-selected chapter instead of the unrelated active chapter', async () => {
    const active: ChapterRecord = {
      id: 'chapter-a',
      projectId: 'workspace-1',
      volumeId: 'volume-1',
      title: 'A',
      content: 'A正文',
      wordCount: 3,
      order: 1,
      revision: 2,
      createdAt: 1,
      updatedAt: 1,
    }
    const selected: ChapterRecord = {
      ...active,
      id: 'chapter-b',
      title: 'B',
      content: 'B正文',
      order: 2,
      revision: 7,
    }
    const onAiTask = vi.fn(async (task: AiTask) => ({
      taskId: task.id,
      kind: task.kind,
      status: 'completed' as const,
      output: { format: 'text' as const, text: '审阅完成' },
    }))
    const outcome = vi.fn()
    render(
      <DesktopPluginHostProvider
        projectId="workspace-1"
        activeChapter={active}
        chapters={[active, selected]}
        isAiConnected
        onAiTask={onAiTask}
      >
        <SelectedChapterAnalysisProbe onOutcome={outcome} />
      </DesktopPluginHostProvider>,
    )

    await waitFor(() => expect(onAiTask).toHaveBeenCalledTimes(1))
    expect(onAiTask.mock.calls[0]?.[0]).toMatchObject({
      scope: { workspaceId: 'workspace-1', document: { id: 'chapter-b', revision: 7 } },
      input: { documentId: 'chapter-b' },
    })
    await waitFor(() => expect(outcome).toHaveBeenCalledTimes(1))
    expect(outcome.mock.calls[0]?.[0]).toMatchObject({
      provenance: { documentId: 'chapter-b', documentRevision: 7, sourceKind: 'saved-chapter' },
    })
  })

  it('rejects a selected chapter that belongs to another workspace', async () => {
    const active: ChapterRecord = {
      id: 'chapter-a',
      projectId: 'workspace-1',
      volumeId: 'volume-1',
      title: 'A',
      content: 'A正文',
      wordCount: 3,
      order: 1,
      revision: 2,
      createdAt: 1,
      updatedAt: 1,
    }
    const foreign: ChapterRecord = {
      ...active,
      id: 'chapter-b',
      projectId: 'workspace-2',
      title: 'B',
      revision: 7,
    }
    const onAiTask = vi.fn(async (task: AiTask) => ({
      taskId: task.id,
      kind: task.kind,
      status: 'completed' as const,
      output: { format: 'text' as const, text: '不应执行' },
    }))
    const outcome = vi.fn()
    render(
      <DesktopPluginHostProvider
        projectId="workspace-1"
        activeChapter={active}
        chapters={[foreign]}
        isAiConnected
        onAiTask={onAiTask}
      >
        <SelectedChapterAnalysisProbe onOutcome={outcome} />
      </DesktopPluginHostProvider>,
    )

    await waitFor(() => expect(outcome).toHaveBeenCalledTimes(1))
    expect(onAiTask).not.toHaveBeenCalled()
    expect(outcome.mock.calls[0]?.[0]).toMatchObject({
      status: 'failed',
      error: '所选章节不属于当前作品或已不可用。',
      provenance: { sourceKind: 'saved-chapter' },
    })
    expect(outcome.mock.calls[0]?.[0].provenance).not.toHaveProperty('documentId')
  })

  it('does not fabricate a document for a workspace-level plugin task', async () => {
    const active: ChapterRecord = {
      id: 'chapter-a',
      projectId: 'workspace-1',
      volumeId: 'volume-1',
      title: 'A',
      content: 'A正文',
      wordCount: 3,
      order: 1,
      revision: 2,
      createdAt: 1,
      updatedAt: 1,
    }
    const onAiTask = vi.fn(async (task: AiTask) => ({
      taskId: task.id,
      kind: task.kind,
      status: 'completed' as const,
      output: { format: 'text' as const, text: '审阅完成' },
    }))
    const outcome = vi.fn()
    render(
      <DesktopPluginHostProvider
        projectId="workspace-1"
        activeChapter={active}
        isAiConnected
        onAiTask={onAiTask}
      >
        <WorkspaceAnalysisProbe onOutcome={outcome} />
      </DesktopPluginHostProvider>,
    )

    await waitFor(() => expect(onAiTask).toHaveBeenCalledTimes(1))
    expect(onAiTask.mock.calls[0]?.[0].scope).toEqual({
      workspaceId: 'workspace-1',
      workspaceRevision: 1,
    })
    await waitFor(() => expect(outcome).toHaveBeenCalledTimes(1))
    expect(outcome.mock.calls[0]?.[0]).toMatchObject({ provenance: { sourceKind: 'workspace' } })
    expect(outcome.mock.calls[0]?.[0].provenance).not.toHaveProperty('documentId')
  })

  it('redacts raw task input and output at the host boundary', async () => {
    const result = vi.fn()
    const onAiTask = vi.fn(async (task: AiTask) => {
      expect(task.input.payload).toEqual({ apiKey: '[redacted]' })
      return {
        taskId: task.id,
        kind: task.kind,
        status: 'completed' as const,
        output: { format: 'text' as const, text: 'apiKey=task-output-secret' },
        provenance: { apiKey: 'task-provenance-secret' },
      }
    })

    render(
      <DesktopPluginHostProvider
        projectId="workspace-1"
        activeChapter={null}
        isAiConnected
        onAiTask={onAiTask}
      >
        <RawTaskProbe onResult={result} />
      </DesktopPluginHostProvider>,
    )

    await waitFor(() => expect(result).toHaveBeenCalled())
    expect(result.mock.calls[0][0]).toMatchObject({
      output: { text: 'apiKey=[redacted]' },
      provenance: { apiKey: '[redacted]' },
    })
    expect(JSON.stringify(result.mock.calls[0][0])).not.toContain('secret')
  })

  it('redacts legacy task output at the host boundary', async () => {
    const output = vi.fn()
    render(
      <DesktopPluginHostProvider
        projectId="workspace-1"
        activeChapter={null}
        isAiConnected
        onAiTask={vi.fn(async () => ({
          taskId: 'runtime-task',
          kind: 'plugin.demo-plugin.analysis',
          status: 'completed' as const,
          output: { format: 'text' as const, text: 'apiKey=legacy-secret' },
        }))}
      >
        <LegacyProbe onOutput={output} />
      </DesktopPluginHostProvider>,
    )

    await waitFor(() => expect(output).toHaveBeenCalledWith('apiKey=[redacted]'))
    expect(JSON.stringify(output.mock.calls[0][0])).not.toContain('legacy-secret')
  })

  it('redacts tool and workflow input, metadata, and returned content at the host boundary', async () => {
    const onTool = vi.fn(async (_pluginId: string, input: Record<string, unknown>) => {
      expect(input).toMatchObject({ password: '[redacted]', note: 'Bearer [redacted]' })
      return { password: 'returned-password', note: 'token=returned-token' }
    })
    const onWorkflow = vi.fn(
      async (
        _pluginId: string,
        input: unknown,
        metadata?: Record<string, unknown>,
      ): Promise<PluginWorkflowOutcome<unknown>> => {
        expect(input).toMatchObject({
          authorization: '[redacted]',
          note: 'token=[redacted]',
        })
        expect(metadata).toEqual({ password: '[redacted]' })
        return {
          status: 'completed',
          taskId: 'workflow-task',
          pluginId: 'demo-plugin',
          provenance: {
            pluginId: 'demo-plugin',
            workspaceId: 'workspace-1',
            taskId: 'workflow-task',
            timestamp: 1,
          },
          result: { password: 'result-password' },
          artifactContent: 'Bearer result-token',
        }
      },
    )
    const onResult = vi.fn()

    render(
      <DesktopPluginHostProvider
        projectId="workspace-1"
        activeChapter={null}
        isAiConnected
        onPluginTool={onTool}
        onPluginWorkflow={onWorkflow}
      >
        <BoundaryProbe onResult={onResult} />
      </DesktopPluginHostProvider>,
    )

    await waitFor(() => expect(onResult).toHaveBeenCalled())
    expect(JSON.stringify(onResult.mock.calls[0][0])).not.toContain('returned-password')
    expect(JSON.stringify(onResult.mock.calls[0][0])).not.toContain('result-token')
  })

  it.each([
    ['failed', { code: 'FAILED', message: 'provider failed' }],
    ['cancelled', { code: 'CANCELLED', message: 'user cancelled' }],
  ] as const)('returns a typed %s terminal outcome', async (status, error) => {
    const outcome = vi.fn()
    renderProbe(
      {
        taskId: 'runtime-task',
        kind: 'plugin.demo-plugin.analysis',
        status,
        error,
      },
      outcome,
    )
    await waitFor(() => expect(outcome).toHaveBeenCalled())
    expect(outcome.mock.calls[0][0]).toMatchObject({ status })
  })

  it('rejects entity IDs outside the active project before saving', async () => {
    const getByProject = vi
      .spyOn(indexedDbCodexEntityRepository, 'getByProject')
      .mockResolvedValue([])
    const saveEntity = vi.spyOn(codexApplicationService, 'saveEntity').mockResolvedValue()
    const result = vi.fn()

    render(
      <DesktopPluginHostProvider projectId="project-1" activeChapter={null}>
        <CodexMutationProbe
          entityId="entity-from-project-2"
          patch={{ summary: 'changed' }}
          onResult={result}
        />
      </DesktopPluginHostProvider>,
    )

    await waitFor(() =>
      expect(result).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' })),
    )
    expect(getByProject).toHaveBeenCalledWith('project-1')
    expect(result.mock.calls[0][0].message).toContain('not found in project project-1')
    expect(saveEntity).not.toHaveBeenCalled()
  })

  it.each([
    ['projectId', { projectId: 'project-2', summary: 'changed' }],
    ['id', { id: 'entity-from-project-2', summary: 'changed' }],
  ] as const)('rejects an entity mutation that changes %s', async (_field, patch) => {
    const saveEntity = vi.spyOn(codexApplicationService, 'saveEntity').mockResolvedValue()
    vi.spyOn(indexedDbCodexEntityRepository, 'getByProject').mockResolvedValue([codexEntity])
    const result = vi.fn()

    render(
      <DesktopPluginHostProvider projectId="project-1" activeChapter={null}>
        <CodexMutationProbe entityId="entity-1" patch={patch} onResult={result} />
      </DesktopPluginHostProvider>,
    )

    await waitFor(() =>
      expect(result).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' })),
    )
    expect(saveEntity).not.toHaveBeenCalled()
  })

  it('saves a mutation for an entity in the active project', async () => {
    const saveEntity = vi.spyOn(codexApplicationService, 'saveEntity').mockResolvedValue()
    vi.spyOn(indexedDbCodexEntityRepository, 'getByProject').mockResolvedValue([codexEntity])
    const result = vi.fn()

    render(
      <DesktopPluginHostProvider projectId="project-1" activeChapter={null}>
        <CodexMutationProbe entityId="entity-1" patch={{ summary: 'updated' }} onResult={result} />
      </DesktopPluginHostProvider>,
    )

    await waitFor(() => expect(result).toHaveBeenCalledWith({ status: 'saved' }))
    expect(saveEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'entity-1',
        projectId: 'project-1',
        summary: 'updated',
      }),
      'author-confirmed',
    )
  })

  it('uses the new project scope after switching projects', async () => {
    const projectTwoEntity: CodexEntity = {
      ...codexEntity,
      id: 'entity-2',
      projectId: 'project-2',
    }
    const getByProject = vi
      .spyOn(indexedDbCodexEntityRepository, 'getByProject')
      .mockImplementation(async (projectId) =>
        projectId === 'project-2' ? [projectTwoEntity] : [],
      )
    const saveEntity = vi.spyOn(codexApplicationService, 'saveEntity').mockResolvedValue()
    const result = vi.fn()
    const view = render(
      <DesktopPluginHostProvider projectId="project-1" activeChapter={null}>
        <CodexMutationAfterProjectSwitchProbe projectId="project-1" onResult={result} />
      </DesktopPluginHostProvider>,
    )

    view.rerender(
      <DesktopPluginHostProvider projectId="project-2" activeChapter={null}>
        <CodexMutationAfterProjectSwitchProbe projectId="project-2" onResult={result} />
      </DesktopPluginHostProvider>,
    )

    await waitFor(() => expect(result).toHaveBeenCalledWith({ status: 'saved' }))
    expect(getByProject).toHaveBeenCalledWith('project-2')
    expect(saveEntity).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'entity-2', projectId: 'project-2' }),
      'author-confirmed',
    )
  })
})
