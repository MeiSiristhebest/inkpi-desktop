import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AiActivityCenter } from './AiActivityCenter'
import type { TaskRecoveryRecord } from '../../db/taskRecoveryStore'
import type { StandardAiResult } from '../../types/aiResultLifecycle'

function makeResult(overrides: Partial<StandardAiResult> = {}): StandardAiResult {
  return {
    id: 'res-1',
    taskId: 'task-1',
    scope: {
      workspaceId: 'ws-1',
      workspaceRevision: 7,
      document: { id: 'ch-1', revision: 42 },
      selection: { from: 10, to: 40 },
    },
    kind: 'narrative.continuity.audit',
    title: '第1章连续性诊断',
    summary: '发现 2 处潜在时间线冲突',
    status: 'result',
    data: {},
    provenance: { timestamp: 1000 },
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  }
}

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

  it('renders workspace results with their lifecycle status', () => {
    render(
      <AiActivityCenter
        recoveryRecords={[]}
        results={[
          makeResult(),
          makeResult({ id: 'res-2', title: '世界观整理草案', status: 'committed' }),
        ]}
      />,
    )

    expect(screen.getByText(/结果中心/)).toBeInTheDocument()
    expect(screen.getByTestId('activity-result-res-1')).toBeInTheDocument()
    expect(screen.getByTestId('result-status-res-1')).toHaveTextContent('待审阅')
    expect(screen.getByTestId('result-status-res-2')).toHaveTextContent('已落盘')
    expect(screen.getByText('第1章连续性诊断')).toBeInTheDocument()
    expect(screen.getByTestId('result-summary-res-1')).toHaveTextContent(
      '发现 2 处潜在时间线冲突',
    )
  })

  it('redacts credentials in result data', () => {
    render(
      <AiActivityCenter
        recoveryRecords={[]}
        results={[
          makeResult({
            id: 'res-content-1',
            data: {
              finding: '正文内容',
              apiKey: 'do-not-render',
              password: 'do-not-render-password',
            },
          }),
        ]}
      />,
    )

    const content = screen.getByTestId('result-content-res-content-1')
    expect(content).toHaveTextContent('正文内容')
    expect(content).toHaveTextContent('[redacted]')
    expect(content).not.toHaveTextContent('do-not-render')
    expect(content).not.toHaveTextContent('do-not-render-password')
  })

  it('redacts credentials embedded in string result data', () => {
    render(
      <AiActivityCenter
        recoveryRecords={[]}
        results={[
          makeResult({
            id: 'res-string-secret',
            data: 'apiKey=do-not-render Bearer secret-token',
          }),
        ]}
      />,
    )

    const content = screen.getByTestId('result-content-res-string-secret')
    expect(content).toHaveTextContent('apiKey=[redacted]')
    expect(content).toHaveTextContent('Bearer [redacted]')
    expect(content).not.toHaveTextContent('do-not-render')
    expect(content).not.toHaveTextContent('secret-token')
  })

  it('shows provenance, findings and scope details, and toggles them', () => {
    render(
      <AiActivityCenter
        recoveryRecords={[]}
        results={[
          makeResult({
            id: 'res-demo-1',
            proposalId: 'prop-1',
            provenance: {
              provider: 'deepseek',
              model: 'deepseek-chat',
              latencyMs: 812,
              inputTokens: 900,
              outputTokens: 210,
              sourceRevision: 42,
              contextSourcesCount: 3,
              cacheHit: false,
              timestamp: 1000,
            },
            findings: [
              {
                id: 'finding-1',
                title: '时间线冲突',
                description: '第 2 章早于第 1 章',
                severity: 'warning',
                suggestion: '把第 2 章日期后移',
              },
            ],
          }),
        ]}
      />,
    )

    const provenance = screen.getByTestId('result-provenance-res-demo-1')
    expect(provenance).toHaveTextContent('deepseek/deepseek-chat')
    expect(provenance).toHaveTextContent('812ms')
    expect(provenance).toHaveTextContent('900→210 tokens')
    expect(screen.getByTestId('result-findings-res-demo-1')).toHaveTextContent('时间线冲突')
    expect(screen.queryByTestId('result-details-res-demo-1')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /查看范围与溯源/ }))

    const details = screen.getByTestId('result-details-res-demo-1')
    expect(details).toHaveTextContent('任务: task-1')
    expect(details).toHaveTextContent('工作区: ws-1 @r7')
    expect(details).toHaveTextContent('章节: ch-1 @r42')
    expect(details).toHaveTextContent('选区: 10-40')
    expect(details).toHaveTextContent('建议: prop-1')
  })
})
