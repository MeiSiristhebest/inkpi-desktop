import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AiTask, TaskResult } from '@inkpi/protocol'
import type { RoleplaySession } from '../../../domain/roleplay/roleplaySession'
import type { DistillationItem } from '../../../ai/proposals/distillationReviewInbox'
import { distillationReviewInbox } from '../../../ai/proposals/distillationReviewInbox'
import { DesktopPluginHostProvider } from '../../../core/pluginHostContext'
import { roleplaySandboxService } from '../../../services/roleplaySandboxService'
import { RoleplaySandboxView } from './RoleplaySandboxView'

const projectId = 'roleplay-ui-project'

function makeSession(overrides: Partial<RoleplaySession> = {}): RoleplaySession {
  return {
    id: 'roleplay-ui-session',
    schemaVersion: 1,
    projectId,
    title: 'The Glass City',
    scenario: 'A city sealed beneath a glass dome.',
    playerCharacter: 'Mira',
    aiCharacter: 'The Archivist',
    stateNotes: 'The eastern gate is locked.',
    messages: [],
    turnStatus: 'ready',
    revision: 1,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

function roleplayViewTree(
  workspaceId: string,
  onAiTask: (task: AiTask) => Promise<TaskResult | null>,
) {
  return (
    <DesktopPluginHostProvider
      projectId={workspaceId}
      activeChapter={null}
      isAiConnected
      onAiTask={onAiTask}
    >
      <RoleplaySandboxView projectId={workspaceId} />
    </DesktopPluginHostProvider>
  )
}

function mountWithTaskRunner(
  onAiTask: (task: AiTask) => Promise<TaskResult | null>,
  workspaceId = projectId,
) {
  return render(roleplayViewTree(workspaceId, onAiTask))
}

function mockProposalStorage() {
  vi.spyOn(distillationReviewInbox, 'restoreFromStorage').mockResolvedValue()
  vi.spyOn(distillationReviewInbox, 'listPending').mockReturnValue([])
}

afterEach(() => vi.restoreAllMocks())

describe('RoleplaySandboxView', () => {
  it('persists a user turn before AI and submits only isolated sandbox context', async () => {
    const session = makeSession()
    const userMessage = {
      id: 'user-message-1',
      role: 'user' as const,
      text: 'I ask the archivist about the locked gate.',
      createdAt: 2,
    }
    const pending = makeSession({
      messages: [userMessage],
      turnStatus: 'running',
      pendingTurnId: 'roleplay-turn-1',
      revision: 2,
    })
    const completed = makeSession({
      messages: [
        userMessage,
        {
          id: 'assistant-message-1',
          role: 'assistant',
          text: 'The archivist turns a silver key in the lock.',
          createdAt: 3,
        },
      ],
      revision: 3,
      updatedAt: 3,
    })
    let turnWasPersisted = false
    let submittedTask: AiTask | undefined
    const result = {
      status: 'completed',
      output: { format: 'text', text: 'The archivist turns a silver key in the lock.' },
    } as TaskResult
    const onAiTask = vi.fn(async (task: AiTask) => {
      expect(turnWasPersisted).toBe(true)
      submittedTask = task
      return result
    })

    mockProposalStorage()
    vi.spyOn(roleplaySandboxService, 'listSessions').mockResolvedValue([session])
    vi.spyOn(roleplaySandboxService, 'beginTurn').mockImplementation(async () => {
      turnWasPersisted = true
      return pending
    })
    vi.spyOn(roleplaySandboxService, 'completeTurn').mockResolvedValue(completed)

    mountWithTaskRunner(onAiTask)
    await screen.findByText('The Glass City')
    expect(onAiTask).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('输入跑团行动'), {
      target: { value: 'I ask the archivist about the locked gate.' },
    })
    fireEvent.click(screen.getByRole('button', { name: '发送回合' }))

    expect(
      await screen.findByText('The archivist turns a silver key in the lock.'),
    ).toBeInTheDocument()
    expect(onAiTask).toHaveBeenCalledTimes(1)
    expect(submittedTask?.scope?.workspaceId).toBe(projectId)
    expect(submittedTask?.input.documentId).toBe(`roleplay-session:${session.id}`)
    expect(submittedTask?.contextPolicy?.providerIds).toEqual(['creative.conversation-history'])
    expect(submittedTask?.contextPolicy?.includeProjectState).toBe(false)
    expect(JSON.stringify(submittedTask?.input.payload)).not.toContain('chapter-')
  })

  it('keeps roleplay text pending until the author explicitly accepts its proposal', async () => {
    const message = {
      id: 'assistant-message-2',
      role: 'assistant' as const,
      text: 'The gatekeeper offers a bargain in exchange for the silver key.',
      createdAt: 3,
    }
    const session = makeSession({ messages: [message] })
    const proposal: DistillationItem = {
      id: 'roleplay-proposal-1',
      workspaceId: projectId,
      taskId: `roleplay:${session.id}:${message.id}`,
      category: 'event',
      name: 'A bargain at the gate',
      summary: message.text,
      kind: 'roleplay-scene',
      confidence: 1,
      status: 'pending',
      createdAt: 4,
    }
    const onAiTask = vi.fn(async () => null)
    mockProposalStorage()
    vi.spyOn(roleplaySandboxService, 'listSessions').mockResolvedValue([session])
    vi.spyOn(distillationReviewInbox, 'ingestRoleplayEventCandidate').mockResolvedValue(proposal)
    const accept = vi.spyOn(distillationReviewInbox, 'accept').mockResolvedValue()

    mountWithTaskRunner(onAiTask)
    await screen.findByText(message.text)
    fireEvent.click(screen.getByRole('button', { name: '转为待审提案' }))
    fireEvent.click(screen.getByRole('button', { name: '加入提案审查' }))

    expect(await screen.findByRole('heading', { name: /AI 事实提炼审查箱/ })).toBeInTheDocument()
    expect(screen.getByText('A bargain at the gate')).toBeInTheDocument()
    expect(accept).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '采纳' }))
    await waitFor(() => expect(accept).toHaveBeenCalledWith(proposal.id, undefined))
  })

  it('reloads only the selected project’s roleplay sessions after switching projects', async () => {
    const projectASession = makeSession({
      id: 'project-a-session',
      projectId: 'project-a',
      title: 'Project A private run',
    })
    const projectBSession = makeSession({
      id: 'project-b-session',
      projectId: 'project-b',
      title: 'Project B private run',
    })
    const listSessions = vi
      .spyOn(roleplaySandboxService, 'listSessions')
      .mockImplementation(async (workspaceId) =>
        workspaceId === 'project-a' ? [projectASession] : [projectBSession],
      )
    mockProposalStorage()
    const onAiTask = vi.fn(async () => null)
    const view = mountWithTaskRunner(onAiTask, 'project-a')

    expect(await screen.findByText('Project A private run')).toBeDefined()
    view.rerender(roleplayViewTree('project-b', onAiTask))

    expect(await screen.findByText('Project B private run')).toBeDefined()
    expect(screen.queryByText('Project A private run')).toBeNull()
    expect(listSessions).toHaveBeenNthCalledWith(1, 'project-a')
    expect(listSessions).toHaveBeenNthCalledWith(2, 'project-b')
  })
})
