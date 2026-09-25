import { db } from '../../db/indexedDB'
import type { AiArtifact } from '../artifacts/artifactStore'
import { IndexedDbProposalStore, type AiProposal } from '../proposals/proposalLedger'
import { artifactWorkspaceId, projectWorkspaceResults } from './standardAiResult'
import type { StandardAiResult } from '../../types/aiResultLifecycle'

const proposalStore = new IndexedDbProposalStore()

/**
 * Proposals are keyed by document rather than workspace, so scoping them to a
 * project goes through the chapter index (INV-03).
 */
export async function listWorkspaceProposals(workspaceId: string): Promise<AiProposal[]> {
  const chapters = await db.getByIndex<{ id: string }>('chapters', 'projectId', workspaceId)
  const documentIds = new Set(chapters.map((chapter) => chapter.id))
  const proposals = await proposalStore.list()
  return proposals.filter((proposal) => documentIds.has(proposal.documentId))
}

/**
 * The Result Center read model: one row per AI result in this workspace.
 * Artifacts are filtered by their own workspace as well, so a store that hands
 * back a wider list can never leak another project's results (INV-03).
 */
export async function loadWorkspaceResults(
  workspaceId: string,
  artifacts: readonly AiArtifact[],
): Promise<StandardAiResult[]> {
  const scoped = artifacts.filter((artifact) => artifactWorkspaceId(artifact) === workspaceId)
  return projectWorkspaceResults(scoped, await listWorkspaceProposals(workspaceId))
}
