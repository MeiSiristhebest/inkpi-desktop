import { indexedDbRoleplaySessionRepository } from '../adapters/indexedDbRoleplaySessionRepository'
import { clock } from '../adapters/clock'
import { idGenerator } from '../adapters/idGenerator'
import {
  assertRoleplaySession,
  cloneRoleplaySession,
  ROLEPLAY_SESSION_SCHEMA_VERSION,
  type RoleplayMessage,
  type RoleplaySession,
} from '../domain/roleplay/roleplaySession'
import type { Clock } from '../ports/clock'
import type { IdGenerator } from '../ports/idGenerator'
import type { RoleplaySessionRepository } from '../ports/roleplaySessionRepository'

export interface RoleplaySandboxServiceDependencies {
  sessions: RoleplaySessionRepository
  ids: IdGenerator
  clock: Clock
}

export class RoleplaySandboxService {
  private readonly dependencies: RoleplaySandboxServiceDependencies

  constructor(dependencies: RoleplaySandboxServiceDependencies) {
    this.dependencies = dependencies
  }

  async listSessions(projectId: string): Promise<RoleplaySession[]> {
    const stored = await this.dependencies.sessions.listByProject(projectId)
    const recovered: RoleplaySession[] = []
    for (const sandbox of stored) {
      assertRoleplaySession(sandbox)
      if (sandbox.projectId !== projectId) continue
      if (sandbox.turnStatus === 'running') {
        const interrupted: RoleplaySession = {
          ...sandbox,
          turnStatus: 'interrupted',
          lastError: '上一轮请求未完成；你可以重试，或明确放弃该轮。',
          revision: sandbox.revision + 1,
          updatedAt: this.dependencies.clock.now(),
        }
        await this.saveSession(interrupted)
        recovered.push(interrupted)
      } else {
        recovered.push(cloneRoleplaySession(sandbox))
      }
    }
    return recovered.sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
  }

  async createSession(projectId: string): Promise<RoleplaySession> {
    if (!projectId.trim()) throw new TypeError('Project id is required.')
    const now = this.dependencies.clock.now()
    const sandbox: RoleplaySession = {
      id: this.dependencies.ids.generate('roleplay'),
      schemaVersion: ROLEPLAY_SESSION_SCHEMA_VERSION,
      projectId,
      title: '新跑团',
      scenario: '',
      playerCharacter: '',
      aiCharacter: '',
      stateNotes: '',
      messages: [],
      turnStatus: 'ready',
      revision: 0,
      createdAt: now,
      updatedAt: now,
    }
    await this.saveSession(sandbox)
    return cloneRoleplaySession(sandbox)
  }

  async saveSession(sandbox: RoleplaySession): Promise<void> {
    assertRoleplaySession(sandbox)
    const existing = await this.dependencies.sessions.get(sandbox.id)
    if (existing && existing.projectId !== sandbox.projectId) {
      throw new Error('Roleplay session belongs to another project.')
    }
    await this.dependencies.sessions.save(cloneRoleplaySession(sandbox))
  }

  async beginTurn(projectId: string, sessionId: string, text: string): Promise<RoleplaySession> {
    const sandbox = await this.requireSession(projectId, sessionId)
    if (sandbox.turnStatus !== 'ready') {
      throw new Error('Retry or explicitly skip the unfinished roleplay turn first.')
    }
    if (!text.trim()) throw new TypeError('Roleplay prompt must not be empty.')
    const message: RoleplayMessage = {
      id: this.dependencies.ids.generate('roleplay-message'),
      role: 'user',
      text,
      createdAt: this.dependencies.clock.now(),
    }
    const next: RoleplaySession = {
      ...sandbox,
      messages: [...sandbox.messages, message],
      turnStatus: 'running',
      pendingTurnId: this.dependencies.ids.generate('roleplay-turn'),
      lastError: undefined,
      revision: sandbox.revision + 1,
      updatedAt: this.dependencies.clock.now(),
    }
    await this.saveSession(next)
    return cloneRoleplaySession(next)
  }

