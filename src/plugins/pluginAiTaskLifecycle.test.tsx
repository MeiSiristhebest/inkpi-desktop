import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AiTask, TaskResult } from '@inkpi/protocol'
import { DesktopPluginHostProvider } from '../core/pluginHostContext'
import type { ChapterRecord } from '../types'
import { SubtextMasterView } from './subtext-compiler/components/SubtextMasterView'

const PLUGIN_ROOT = dirname(fileURLToPath(import.meta.url))
const AI_BUTTON = 'AI 潜台词方案复核'
const chapter: ChapterRecord = {
  id: 'chapter-1',
  projectId: 'p1',
  volumeId: 'volume-1',
  title: '第一章',
  content: '对白正文',
  wordCount: 4,
  order: 0,
  revision: 8,
  createdAt: 1,
  updatedAt: 1,
}

const subtextReview = (interpretation: string) =>
  JSON.stringify({
    findings: [
      {
        aspect: 'spoken_meaning',
        observation: '原文台词是“我没事。”',
        interpretation,
        recommendation: '',
        evidence: [{ sourceId: 'spoken:0', start: 0, end: 4, quote: '我没事。' }],
      },
    ],
    insufficientEvidence: ['没有真实读者反馈，不能验证实际阅读效果。'],
  })

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
  const view = render(
    <DesktopPluginHostProvider
      projectId="p1"
      activeChapter={chapter}
      onAiTask={onAiTask}
      isAiConnected
    >
      <SubtextMasterView projectId="p1" />
    </DesktopPluginHostProvider>,
  )

  fireEvent.change(screen.getByPlaceholderText('填写角色名'), {
    target: { value: '角色甲' },
  })
  fireEvent.change(screen.getByPlaceholderText('填写需要分析的对白'), {
    target: { value: '我没事。' },
  })

  return view
}

describe('plugin AI task lifecycle (§P1.12)', () => {
  it('gives every view on the task seam a receipt panel and no discarded call', () => {
    expect(seamViews.length).toBeGreaterThanOrEqual(22)

    const unscopedTaskViews = seamViews
      .filter((file) =>
        /usePluginAiTask\(\s*(?:'[^']+'|"[^"]+")\s*\)/.test(readFileSync(file, 'utf8')),
      )
      .map(relativeToPlugins)
    expect(unscopedTaskViews).toEqual([])

    const unmountedReceipt = seamViews
      .filter((file) => {
        const source = readFileSync(file, 'utf8')
        const taskBinding = source.match(
          /\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*usePluginAiTask\(/,
        )?.[1]
        return (
          !source.includes('<PluginAiTaskPanel') ||
          !taskBinding ||
          !new RegExp(`${taskBinding}\\.run\\(`).test(source)
        )
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
      output: {
        format: 'text',
        text: subtextReview('可能在掩饰不适，但现有材料不足以确认隐藏动机。'),
      },
      artifactIds: ['artifact-1'],
      provenance: { provider: 'openrouter', model: 'test-model' },
    })

    await waitFor(() =>
      expect(screen.getByLabelText('AI 任务结果')).toHaveTextContent('可能在掩饰不适'),
    )
    expect(screen.getByText('未写入正文')).toBeInTheDocument()
    const receipt = screen.getByLabelText('AI 任务来源与保存状态')
    expect(receipt).toHaveTextContent('来源 手动输入')
    expect(receipt).not.toHaveTextContent('chapter-1')
    expect(receipt).toHaveTextContent('模型 openrouter / test-model')
    expect(receipt).toHaveTextContent('结果记录 artifact-1')
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
        output: {
          format: 'text',
          text: subtextReview('重试后的潜台词仍是待作者复核的解释。'),
        },
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

  it('shows cancellation as a cancelled receipt instead of a failure', async () => {
    const onAiTask = vi.fn(async (): Promise<TaskResult | null> => ({
      taskId: 'cancelled-task-1',
      kind: 'plugin.subtext-compiler.analysis',
      status: 'cancelled',
      error: { code: 'cancelled', message: '作者取消了这次分析' },
    }))
    renderSubtextView(onAiTask)

    fireEvent.click(screen.getByRole('button', { name: AI_BUTTON }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('AI 任务已取消'))

    expect(screen.getByRole('status')).toHaveTextContent('作者取消了这次分析')
    expect(screen.getByRole('status')).toHaveTextContent('来源 手动输入')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
