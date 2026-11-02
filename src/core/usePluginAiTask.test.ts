// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePluginAiTask, type PluginAiTaskView } from './usePluginAiTask'
import type { PluginWorkflowOutcome, PluginWorkflowSource } from '../types/pluginHost'

const box = vi.hoisted(() => ({ value: undefined as unknown }))

vi.mock('./pluginHostContext', () => ({
  useOptionalPluginHostContext: () => box.value,
}))

type OutcomeFn = (
  pluginId: string,
  input: unknown,
  metadata?: Record<string, unknown>,
  source?: PluginWorkflowSource,
) => Promise<PluginWorkflowOutcome<string> | null>

interface HostFixture {
  projectId?: string
  activeChapter?: { id: string; revision: number; content: string }
  aiAssistant: { isAvailable: boolean; runPluginOutcome?: OutcomeFn }
}

const setHost = (value: HostFixture) => {
  box.value = value
}

/** 只有断言调用次数时需要摸到那个 spy。 */
const outcomeSpy = () =>
  (box.value as HostFixture).aiAssistant.runPluginOutcome as ReturnType<typeof vi.fn>

const provenance = { pluginId: 'demo', workspaceId: 'p1', taskId: 't1', timestamp: 1 }

const completed = (text: string): PluginWorkflowOutcome<string> => ({
  status: 'completed',
  taskId: 't1',
  pluginId: 'demo',
  provenance,
  artifactContent: text,
  result: text,
})

function makeHost(outcome?: () => Promise<PluginWorkflowOutcome<string> | null>): HostFixture {
  return {
    aiAssistant: {
      isAvailable: true,
      runPluginOutcome: vi.fn(async () =>
        outcome ? outcome() : completed('AI 结论'),
      ) as OutcomeFn,
    },
  }
}

const failedHost: HostFixture = { aiAssistant: { isAvailable: false } }

