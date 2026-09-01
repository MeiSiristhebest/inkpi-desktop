import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { CodexWriterDrawer } from './CodexWriterDrawer'
import { db } from '../../../db/indexedDB'
import type { CodexEntity } from '../types'

describe('CodexWriterDrawer HUD Component', () => {
  const mockEntities: CodexEntity[] = [
    {
      id: 'ent-1',
      projectId: 'p1',
      name: '陈渊',
      aliases: ['渊哥'],
      category: 'character',
      attributes: { realm: '淬体九重' },
      relations: [
        { targetId: 'ent-2', targetName: '青岚宗', relationType: '所属宗门' },
      ],
      summary: '主角，废脉觉醒吞天神体',
      createdAt: 1000,
      updatedAt: 1000,
    },
    {
      id: 'ent-2',
      projectId: 'p1',
      name: '青岚宗',
      aliases: [],
      category: 'faction',
      attributes: {},
      relations: [],
      summary: '云州宗门',
      createdAt: 1000,
      updatedAt: 1000,
    },
  ]

  beforeEach(async () => {
    for (const ent of mockEntities) {
      await db.put('codexEntities', ent)
    }
  })

  it('renders standby state when text has no matched entities', async () => {
    render(<CodexWriterDrawer projectId="p1" currentText="今天风和日丽，鸟语花香。" />)

    await waitFor(() => {
      expect(screen.getByText('活体世界观待命')).toBeInTheDocument()
    })
  })

  it('renders dynamic entity card when text contains matched keyword', async () => {
    render(<CodexWriterDrawer projectId="p1" currentText="渊哥凝视着前方的石碑。" />)

    await waitFor(() => {
      expect(screen.getByText('陈渊')).toBeInTheDocument()
      expect(screen.getByText('主角，废脉觉醒吞天神体')).toBeInTheDocument()
    })

    expect(screen.getByText(/段落激活实体/)).toBeInTheDocument()
  })
})
