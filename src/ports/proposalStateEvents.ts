import type { ProposalStatus } from '../ai/proposals/proposalLedger'

export interface ProposalEventScope {
  workspaceId: string
  projectId?: string
}

export type ProposalStateEventKind = 'created' | 'updated' | 'conflict'

export interface ProposalStateChangedEvent extends ProposalEventScope {
  proposalId: string
  status: ProposalStatus
  kind: ProposalStateEventKind
  updatedAt?: number
}

type ProposalStateListener = (event: ProposalStateChangedEvent) => void

interface ProposalStateChannel {
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void
  postMessage(message: unknown): void
  unref?: () => void
}

const CHANNEL_NAME = 'inkpi-proposal-state'
const listeners = new Set<ProposalStateListener>()
let channel: ProposalStateChannel | undefined

/**
 * Best-effort cross-context notification for the proposal review surface.
 * Stores remain authoritative; a subscriber must reload the proposal from its
 * configured ProposalStore after receiving an event.
 */
export const proposalStateEvents = {
  publish(event: ProposalStateChangedEvent): void {
    const normalized = normalizeEvent(event)
    if (!normalized) return

    notify(normalized)
    try {
      getChannel()?.postMessage(normalized)
    } catch {
      // BroadcastChannel is optional and must never turn a successful save into
      // a failed proposal operation.
    }
  },

  subscribe(scope: ProposalEventScope, listener: ProposalStateListener): () => void {
    const normalizedScope = normalizeScope(scope)
    if (!normalizedScope) return () => undefined

    const wrapped = (event: ProposalStateChangedEvent) => {
      if (!matchesScope(event, normalizedScope)) return
      listener(event)
    }
    listeners.add(wrapped)
    return () => listeners.delete(wrapped)
  },
}

function notify(event: ProposalStateChangedEvent): void {
  for (const listener of listeners) listener(event)
}

function getChannel(): ProposalStateChannel | undefined {
  if (channel) return channel
  const Constructor = globalThis.BroadcastChannel
  if (typeof Constructor !== 'function') return undefined

  try {
    const next = new Constructor(CHANNEL_NAME)
    next.addEventListener('message', (event: MessageEvent<unknown>) => {
      const normalized = normalizeEvent(event.data)
      if (normalized) notify(normalized)
    })
    ;(next as BroadcastChannel & { unref?: () => void }).unref?.()
    channel = next
    return channel
  } catch {
    return undefined
  }
}

function normalizeScope(scope: ProposalEventScope): ProposalEventScope | undefined {
  if (!scope || typeof scope.workspaceId !== 'string' || !scope.workspaceId.trim()) return undefined
  if (scope.projectId !== undefined && (typeof scope.projectId !== 'string' || !scope.projectId.trim())) {
    return undefined
  }
  return {
    workspaceId: scope.workspaceId.trim(),
    ...(scope.projectId === undefined ? {} : { projectId: scope.projectId.trim() }),
  }
}

function normalizeEvent(value: unknown): ProposalStateChangedEvent | undefined {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as Partial<ProposalStateChangedEvent>
  const scope = normalizeScope(candidate as ProposalEventScope)
  if (!scope || typeof candidate.proposalId !== 'string' || !candidate.proposalId.trim()) return undefined
  if (!isProposalStatus(candidate.status) || !isEventKind(candidate.kind)) return undefined
  if (candidate.updatedAt !== undefined && !Number.isFinite(candidate.updatedAt)) return undefined

  return {
    ...scope,
    proposalId: candidate.proposalId.trim(),
    status: candidate.status,
    kind: candidate.kind,
    ...(candidate.updatedAt === undefined ? {} : { updatedAt: candidate.updatedAt }),
  }
}

function matchesScope(event: ProposalStateChangedEvent, scope: ProposalEventScope): boolean {
  return event.workspaceId === scope.workspaceId &&
    (scope.projectId === undefined || event.projectId === scope.projectId)
}

function isProposalStatus(value: unknown): value is ProposalStatus {
  return value === 'pending' ||
    value === 'accepted' ||
    value === 'rejected' ||
    value === 'stale' ||
    value === 'committed' ||
    value === 'undone'
}

function isEventKind(value: unknown): value is ProposalStateEventKind {
  return value === 'created' || value === 'updated' || value === 'conflict'
}
