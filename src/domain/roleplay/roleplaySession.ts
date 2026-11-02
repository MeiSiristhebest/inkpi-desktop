export const ROLEPLAY_SESSION_SCHEMA_VERSION = 1 as const

export type RoleplayMessageRole = 'user' | 'assistant'
export type RoleplayTurnStatus = 'ready' | 'running' | 'interrupted' | 'failed'

export interface RoleplayMessage {
  id: string
  role: RoleplayMessageRole
  text: string
  createdAt: number
}

/** Recoverable, project-scoped sandbox data. It is deliberately not a canonical story record. */
export interface RoleplaySession {
  id: string
  schemaVersion: typeof ROLEPLAY_SESSION_SCHEMA_VERSION
  projectId: string
  title: string
  scenario: string
  playerCharacter: string
  aiCharacter: string
  stateNotes: string
  messages: RoleplayMessage[]
  turnStatus: RoleplayTurnStatus
  pendingTurnId?: string
  lastError?: string
  revision: number
  createdAt: number
  updatedAt: number
}

export function cloneRoleplaySession(sandbox: RoleplaySession): RoleplaySession {
  return {
    ...sandbox,
    messages: sandbox.messages.map((message) => ({ ...message })),
  }
}

export function assertRoleplaySession(value: unknown): asserts value is RoleplaySession {
  if (!isRecord(value)) throw new TypeError('Roleplay session must be an object.')
  if (typeof value.id !== 'string' || !value.id.trim()) {
    throw new TypeError('Roleplay session id is required.')
  }
  if (typeof value.projectId !== 'string' || !value.projectId.trim()) {
    throw new TypeError('Roleplay session projectId is required.')
  }
  if (value.schemaVersion !== ROLEPLAY_SESSION_SCHEMA_VERSION) {
    throw new TypeError('Unsupported roleplay session schema version.')
  }
  for (const field of [
    'title',
    'scenario',
    'playerCharacter',
    'aiCharacter',
    'stateNotes',
  ] as const) {
    if (typeof value[field] !== 'string') {
      throw new TypeError(`Roleplay session ${field} must be text.`)
    }
  }
  if (!Array.isArray(value.messages))
    throw new TypeError('Roleplay session messages must be an array.')
  for (const message of value.messages) {
    if (
      !isRecord(message) ||
      typeof message.id !== 'string' ||
      (message.role !== 'user' && message.role !== 'assistant') ||
      typeof message.text !== 'string' ||
      !Number.isFinite(message.createdAt)
    ) {
      throw new TypeError('Roleplay session contains an invalid message.')
    }
  }
  if (!['ready', 'running', 'interrupted', 'failed'].includes(String(value.turnStatus))) {
    throw new TypeError('Roleplay session turn status is invalid.')
  }
  if (value.pendingTurnId !== undefined && typeof value.pendingTurnId !== 'string') {
    throw new TypeError('Roleplay session pending turn id is invalid.')
  }
  if (!Number.isSafeInteger(value.revision) || (value.revision as number) < 0) {
    throw new TypeError('Roleplay session revision is invalid.')
  }
  if (!Number.isFinite(value.createdAt) || !Number.isFinite(value.updatedAt)) {
    throw new TypeError('Roleplay session timestamps are invalid.')
  }
  if (value.lastError !== undefined && typeof value.lastError !== 'string') {
    throw new TypeError('Roleplay session error must be text.')
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
