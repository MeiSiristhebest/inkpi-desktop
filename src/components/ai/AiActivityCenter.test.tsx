import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AiActivityCenter } from './AiActivityCenter'
import type { TaskRecoveryRecord } from '../../db/taskRecoveryStore'

describe('AiActivityCenter Component', () => {
  const mockInterruptedRecord: TaskRecoveryRecord = {
    projectId: 'p-1',
    task: {
      id: 'task-1',
      kind: 'narrative.deep.reason',
      input: { text: 'reasoning input' },
    },
    snapshot: {
      taskId: 'task-1',
      kind: 'narrative.deep.reason',
      status: 'interrupted',
      progress: 0.5,
    },
    updatedAt: Date.now(),
  }

  const mockWaitingRecord: TaskRecoveryRecord = {
    projectId: 'p-1',
    task: {
      id: 'task-2',
      kind: 'narrative.project.distill',
      input: {},
    },
    snapshot: {
      taskId: 'task-2',
      kind: 'narrative.project.distill',
      status: 'waiting-user',
      progress: 0.8,
    },
    updatedAt: Date.now(),
  }

  it('renders empty state when no recovery records provided', () => {
    render(<AiActivityCenter recoveryRecords={[]} />)
    expect(screen.getByText('任务执行与活动中心')).toBeInTheDocument()
    expect(screen.getByText('所有后台任务已完成，无挂起活动')).toBeInTheDocument()
  })

  it('renders interrupted task with resume and dismiss buttons', async () => {
    const onResume = vi.fn().mockResolvedValue(true)
    const onDismiss = vi.fn().mockResolvedValue(true)

    render(
      <AiActivityCenter
        recoveryRecords={[mockInterruptedRecord]}
        onResume={onResume}
        onDismiss={onDismiss}
      />,
    )

    expect(screen.getByText('narrative.deep.reason')).toBeInTheDocument()
    expect(screen.getByText('interrupted')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()

    const resumeBtn = screen.getByTitle('恢复任务')
    await fireEvent.click(resumeBtn)
    expect(onResume).toHaveBeenCalledWith('task-1')

    await vi.waitFor(() => {
      expect(screen.getByTitle('忽略/移除')).not.toBeDisabled()
    })

    const dismissBtn = screen.getByTitle('忽略/移除')
    await fireEvent.click(dismissBtn)
    expect(onDismiss).toHaveBeenCalledWith('task-1')
  })

  it('renders waiting-user task with steering input and handles steering submission', () => {
    const onSteer = vi.fn().mockResolvedValue(true)

    render(<AiActivityCenter recoveryRecords={[mockWaitingRecord]} onSteer={onSteer} />)

    expect(screen.getByText('waiting-user')).toBeInTheDocument()
    const input = screen.getByPlaceholderText('输入修正方向或指令…')
    fireEvent.change(input, { target: { value: '重点关注宗门背景' } })

    const steerBtn = screen.getByRole('button', { name: '引导' })
    fireEvent.click(steerBtn)

    expect(onSteer).toHaveBeenCalledWith('task-2', { direction: '重点关注宗门背景' })
  })

  it('renders recent results when provided', () => {
    render(
      <AiActivityCenter
        recoveryRecords={[]}
        recentResults={[
          {
            id: 'res-1',
            kind: 'continuity',
            title: '第1章连续性诊断',
            summary: '发现 2 处潜在时间线冲突',
            completedAt: Date.now(),
            status: 'completed',
          },
        ]}
      />,
    )

    expect(screen.getByText(/产物与已完成结果/)).toBeInTheDocument()
    expect(screen.getByText('第1章连续性诊断')).toBeInTheDocument()
    expect(screen.getByText('发现 2 处潜在时间线冲突')).toBeInTheDocument()
  })

  it('renders artifacts and toggles Advanced details', () => {
    render(
      <AiActivityCenter
        recoveryRecords={[]}
        artifacts={[
          {
            id: 'art-demo-1',
            taskId: 'task-audit-1',
            kind: 'audit-report',
            type: 'creative.audit-report',
            version: 2,
            content: {},
            provenance: { sourceRevision: 42 },
            ownership: { owner: 'desktop', authoritative: true, workspaceId: 'ws-demo' },
            createdAt: 1000,
            updatedAt: 1000,
          },
        ]}
      />,
    )

    expect(screen.getByText('creative.audit-report')).toBeInTheDocument()
    expect(screen.getByText('v2 · 08:00:01')).toBeInTheDocument()

    const toggleBtn = screen.getByRole('button', { name: /查看溯源详情/ })
    fireEvent.click(toggleBtn)

    expect(screen.getByTestId('artifact-details-art-demo-1')).toBeInTheDocument()
    expect(screen.getByText('Task ID: task-audit-1')).toBeInTheDocument()
    expect(screen.getByText('Workspace: ws-demo')).toBeInTheDocument()
    expect(screen.getByText('Source Rev: 42')).toBeInTheDocument()
  })
})
