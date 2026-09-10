import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AiTask } from '@inkpi/protocol'
import { TaskRecoveryPanel } from './TaskRecoveryPanel'

const makeRecord = (id: string, status: 'interrupted' | 'running' | 'failed') => {
  const task: AiTask = {
    id,
    kind: 'creative.continue',
    input: { documentId: `chapter-${id}`, text: '片段' },
  }
  return {
    projectId: 'panel-project',
    task,
    snapshot: {
      taskId: id,
      kind: task.kind,
      status,
      ...(status === 'interrupted' ? { checkpoint: { step: 'chapter-2', updatedAt: 12 } } : {}),
      ...(status === 'failed' ? { error: { code: 'provider', message: 'provider failed' } } : {}),
    },
    updatedAt: 12,
  }
}

describe('TaskRecoveryPanel', () => {
  it('shows restart, failure and active cancellation states with their actions', () => {
    const onResume = vi.fn(async () => true)
    const onCancel = vi.fn(async () => true)
    const onDismiss = vi.fn(async () => true)
    render(
      <TaskRecoveryPanel
        records={[makeRecord('restart-task', 'interrupted'), makeRecord('failed-task', 'failed'), makeRecord('running-task', 'running')]}
        onResume={onResume}
        onCancel={onCancel}
        onDismiss={onDismiss}
      />,
    )

    expect(screen.getByTestId('task-status-restart-task')).toHaveTextContent('已中断，可恢复')
    expect(screen.getByTestId('task-recovery-restart-task')).toHaveTextContent('检查点：chapter-2')
    expect(screen.getByTestId('task-status-failed-task')).toHaveTextContent('失败')
    expect(screen.getByTestId('task-recovery-failed-task')).toHaveTextContent('provider failed')
    expect(screen.getByTestId('task-status-running-task')).toHaveTextContent('运行中')

    fireEvent.click(screen.getByTestId('task-recovery-restart-task').querySelector('button') as HTMLButtonElement)
    fireEvent.click(screen.getByTestId('task-recovery-running-task').querySelector('button') as HTMLButtonElement)

    expect(onResume).toHaveBeenCalledWith('restart-task')
    expect(onCancel).toHaveBeenCalledWith('running-task')
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('renders storage errors even when there are no task records', () => {
    render(
      <TaskRecoveryPanel
        records={[]}
        error="IndexedDB unavailable"
        onResume={vi.fn(async () => true)}
        onCancel={vi.fn(async () => true)}
        onDismiss={vi.fn(async () => true)}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('IndexedDB unavailable')
  })
})
