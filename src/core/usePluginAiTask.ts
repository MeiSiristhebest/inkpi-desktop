import { useCallback, useRef, useState } from 'react'
import type { PluginWorkflowOutcome } from '../types/pluginHost'
import { useOptionalPluginHostContext } from './pluginHostContext'

/**
 * 插件视图的 AI 任务生命周期（§P1.12）。
 *
 * src/types/pluginHost.ts 的注释把话说得很死：一次插件调用是「可观测的工作流，不是可空的字符串」。
 * 但 22 个插件视图当年写的是 `runPluginTask(...).catch(console.error)`——带类型的
 * runPluginOutcome 建好之后一个消费方都没有，于是点击 AI 按钮就是付了一次 token、
 * 屏幕上一个字都不变、失败只进 console。这里把那条链路接上：请求 → 执行中 → 结果/失败（可重试）。
 *
 * 状态归这个 hook 所有；视图只负责触发和渲染 PluginAiTaskPanel。
 */

export type PluginAiTaskView =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'result'; text: string; taskId: string }
  | { kind: 'failed'; message: string; taskId: string | null }

export interface PluginAiTask {
  view: PluginAiTaskView
  isRunning: boolean
  run: (input: unknown, metadata?: Record<string, unknown>) => Promise<void>
  retry: () => Promise<void>
}

function projectOutcome(
  outcome: PluginWorkflowOutcome<string> | null,
  missingOutcomeMessage: string,
): PluginAiTaskView {
  if (!outcome) return { kind: 'failed', message: missingOutcomeMessage, taskId: null }
  switch (outcome.status) {
    case 'completed': {
      const text = outcome.artifactContent ?? outcome.result ?? ''
      return text.trim()
        ? { kind: 'result', text, taskId: outcome.taskId }
        : { kind: 'failed', message: '任务完成，但没有返回文本结果', taskId: outcome.taskId }
    }
    case 'failed':
      return { kind: 'failed', message: outcome.error, taskId: outcome.taskId }
    case 'cancelled':
      return {
        kind: 'failed',
        message: outcome.reason ?? '任务已取消',
        taskId: outcome.taskId,
      }
    case 'running':
      return { kind: 'running' }
  }
}

export function usePluginAiTask(pluginId: string): PluginAiTask {
  const hostContext = useOptionalPluginHostContext()
  const [view, setView] = useState<PluginAiTaskView>({ kind: 'idle' })
  // 递增的令牌：用户连点两次时，先回来的那一次不能覆盖更新的一次结果。
  const runTokenRef = useRef(0)
  const lastRequestRef = useRef<{ input: unknown; metadata?: Record<string, unknown> } | null>(null)

  const run = useCallback(
    async (input: unknown, metadata?: Record<string, unknown>) => {
      lastRequestRef.current = { input, metadata }
      const token = ++runTokenRef.current
      const runPluginOutcome = hostContext?.aiAssistant?.runPluginOutcome
      if (!runPluginOutcome) {
        setView({
          kind: 'failed',
          message: 'AI 通道不可用，任务没有发出',
          taskId: null,
        })
        return
      }
      setView({ kind: 'running' })
      try {
        const outcome = await runPluginOutcome(pluginId, input, metadata)
        if (token !== runTokenRef.current) return
        setView(projectOutcome(outcome, 'AI 任务没有返回结果'))
      } catch (cause) {
        if (token !== runTokenRef.current) return
        setView({
          kind: 'failed',
          message: cause instanceof Error ? cause.message : String(cause),
          taskId: null,
        })
      }
    },
    [hostContext, pluginId],
  )

  const retry = useCallback(() => {
    const request = lastRequestRef.current
    if (!request) return Promise.resolve()
    return run(request.input, request.metadata)
  }, [run])

  return { view, isRunning: view.kind === 'running', run, retry }
}
