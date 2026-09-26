import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AiTask, TaskResult } from '@inkpi/protocol'
import { DesktopPluginHostProvider } from '../core/pluginHostContext'
import { SubtextMasterView } from './subtext-compiler/components/SubtextMasterView'

const PLUGIN_ROOT = dirname(fileURLToPath(import.meta.url))
const AI_BUTTON = 'AI 潜台词与微表情深度编译'

function viewSources(directory: string): string[] {
  const files: string[] = []
  for (const name of readdirSync(directory)) {
    const file = join(directory, name)
    if (statSync(file).isDirectory()) {
      files.push(...viewSources(file))
    } else if (name.endsWith('.tsx') && !name.includes('.test.')) {
      files.push(file)
    }
  }
  return files
}

function relativeToPlugins(file: string): string {
  return relative(PLUGIN_ROOT, file).split(/[\\/]/).join('/')
}

const seamViews = viewSources(PLUGIN_ROOT).filter((file) =>
  readFileSync(file, 'utf8').includes('usePluginAiTask('),
)

function renderSubtextView(onAiTask: (task: AiTask) => Promise<TaskResult | null>) {
  return render(
    <DesktopPluginHostProvider
      projectId="p1"
      activeChapter={null}
      onAiTask={onAiTask}
      isAiConnected
    >
      <SubtextMasterView projectId="p1" />
    </DesktopPluginHostProvider>,
  )
}

describe('plugin AI task lifecycle (§P1.12)', () => {
  it('gives every view on the task seam a receipt panel and no discarded call', () => {
    expect(seamViews.length).toBeGreaterThanOrEqual(22)

    const unmountedReceipt = seamViews
      .filter((file) => {
        const source = readFileSync(file, 'utf8')
        return !source.includes('<PluginAiTaskPanel') || !/aiTask\.run\(/.test(source)
      })
      .map(relativeToPlugins)
    expect(unmountedReceipt).toEqual([])

    const fireAndForget = viewSources(PLUGIN_ROOT)
      .filter((file) => /runPluginTask\s*\(/.test(readFileSync(file, 'utf8')))
      .map(relativeToPlugins)
    expect(fireAndForget).toEqual([])
  })

  it('shows the running state, then the result, on screen', async () => {
    let settle: ((result: TaskResult | null) => void) | undefined
    const onAiTask = vi.fn(
      () =>
        new Promise<TaskResult | null>((resolve) => {
          settle = resolve
        }),
    )
    renderSubtextView(onAiTask)

    fireEvent.click(screen.getByRole('button', { name: AI_BUTTON }))
    expect(onAiTask).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent('AI 任务执行中')
    expect(screen.getByRole('button', { name: AI_BUTTON })).toBeDisabled()

    settle!({
      taskId: 'plugin-task-1',
      kind: 'plugin.subtext-compiler.analysis',
      status: 'completed',
      output: { format: 'text', text: '她攥紧了袖口，却始终没有抬头。' },
    })

    await waitFor(() =>
      expect(screen.getByLabelText('AI 任务结果')).toHaveTextContent(
        '她攥紧了袖口，却始终没有抬头。',
      ),
    )
    expect(screen.getByText('未写入正文')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('surfaces a failed task with the Runtime message and retries the same request', async () => {
    let attempts = 0
    const onAiTask = vi.fn(async (): Promise<TaskResult | null> => {
      attempts += 1
      if (attempts === 1) {
        return {
          taskId: 'plugin-task-1',
          kind: 'plugin.subtext-compiler.analysis',
          status: 'failed',
          error: { code: 'provider_unavailable', message: '上游模型暂时不可用' },
        }
      }
      return {
        taskId: 'plugin-task-2',
        kind: 'plugin.subtext-compiler.analysis',
        status: 'completed',
        output: { format: 'text', text: '重试后的潜台词' },
      }
    })
    renderSubtextView(onAiTask)

    fireEvent.click(screen.getByRole('button', { name: AI_BUTTON }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('上游模型暂时不可用'))

    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    await waitFor(() =>
      expect(screen.getByLabelText('AI 任务结果')).toHaveTextContent('重试后的潜台词'),
    )
    expect(onAiTask).toHaveBeenCalledTimes(2)
  })

  it('reports a task that never reached AI instead of failing silently', async () => {
    const onAiTask = vi.fn(async (): Promise<TaskResult | null> => null)
    renderSubtextView(onAiTask)

    fireEvent.click(screen.getByRole('button', { name: AI_BUTTON }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent('Plugin task returned no text output')
    expect(screen.queryByLabelText('AI 任务结果')).not.toBeInTheDocument()
  })
})
