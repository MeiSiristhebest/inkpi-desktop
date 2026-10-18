import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConflictPanel } from './ConflictPanel'
import type { NarrativeConflict } from '../types'

describe('ConflictPanel', () => {
  it('labels chapter-order conflicts as review prompts and displays available source evidence', () => {
    const conflict: NarrativeConflict = {
      type: 'temporal_paradox',
      nodeIds: ['prerequisite', 'dependent'],
      description: '章节位置不能证明故事时间顺序；请核对正文。',
      severity: 'warning',
      sources: [
        {
          eventTitle: '找到密信',
          sourceDocumentId: 'chapter-4',
          sourceBlockId: 'block-2',
          sourceRevision: 9,
          evidence: [
            {
              documentId: 'chapter-4',
              blockId: 'block-2',
              excerpt: '密信上写着旧王仍在人世。',
              semanticFrom: 20,
              semanticTo: 32,
            },
          ],
        },
      ],
    }

    render(<ConflictPanel conflicts={[conflict]} />)

    expect(screen.getByText('因果顺序需核对')).toBeInTheDocument()
    expect(screen.getByText('章节位置不能证明故事时间顺序；请核对正文。')).toBeInTheDocument()
    expect(screen.getByText('来源：文档 chapter-4 · 段落 block-2 · 修订 9')).toBeInTheDocument()
    expect(screen.getByText('密信上写着旧王仍在人世。')).toBeInTheDocument()
  })

  it('does not claim full narrative consistency when no configured conflicts are found', () => {
    render(<ConflictPanel conflicts={[]} />)

    expect(screen.getByText('当前检查未发现冲突')).toBeInTheDocument()
    expect(screen.getByText('章节位置不能单独验证故事内的时间顺序')).toBeInTheDocument()
  })
})
