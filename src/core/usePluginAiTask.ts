import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  PluginWorkflowOutcome,
  PluginWorkflowProvenance,
  PluginWorkflowSource,
} from '../types/pluginHost'
import { useOptionalPluginHostContext } from './pluginHostContext'
import { projectSemanticTextFields } from '../domain/content'
import {
  buildGroundedPluginInput,
  validatePluginReview,
  type GroundedPluginInput,
} from '../domain/pluginAnalysis'

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
  | { kind: 'running'; taskId?: string; provenance?: PluginWorkflowProvenance }
  | {
      kind: 'result'
      text: string
      taskId: string
      artifactId?: string
      provenance: PluginWorkflowProvenance
    }
  | {
      kind: 'cancelled'
      message: string
      taskId: string
      provenance: PluginWorkflowProvenance
    }
  | {
      kind: 'failed'
      message: string
      taskId: string | null
      provenance?: PluginWorkflowProvenance
    }

export interface PluginAiTask {
  view: PluginAiTaskView
  isRunning: boolean
  run: (
    input: unknown,
    metadata?: Record<string, unknown>,
    source?: PluginWorkflowSource,
  ) => Promise<void>
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
        ? {
            kind: 'result',
            text,
            taskId: outcome.taskId,
            artifactId: outcome.artifactId,
            provenance: outcome.provenance,
          }
        : {
            kind: 'failed',
            message: '任务完成，但没有返回文本结果',
            taskId: outcome.taskId,
            provenance: outcome.provenance,
          }
    }
    case 'failed':
      return {
        kind: 'failed',
        message: outcome.error,
        taskId: outcome.taskId,
        provenance: outcome.provenance,
      }
    case 'cancelled':
      return {
        kind: 'cancelled',
        message: outcome.reason ?? '任务已取消',
        taskId: outcome.taskId,
        provenance: outcome.provenance,
      }
    case 'running':
      return {
        kind: 'running',
        taskId: outcome.taskId,
        provenance: outcome.provenance,
      }
  }
}

export function usePluginAiTask(pluginId: string, inputIdentity?: unknown): PluginAiTask {
  const hostContext = useOptionalPluginHostContext()
  const scope = JSON.stringify([
    pluginId,
    hostContext?.projectId,
    hostContext?.activeChapter?.id,
    hostContext?.activeChapter?.revision,
    hostContext?.activeChapter?.content,
    inputIdentity,
  ])
  const [state, setState] = useState<{ scope: string; view: PluginAiTaskView }>({
    scope,
    view: { kind: 'idle' },
  })
  const view: PluginAiTaskView = state.scope === scope ? state.view : { kind: 'idle' }
  // 递增的令牌：用户连点两次时，先回来的那一次不能覆盖更新的一次结果。
  const runTokenRef = useRef(0)
  type Request = {
    scope: string
    input: unknown
    reviewInput: GroundedPluginInput | null
    metadata?: Record<string, unknown>
    source: PluginWorkflowSource
  }
  const lastRequestRef = useRef<Request | null>(null)

  useEffect(() => {
    lastRequestRef.current = null
    return () => {
      ++runTokenRef.current
      lastRequestRef.current = null
    }
  }, [scope])

  const execute = useCallback(
    async (request: Request) => {
      lastRequestRef.current = request
      const token = ++runTokenRef.current
      const setView = (next: PluginAiTaskView) => setState({ scope: request.scope, view: next })
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
        const outcome = await runPluginOutcome(
          pluginId,
          request.input,
          request.metadata,
          request.source,
        )
        if (token !== runTokenRef.current) return
        const next = projectOutcome(outcome, 'AI 任务没有返回结果')
        if (next.kind === 'result' && request.reviewInput) {
          const review = validatePluginReview(next.text, request.reviewInput)
          setView(
            review.ok
              ? { ...next, text: review.text }
              : {
                  kind: 'failed',
                  message: review.error,
                  taskId: next.taskId,
                  provenance: next.provenance,
                },
          )
        } else setView(next)
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

  const run = useCallback(
    (
      input: unknown,
      metadata?: Record<string, unknown>,
      source: PluginWorkflowSource = { kind: 'workspace' },
    ) => {
      const projectedInput = projectSemanticTextFields(input)
      const reviewInput = buildGroundedPluginInput(pluginId, projectedInput)
      return execute({ scope, input: reviewInput ?? projectedInput, reviewInput, metadata, source })
    },
    [execute, pluginId, scope],
  )

  const retry = useCallback(() => {
    const request = lastRequestRef.current
    if (!request || request.scope !== scope) return Promise.resolve()
    return execute(request)
  }, [execute, scope])

  return { view, isRunning: view.kind === 'running', run, retry }
}