  async retryPendingTurn(projectId: string, sessionId: string): Promise<RoleplaySession> {
    const sandbox = await this.requireSession(projectId, sessionId)
    if (
      (sandbox.turnStatus !== 'failed' && sandbox.turnStatus !== 'interrupted') ||
      !sandbox.pendingTurnId ||
      sandbox.messages[sandbox.messages.length - 1]?.role !== 'user'
    ) {
      throw new Error('There is no unfinished roleplay turn to retry.')
    }
    const next: RoleplaySession = {
      ...sandbox,
      turnStatus: 'running',
      lastError: undefined,
      revision: sandbox.revision + 1,
      updatedAt: this.dependencies.clock.now(),
    }
    await this.saveSession(next)
    return cloneRoleplaySession(next)
  }

  async completeTurn(
    projectId: string,
    sessionId: string,
    taskId: string,
    text: string,
  ): Promise<RoleplaySession> {
    const sandbox = await this.requireSession(projectId, sessionId)
    if (sandbox.turnStatus !== 'running' || sandbox.pendingTurnId !== taskId) {
      throw new Error('The roleplay turn changed before the response could be saved.')
    }
    if (!text.trim()) throw new TypeError('Roleplay response must not be empty.')
    const message: RoleplayMessage = {
      id: this.dependencies.ids.generate('roleplay-message'),
      role: 'assistant',
      text,
      createdAt: this.dependencies.clock.now(),
    }
    const next: RoleplaySession = {
      ...sandbox,
      messages: [...sandbox.messages, message],
      turnStatus: 'ready',
      pendingTurnId: undefined,
      lastError: undefined,
      revision: sandbox.revision + 1,
      updatedAt: this.dependencies.clock.now(),
    }
    await this.saveSession(next)
    return cloneRoleplaySession(next)
  }

  async failTurn(projectId: string, sessionId: string, taskId: string): Promise<RoleplaySession> {
    const sandbox = await this.requireSession(projectId, sessionId)
    if (sandbox.turnStatus !== 'running' || sandbox.pendingTurnId !== taskId) {
      throw new Error('The roleplay turn changed before the failure could be saved.')
    }
    const next: RoleplaySession = {
      ...sandbox,
      turnStatus: 'failed',
      lastError: '本轮生成未完成；对话已保留，你可以重试或放弃该轮。',
      revision: sandbox.revision + 1,
      updatedAt: this.dependencies.clock.now(),
    }
    await this.saveSession(next)
    return cloneRoleplaySession(next)
  }

  async abandonPendingTurn(projectId: string, sessionId: string): Promise<RoleplaySession> {
    const sandbox = await this.requireSession(projectId, sessionId)
    if (
      (sandbox.turnStatus !== 'failed' && sandbox.turnStatus !== 'interrupted') ||
      !sandbox.pendingTurnId
    ) {
      throw new Error('There is no failed or interrupted roleplay turn to skip.')
    }
    const next: RoleplaySession = {
      ...sandbox,
      turnStatus: 'ready',
      pendingTurnId: undefined,
      lastError: undefined,
      revision: sandbox.revision + 1,
      updatedAt: this.dependencies.clock.now(),
    }
    await this.saveSession(next)
    return cloneRoleplaySession(next)
  }

  async deleteSession(projectId: string, sessionId: string): Promise<void> {
    const sandbox = await this.dependencies.sessions.get(sessionId)
    if (!sandbox || sandbox.projectId !== projectId) return
    await this.dependencies.sessions.delete(sessionId)
  }

  private async requireSession(projectId: string, sessionId: string): Promise<RoleplaySession> {
    const sandbox = await this.dependencies.sessions.get(sessionId)
    if (!sandbox || sandbox.projectId !== projectId) {
      throw new Error('Roleplay session not found in this project.')
    }
    assertRoleplaySession(sandbox)
    return cloneRoleplaySession(sandbox)
  }
}

export const roleplaySandboxService = new RoleplaySandboxService({
  sessions: indexedDbRoleplaySessionRepository,
  ids: idGenerator,
  clock,
})
