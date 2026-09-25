import { describe, expect, it } from 'vitest'
import type { AiArtifact } from '../artifacts/artifactStore'
import type { AiProposal, ProposalStatus } from '../proposals/proposalLedger'
import {
  humanizeTaskKind,
  lifecycleStatusForProposal,
  projectArtifactToStandardAiResult,
  projectWorkspaceResults,
} from './standardAiResult'

function artifact(overrides: Partial<AiArtifact> = {}): AiArtifact {
  return {
    id: 'artifact-1',
    taskId: 'task-1',
    kind: 'plugin.emotion-curve.analysis',
    type: 'creative.emotion-curve',
    version: 1,
    content: '情绪曲线整体上扬，第 3 章节奏偏平。',
    provenance: {},
    createdAt: 1000,
    updatedAt: 1000,
    ownership: { owner: 'desktop', authoritative: true, workspaceId: 'ws-1' },
    ...overrides,
  }
}

function proposal(overrides: Partial<AiProposal> = {}): AiProposal {
  return {
    id: 'proposal-1',
    taskId: 'task-1',
    documentId: 'ch-1',
    baseRevision: 7,
    patches: [{ documentId: 'ch-1', from: 12, to: 30, text: '改后文本' }],
    status: 'pending',
    createdAt: 900,
    ...overrides,
  }
}

describe('lifecycleStatusForProposal', () => {
  it('maps every proposal status onto the result lifecycle', () => {
    const cases: Array<[ProposalStatus | undefined, string]> = [
      [undefined, 'result'],
      ['pending', 'result'],
      ['stale', 'result'],
      ['accepted', 'accepted'],
      ['committed', 'committed'],
      ['rejected', 'dismissed'],
      ['undone', 'undone'],
    ]
    expect(cases.map(([status]) => lifecycleStatusForProposal(status))).toEqual(
      cases.map(([, expected]) => expected),
    )
  })
})

