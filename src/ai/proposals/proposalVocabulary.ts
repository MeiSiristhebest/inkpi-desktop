import type { ProposalStatus } from './proposalLedger'
import { LIFECYCLE_LABELS, lifecycleStatusForProposal } from '../results/standardAiResult'

/**
 * §P2.15 Proposal mutation contract: one vocabulary for every accept/reject
 * surface, so the same word can never mean "only my preview changed" in one
 * plugin and "the manuscript was rewritten" in another.
 */

/** Storage value used by plugin review records (aftermath patches, diff hunks). */
export type PersistedReviewStatus = 'pending' | 'applied' | 'rejected'

/** Durable axis: an accepted record that reached storage is 已落盘, same as a committed proposal. */
export function reviewStatusLabel(status: ProposalStatus | PersistedReviewStatus): string {
  const mapped: ProposalStatus = status === 'applied' ? 'committed' : status
  return LIFECYCLE_LABELS[lifecycleStatusForProposal(mapped)]
}

const PREVIEW_CHOICE_LABELS: Record<PersistedReviewStatus, string> = {
  pending: '待定',
  applied: '纳入预览',
  rejected: '排除',
}

/** Preview axis: this choice re-renders the merged draft and writes nothing. */
export function previewChoiceLabel(resolution: PersistedReviewStatus): string {
  return PREVIEW_CHOICE_LABELS[resolution]
}
