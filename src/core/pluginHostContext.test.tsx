import { render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AiTask, TaskResult } from '@inkpi/protocol'
import type { PluginWorkflowOutcome } from '../types/pluginHost'
import { DesktopPluginHostProvider, usePluginHostContext } from './pluginHostContext'

function Probe({ onOutcome }: { onOutcome: (value: unknown) => void }) {
  const host = usePluginHostContext()
  void host.aiAssistant
    ?.runPluginOutcome?.('demo-plugin', '正文', { apiKey: 'secret' })
    .then(onOutcome)
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
})
