import { describe, expect, it } from 'vitest'
import { db } from '../../db/indexedDB'
import type { ChapterRecord } from '../../types'
import type { AiArtifact } from '../artifacts/artifactStore'
import { IndexedDbProposalStore, type AiProposal } from '../proposals/proposalLedger'
import { listWorkspaceProposals, loadWorkspaceResults } from './resultCenter'

const WORKSPACE = 'ws-result-center'
const NEIGHBOUR = 'ws-result-center-neighbour'
const OWN_CHAPTER = 'rc-ch-own'
const NEIGHBOUR_CHAPTER = 'rc-ch-neighbour'
const OWN_PROPOSAL = 'rc-proposal-own'
const NEIGHBOUR_PROPOSAL = 'rc-proposal-neighbour'
const ORPHAN_PROPOSAL = 'rc-proposal-orphan'
const OWN_ARTIFACT = 'rc-artifact-own'
const NEIGHBOUR_ARTIFACT = 'rc-artifact-neighbour'

const proposalStore = new IndexedDbProposalStore()

function chapter(id: string, projectId: string): ChapterRecord {
  return {
    id,
    projectId,
    volumeId: 'rc-volume',
    title: id,
    content: '正文',
    order: 0,
    wordCount: 2,
    createdAt: 1,
    updatedAt: 1,
  }
}

function artifact(overrides: Partial<AiArtifact> = {}): AiArtifact {
  return {
    id: OWN_ARTIFACT,
    taskId: 'rc-task-own',
    kind: 'narrative.continuity.audit',
    type: 'creative.continuity-report',
    version: 1,
    content: '第 2 章的时间线早于第 1 章。',
    provenance: { provider: 'deepseek', model: 'deepseek-chat', latencyMs: 812 },
    createdAt: 1000,
    updatedAt: 1000,
    ownership: { owner: 'desktop', authoritative: true, workspaceId: WORKSPACE },
    documentId: OWN_CHAPTER,
    ...overrides,
  }
}

function proposal(id: string, overrides: Partial<AiProposal> = {}): AiProposal {
  const documentId = overrides.documentId ?? OWN_CHAPTER
  return {
    id,
    taskId: 'rc-task-own',
    documentId,
    baseRevision: 7,
    patches: [{ documentId, from: 12, to: 30, text: '改后文本' }],
    status: 'pending',
    createdAt: 900,
    ...overrides,
  }
}

async function clearFixtures(): Promise<void> {
  for (const id of [OWN_CHAPTER, NEIGHBOUR_CHAPTER]) await db.delete('chapters', id)
  for (const id of [OWN_PROPOSAL, NEIGHBOUR_PROPOSAL, ORPHAN_PROPOSAL]) {
    await db.delete('aiProposals', id)
  }
  for (const id of [OWN_ARTIFACT, NEIGHBOUR_ARTIFACT]) await db.delete('aiArtifacts', id)
}

async function seedWorkspace(): Promise<void> {
  await clearFixtures()
  await db.put('chapters', chapter(OWN_CHAPTER, WORKSPACE))
  await db.put('chapters', chapter(NEIGHBOUR_CHAPTER, NEIGHBOUR))
  await proposalStore.save(proposal(OWN_PROPOSAL, { status: 'accepted', updatedAt: 1200 }))
  await proposalStore.save(
    proposal(NEIGHBOUR_PROPOSAL, {
      taskId: 'rc-task-neighbour',
      documentId: NEIGHBOUR_CHAPTER,
    }),
  )
  // A proposal whose document is no longer in the library has no workspace either.
  await proposalStore.save(
    proposal(ORPHAN_PROPOSAL, { taskId: 'rc-task-orphan', documentId: 'rc-ch-deleted' }),
  )
}

describe('listWorkspaceProposals', () => {
  it('resolves proposal documents to one workspace through the chapter index (INV-03)', async () => {
    await seedWorkspace()

    const ids = (await listWorkspaceProposals(WORKSPACE)).map((item) => item.id)
    expect(ids).toEqual([OWN_PROPOSAL])
    expect((await listWorkspaceProposals(NEIGHBOUR)).map((item) => item.id)).toEqual([
      NEIGHBOUR_PROPOSAL,
    ])

    await clearFixtures()
  })
})

describe('loadWorkspaceResults', () => {
  it('joins the author decision onto the artifact and keeps the workspace scoped', async () => {
    await seedWorkspace()
    await db.put('aiArtifacts', artifact())
    await db.put(
      'aiArtifacts',
      artifact({
        id: NEIGHBOUR_ARTIFACT,
        taskId: 'rc-task-neighbour',
        documentId: NEIGHBOUR_CHAPTER,
        ownership: { owner: 'desktop', authoritative: true, workspaceId: NEIGHBOUR },
      }),
    )
    const stored = await db.getAll<AiArtifact>('aiArtifacts')

    const results = await loadWorkspaceResults(WORKSPACE, stored)

    // The neighbour row is present in the store yet must never surface here.
    expect(results.map((result) => result.id)).toEqual([OWN_ARTIFACT])
    const [result] = results
    expect(result?.status).toBe('accepted')
    expect(result?.proposalId).toBe(OWN_PROPOSAL)
    expect(result?.scope.workspaceId).toBe(WORKSPACE)
    expect(result?.scope.document).toEqual({ id: OWN_CHAPTER, revision: 7 })
    expect(result?.scope.selection).toEqual({ from: 12, to: 30 })
    expect(result?.summary).toBe('第 2 章的时间线早于第 1 章。')
    expect(result?.provenance.provider).toBe('deepseek')
    expect(result?.provenance.sourceRevision).toBe(7)
    // The proposal is the newer fact, so the row sorts by the decision time.
    expect(result?.updatedAt).toBe(1200)

    await clearFixtures()
  })

  it('returns a result awaiting review when no proposal recorded a decision', async () => {
    await seedWorkspace()
    await db.put('aiArtifacts', artifact({ taskId: 'rc-task-undecided' }))

    const results = await loadWorkspaceResults(
      WORKSPACE,
      await db.getAll<AiArtifact>('aiArtifacts'),
    )

    expect(results.map((result) => result.status)).toEqual(['result'])
    expect(results[0]?.proposalId).toBeUndefined()

    await clearFixtures()
  })
})