describe('projectArtifactToStandardAiResult', () => {
  it('drops an artifact that belongs to no workspace (INV-03)', () => {
    expect(
      projectArtifactToStandardAiResult(
        artifact({ ownership: undefined, metadata: { workspaceId: '  ' } }),
      ),
    ).toBeUndefined()
  })

  it('falls back to metadata for the workspace when ownership omits it', () => {
    const result = projectArtifactToStandardAiResult(
      artifact({
        ownership: { owner: 'desktop', authoritative: true },
        metadata: { workspaceId: 'ws-meta' },
      }),
    )
    expect(result?.scope.workspaceId).toBe('ws-meta')
  })

  it('titles a result from metadata, otherwise from the task kind', () => {
    expect(
      projectArtifactToStandardAiResult(artifact({ metadata: { title: '第三章情绪' } }))?.title,
    ).toBe('第三章情绪')
    expect(projectArtifactToStandardAiResult(artifact())?.title).toBe('emotion curve analysis')
    expect(humanizeTaskKind('narrative.continuity.audit')).toBe('一致性体检')
  })

  it('summarizes text, structured summary and overlong content', () => {
    expect(projectArtifactToStandardAiResult(artifact())?.summary).toBe(
      '情绪曲线整体上扬，第 3 章节奏偏平。',
    )
    expect(
      projectArtifactToStandardAiResult(
        artifact({ content: { summary: '结构化摘要\n第二行不进摘要' } }),
      )?.summary,
    ).toBe('结构化摘要')
    const long = '字'.repeat(200)
    const summary = projectArtifactToStandardAiResult(artifact({ content: long }))?.summary ?? ''
    expect(summary).toHaveLength(158)
    expect(summary.endsWith('…')).toBe(true)
    expect(projectArtifactToStandardAiResult(artifact({ content: { other: 1 } }))?.summary).toBe('')
  })

  it('carries model provenance through to the result', () => {
    const result = projectArtifactToStandardAiResult(
      artifact({
        provenance: {
          provider: 'deepseek',
          model: 'deepseek-chat',
          latencyMs: 812,
          usage: { inputTokens: 900, outputTokens: 120 },
          contextSources: ['chapter', 'codex', 'journal'],
          cacheHit: true,
        },
      }),
    )
    expect(result?.provenance).toEqual({
      provider: 'deepseek',
      model: 'deepseek-chat',
      latencyMs: 812,
      inputTokens: 900,
      outputTokens: 120,
      sourceRevision: undefined,
      contextSourcesCount: 3,
      cacheHit: true,
      timestamp: 1000,
    })
  })

  it('leaves model fields absent for a locally produced result', () => {
    const result = projectArtifactToStandardAiResult(artifact({ provenance: {} }))
    expect(result?.provenance.provider).toBeUndefined()
    expect(result?.provenance.model).toBeUndefined()
    expect(result?.provenance.sourceRevision).toBeUndefined()
  })

  it('scopes the result to the proposal document and patch range', () => {
    const result = projectArtifactToStandardAiResult(
      artifact({ provenance: { projectRevision: 4 } }),
      proposal(),
    )
    expect(result?.scope).toEqual({
      workspaceId: 'ws-1',
      workspaceRevision: 4,
      document: { id: 'ch-1', revision: 7 },
      selection: { from: 12, to: 30 },
    })
    expect(result?.proposalId).toBe('proposal-1')
    expect(result?.status).toBe('result')
    expect(result?.updatedAt).toBe(1000)
  })

  it('uses the proposal revision when the producer recorded none', () => {
    const result = projectArtifactToStandardAiResult(
      artifact({ provenance: { sourceRevision: 5 }, documentId: 'ch-9' }),
      proposal({ documentId: 'ch-9', baseRevision: 11 }),
    )
    expect(result?.scope.document).toEqual({ id: 'ch-9', revision: 11 })
    expect(result?.provenance.sourceRevision).toBe(11)
  })

  it('reads findings from proposal evidence', () => {
    const result = projectArtifactToStandardAiResult(
      artifact(),
      proposal({
        evidence: [
          {
            documentId: 'ch-1',
            blockId: 'b-2',
            excerpt: '他顿时愣住',
            semanticFrom: 40,
            semanticTo: 45,
          },
        ],
      }),
    )
    expect(result?.findings).toEqual([
      {
        id: 'proposal-1-e0',
        title: 'b-2',
        description: '他顿时愣住',
        location: { chapterId: 'ch-1', from: 40, to: 45 },
      },
    ])
  })

  it('omits findings and proposal id for a result nobody has acted on', () => {
    const result = projectArtifactToStandardAiResult(artifact())
    expect(result?.findings).toBeUndefined()
    expect(result?.proposalId).toBeUndefined()
  })
})

describe('projectWorkspaceResults', () => {
  it('joins on task id, keeps the newest proposal, and orders newest result first', () => {
    const results = projectWorkspaceResults(
      [
        artifact({ id: 'a-old', taskId: 'task-9', createdAt: 500, updatedAt: 500 }),
        artifact({ id: 'a-new', taskId: 'task-1', createdAt: 2000, updatedAt: 2000 }),
        artifact({ id: 'a-loose', taskId: 'task-loose', createdAt: 1500, updatedAt: 1500 }),
      ],
      [
        proposal({ id: 'p-stale', taskId: 'task-1', status: 'accepted', updatedAt: 2100 }),
        proposal({ id: 'p-latest', taskId: 'task-1', status: 'committed', updatedAt: 2400 }),
        proposal({ id: 'p-pending', taskId: 'task-loose', status: 'rejected', updatedAt: 1600 }),
      ],
    )
    expect(results.map((result) => result.id)).toEqual(['a-new', 'a-loose', 'a-old'])
    expect(results[0]).toMatchObject({ status: 'committed', proposalId: 'p-latest' })
    expect(results[1]).toMatchObject({ status: 'dismissed', proposalId: 'p-pending' })
    expect(results[2]).toMatchObject({ status: 'result' })
  })

  it('excludes artifacts that carry no workspace', () => {
    const results = projectWorkspaceResults(
      [artifact({ id: 'scoped' }), artifact({ id: 'unscoped', ownership: undefined })],
      [],
    )
    expect(results.map((result) => result.id)).toEqual(['scoped'])
  })
})
