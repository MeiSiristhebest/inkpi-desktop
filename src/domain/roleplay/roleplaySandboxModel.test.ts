import { describe, expect, it } from 'vitest'
import type { RoleplayMessage, RoleplaySession } from './roleplaySession'
import { createRoleplayTaskForTurn } from './roleplaySandboxModel'

function message(id: number, role: RoleplayMessage['role']): RoleplayMessage {
  return { id: `message-${id}`, role, text: `turn ${id}`, createdAt: id }
}

function session(messages: RoleplayMessage[]): RoleplaySession {
  return {
    id: 'sandbox-session-1',
    schemaVersion: 1,
    projectId: 'project-1',
    title: 'Glass City',
    scenario: 'A city under a glass dome.',
    playerCharacter: 'Mira',
    aiCharacter: 'The Archivist',
    stateNotes: 'The east gate is sealed.',
    messages,
    turnStatus: 'running',
    pendingTurnId: 'roleplay-turn-1',
    revision: 5,
    createdAt: 1,
    updatedAt: 5,
  }
}

describe('createRoleplayTaskForTurn', () => {
  it('uses the sandbox document and bounds conversation history to the latest twenty prior messages', () => {
    const messages = Array.from({ length: 24 }, (_, index) =>
      message(index, index % 2 === 0 ? 'user' : 'assistant'),
    )
    const currentPrompt = message(24, 'user')
    const task = createRoleplayTaskForTurn(session([...messages, currentPrompt]), 'project-1')
    const payload = task.input.payload as Record<string, unknown>
    const history = payload.conversationHistory as Array<{ role: string; text: string }>

    expect(payload.question).toBe('turn 24')
    expect(history).toHaveLength(20)
    expect(history[0]?.text).toBe('turn 4')
    expect(history[history.length - 1]?.text).toBe('turn 23')
    expect(task.input.documentId).toBe('roleplay-session:sandbox-session-1')
    expect(task.contextPolicy?.providerIds).toEqual(['creative.conversation-history'])
    expect(task.contextPolicy?.includeProjectState).toBe(false)
    expect(JSON.stringify(task)).toContain('A city under a glass dome.')
    expect(JSON.stringify(task)).not.toContain('chapter title')
  })
})