describe('usePluginAiTask', () => {
  beforeEach(() => {
    setHost(makeHost())
  })

  it('没有触发之前是 idle', () => {
    const { result } = renderHook(() => usePluginAiTask('demo'))
    expect(result.current.view.kind).toBe('idle')
    expect(result.current.isRunning).toBe(false)
  })

  it('请求在途时是 running，回来后落到 result', async () => {
    let resolve: (value: PluginWorkflowOutcome<string>) => void = () => {}
    setHost(makeHost(() => new Promise<PluginWorkflowOutcome<string>>((r) => (resolve = r))))
    const { result } = renderHook(() => usePluginAiTask('demo'))

    let pending: Promise<void> = Promise.resolve()
    act(() => {
      pending = result.current.run({ text: '正文' })
    })
    await act(async () => {})
    expect(result.current.view).toEqual({ kind: 'running' })
    expect(result.current.isRunning).toBe(true)

    resolve(completed('AI：第三处伏笔未回收'))
    await act(async () => {
      await pending
    })
    expect(result.current.view).toEqual({
      kind: 'result',
      text: 'AI：第三处伏笔未回收',
      taskId: 't1',
      artifactId: undefined,
      provenance,
    })
  })

  it('失败状态带用户可读的消息，而不是只进 console', async () => {
    setHost(
      makeHost(async () => ({
        status: 'failed',
        taskId: 't9',
        pluginId: 'demo',
        provenance,
        error: 'Runtime 拒绝了这次调用',
      })),
    )
    const { result } = renderHook(() => usePluginAiTask('demo'))

    await act(async () => {
      await result.current.run({ text: '正文' })
    })

    const view = result.current.view as Extract<PluginAiTaskView, { kind: 'failed' }>
    expect(view.kind).toBe('failed')
    expect(view.message).toBe('Runtime 拒绝了这次调用')
    expect(view.taskId).toBe('t9')
  })

  it('取消显示为取消状态', async () => {
    setHost(
      makeHost(async () => ({
        status: 'cancelled',
        taskId: 't1',
        pluginId: 'demo',
        provenance,
        reason: '用户取消了任务',
      })),
    )
    const { result } = renderHook(() => usePluginAiTask('demo'))

    await act(async () => {
      await result.current.run({ text: '正文' })
    })

    expect(result.current.view).toEqual({
      kind: 'cancelled',
      message: '用户取消了任务',
      taskId: 't1',
      provenance,
    })
  })

  it('完成了但没有文本，也算失败而不是空白结果', async () => {
    setHost(
      makeHost(async () => ({
        status: 'completed',
        taskId: 't1',
        pluginId: 'demo',
        provenance,
        result: null,
      })),
    )
    const { result } = renderHook(() => usePluginAiTask('demo'))

    await act(async () => {
      await result.current.run({ text: '正文' })
    })

    expect(result.current.view).toEqual({
      kind: 'failed',
      message: '任务完成，但没有返回文本结果',
      taskId: 't1',
      provenance,
    })
  })

  it('出口返回空时不谎报成功', async () => {
    setHost(makeHost(async () => null))
    const { result } = renderHook(() => usePluginAiTask('demo'))

    await act(async () => {
      await result.current.run({ text: '正文' })
    })

    expect(result.current.view).toEqual({
      kind: 'failed',
      message: 'AI 任务没有返回结果',
      taskId: null,
    })
  })

  it('宿主没提供带类型的出口时直接可见地失败', async () => {
    setHost(failedHost)
    const { result } = renderHook(() => usePluginAiTask('demo'))

    await act(async () => {
      await result.current.run({ text: '正文' })
    })

    expect(result.current.view).toEqual({
      kind: 'failed',
      message: 'AI 通道不可用，任务没有发出',
      taskId: null,
    })
  })

  it('出口抛出时把异常消息呈现出来', async () => {
    setHost(
      makeHost(async () => {
        throw new Error('连接中断')
      }),
    )
    const { result } = renderHook(() => usePluginAiTask('demo'))

    await act(async () => {
      await result.current.run({ text: '正文' })
    })

    expect(result.current.view).toEqual({
      kind: 'failed',
      message: '连接中断',
      taskId: null,
    })
  })

  it('连点两次时，先回来的旧结果不会盖掉新的那一次', async () => {
    const resolvers: Array<(value: PluginWorkflowOutcome<string>) => void> = []
    setHost(makeHost(() => new Promise<PluginWorkflowOutcome<string>>((r) => resolvers.push(r))))
    const { result } = renderHook(() => usePluginAiTask('demo'))

    let first: Promise<void> = Promise.resolve()
    let second: Promise<void> = Promise.resolve()
    act(() => {
      first = result.current.run({ text: '第一版' })
      second = result.current.run({ text: '第二版' })
    })
    await act(async () => {})

    resolvers[1]?.(completed('第二版结果'))
    await act(async () => {
      await second
    })
    expect(result.current.view).toEqual({
      kind: 'result',
      text: '第二版结果',
      taskId: 't1',
      artifactId: undefined,
      provenance,
    })

    resolvers[0]?.(completed('第一版结果'))
    await act(async () => {
      await first
    })
    expect(result.current.view).toEqual({
      kind: 'result',
      text: '第二版结果',
      taskId: 't1',
      artifactId: undefined,
      provenance,
    })
  })

  it('把插件 id 和输入原样交给带类型的出口', async () => {
    const { result } = renderHook(() => usePluginAiTask('demo'))

    await act(async () => {
      await result.current.run({ text: '正文' })
    })

    expect(outcomeSpy()).toHaveBeenCalledWith('demo', { text: '正文' }, undefined, {
      kind: 'workspace',
    })
    expect(result.current.view).toEqual({
      kind: 'result',
      text: 'AI 结论',
      taskId: 't1',
      artifactId: undefined,
      provenance,
    })
  })

  it('forwards an explicit saved-chapter source to the host', async () => {
    const { result } = renderHook(() => usePluginAiTask('demo'))
    const source: PluginWorkflowSource = { kind: 'saved-chapter', documentId: 'chapter-selected' }

    await act(async () => {
      await result.current.run({ chapterId: 'chapter-selected' }, undefined, source)
    })

    expect(outcomeSpy()).toHaveBeenCalledWith(
      'demo',
      { chapterId: 'chapter-selected' },
      undefined,
      source,
    )
  })

  it('projects markup in saved author records while preserving structural IDs', async () => {
    const input = Object.freeze({
      authorRecords: Object.freeze([
        Object.freeze({
          id: 'gun-<b>stable</b>',
          projectId: 'p1',
          status: 'active',
          gunName: '<p>断刃 <strong>未认主</strong></p>',
          notes: '<p>作者决定在后续章节回收。</p>',
          plantSnippet: '<blockquote><p>他收起断刃。</p></blockquote>',
          provenance: Object.freeze({
            sourceType: 'author',
            evidence: Object.freeze([
              Object.freeze({ documentId: 'chapter-1', excerpt: '<p>他收起断刃。</p>' }),
            ]),
          }),
        }),
      ]),
    })
    const { result } = renderHook(() => usePluginAiTask('chekhov-radar'))

    await act(async () => {
      await result.current.run(input)
    })

    const sent = outcomeSpy().mock.calls[0][1] as {
      input: {
        authorRecords: Array<{
          id: string
          gunName: string
          notes: string
          plantSnippet: string
          provenance: { evidence: Array<{ documentId: string; excerpt: string }> }
        }>
      }
      sources: Array<{ text: string }>
    }
    expect(sent.input.authorRecords[0]).toEqual({
      id: 'gun-<b>stable</b>',
      projectId: 'p1',
      status: 'active',
      gunName: '断刃 未认主',
      notes: '作者决定在后续章节回收。',
      plantSnippet: '他收起断刃。',
      provenance: {
        sourceType: 'author',
        evidence: [{ documentId: 'chapter-1', excerpt: '他收起断刃。' }],
      },
    })
    expect(JSON.stringify(sent.sources)).not.toContain('<p>')
    expect(input.authorRecords[0].gunName).toBe('<p>断刃 <strong>未认主</strong></p>')
  })

  it('重试沿用同一份输入', async () => {
    const { result } = renderHook(() => usePluginAiTask('demo'))

    await act(async () => {
      await result.current.run({ text: '正文' })
    })

    await act(async () => {
      await result.current.retry()
    })

    expect(outcomeSpy()).toHaveBeenCalledTimes(2)
    expect(outcomeSpy()).toHaveBeenLastCalledWith('demo', { text: '正文' }, undefined, {
      kind: 'workspace',
    })
  })

  it('还没有发过请求时重试是空操作', async () => {
    const { result } = renderHook(() => usePluginAiTask('demo'))

    await act(async () => {
      await result.current.retry()
    })

    expect(outcomeSpy()).not.toHaveBeenCalled()
    expect(result.current.view.kind).toBe('idle')
  })

  it('drops an in-flight result and retry after switching projects', async () => {
    let resolve!: (value: PluginWorkflowOutcome<string>) => void
    const host = {
      ...makeHost(
        () =>
          new Promise<PluginWorkflowOutcome<string>>((r) => {
            resolve = r
          }),
      ),
      projectId: 'p1',
    }
    setHost(host)
    const { result, rerender } = renderHook(() => usePluginAiTask('demo'))
    let pending!: Promise<void>
    act(() => {
      pending = result.current.run({ text: '第一本书' })
    })
    setHost({ ...host, projectId: 'p2' })
    rerender()
    resolve(completed('第一本书的结果'))
    await act(async () => {
      await pending
      await result.current.retry()
    })
    expect(result.current.view.kind).toBe('idle')
    expect(host.aiAssistant.runPluginOutcome).toHaveBeenCalledTimes(1)
  })

  it('invalidates a displayed result when the selected chapter or local input changes', async () => {
    const { result, rerender } = renderHook(({ text }) => usePluginAiTask('demo', text), {
      initialProps: { text: '旧正文' },
    })
    await act(async () => {
      await result.current.run({ text: '旧正文' })
    })
    expect(result.current.view.kind).toBe('result')
    rerender({ text: '新正文' })
    expect(result.current.view.kind).toBe('idle')
    await act(async () => {
      await result.current.retry()
    })
    expect(outcomeSpy()).toHaveBeenCalledTimes(1)
  })

  it('does not accept unstructured or fabricated reviews from a registered analysis plugin', async () => {
    const { result } = renderHook(() => usePluginAiTask('reader-simulator'))
    await act(async () => {
      await result.current.run({ text: '她没有跪下。' })
    })
    expect(result.current.view.kind).toBe('failed')
    const sent = outcomeSpy().mock.calls[0][1]
    expect(sent).toMatchObject({
      schemaVersion: 'plugin-review-v2',
      sources: [{ id: 'text:0', text: '她没有跪下。' }],
    })
    await act(async () => {
      await result.current.retry()
    })
    expect(outcomeSpy().mock.calls[1][1]).toEqual(sent)
  })
})
