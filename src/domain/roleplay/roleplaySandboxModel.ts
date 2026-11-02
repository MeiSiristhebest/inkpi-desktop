import { semanticDocumentFromText } from '../content'
import type { RoleplayMessage, RoleplaySession } from './roleplaySession'
import { createRoleplayTask } from '../../ai/tasks/taskFactories'

export interface RoleplayDraft {
  title: string
  scenario: string
  playerCharacter: string
  aiCharacter: string
  stateNotes: string
}

export const EMPTY_ROLEPLAY_DRAFT: RoleplayDraft = {
  title: '',
  scenario: '',
  playerCharacter: '',
  aiCharacter: '',
  stateNotes: '',
}

export const roleplayDraftFromSession = (sandbox: RoleplaySession): RoleplayDraft => ({
  title: sandbox.title,
  scenario: sandbox.scenario,
  playerCharacter: sandbox.playerCharacter,
  aiCharacter: sandbox.aiCharacter,
  stateNotes: sandbox.stateNotes,
})

export const isRoleplayDraftEqual = (sandbox: RoleplaySession, draft: RoleplayDraft): boolean =>
  sandbox.title === draft.title &&
  sandbox.scenario === draft.scenario &&
  sandbox.playerCharacter === draft.playerCharacter &&
  sandbox.aiCharacter === draft.aiCharacter &&
  sandbox.stateNotes === draft.stateNotes

export function createRoleplayTaskForTurn(sandbox: RoleplaySession, projectId: string) {
  const taskId = sandbox.pendingTurnId
  let latestUserMessage: RoleplayMessage | undefined
  for (const message of sandbox.messages) {
    if (message.role === 'user') latestUserMessage = message
  }
  if (!taskId || !latestUserMessage) throw new Error('Incomplete pending roleplay turn.')
  const context = [
    `跑团标题：${sandbox.title}`,
    `场景设定：${sandbox.scenario}`,
    `玩家角色：${sandbox.playerCharacter}`,
    `AI 角色 / 主持人：${sandbox.aiCharacter}`,
    `沙盒状态笔记：${sandbox.stateNotes}`,
  ]
    .filter((line) => !line.endsWith('：'))
    .join('\n\n')
  const document = semanticDocumentFromText(
    `roleplay-session:${sandbox.id}`,
    context,
    sandbox.revision,
  )
  return createRoleplayTask({
    taskId,
    workspaceId: projectId,
    workspaceRevision: 1,
    document,
    question: latestUserMessage.text,
    conversationHistory: sandbox.messages
      .slice(0, -1)
      .slice(-20)
      .map(({ role, text }) => ({ role, text })),
    metadata: { roleplaySessionId: sandbox.id, roleplayTurnId: taskId },
  })
}
