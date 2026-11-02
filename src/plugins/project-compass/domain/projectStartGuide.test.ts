import { describe, expect, it } from 'vitest'
import type { ChapterRecord, ProjectRecord, VolumeRecord } from '../../../types'
import {
  deriveProjectStartSuggestions,
  emptyProjectStartGuideState,
  parseProjectStartGuideState,
} from './projectStartGuide'

const project: ProjectRecord = {
  id: 'project-1',
  name: '雾港',
  createdAt: 1,
  updatedAt: 1,
}

const volume: VolumeRecord = {
  id: 'volume-1',
  projectId: 'project-1',
  title: '第一卷',
  order: 1,
  createdAt: 1,
  updatedAt: 1,
}

const chapter: ChapterRecord = {
  id: 'chapter-1',
  projectId: 'project-1',
  volumeId: 'volume-1',
  title: '雾中来客',
  content: '',
  wordCount: 0,
  order: 1,
  createdAt: 1,
  updatedAt: 1,
}

describe('project start guide domain', () => {
  it('derives actionable setup suggestions from the project’s existing records', () => {
    const suggestions = deriveProjectStartSuggestions({
      projectId: 'project-1',
      project,
      volumes: [],
      chapters: [],
      positioningData: {},
      worldbaseData: {},
    })

    expect(suggestions.map(({ id, targetView }) => [id, targetView])).toEqual([
      ['project-positioning', 'positioning'],
      ['world-setting', 'worldbase'],
      ['first-volume', 'chapter-master'],
      ['first-chapter', 'editor'],
    ])
  })

  it('omits suggestions when project metadata, forms, and writing structure already exist', () => {
    const suggestions = deriveProjectStartSuggestions({
      projectId: 'project-1',
      project: { ...project, genre: '都市奇幻' },
      volumes: [volume],
      chapters: [chapter],
      positioningData: {},
      worldbaseData: { 世界名称: '雾港' },
    })

    expect(suggestions).toEqual([])
  })

  it('does not count another project’s volumes or chapters as setup', () => {
    const suggestions = deriveProjectStartSuggestions({
      projectId: 'project-1',
      project,
      volumes: [{ ...volume, projectId: 'project-2' }],
      chapters: [{ ...chapter, projectId: 'project-2' }],
      positioningData: { 类型赛道: '都市奇幻' },
      worldbaseData: { 世界名称: '雾港' },
    })

    expect(suggestions.map(({ id }) => id)).toEqual(['first-volume', 'first-chapter'])
  })

  it('parses only supported project-scoped deferral and ignore states', () => {
    expect(
      parseProjectStartGuideState({
        version: 1,
        dispositions: {
          'project-positioning': 'deferred',
          'first-chapter': 'ignored',
          unknown: 'ignored',
          'world-setting': 'completed',
        },
      }),
    ).toEqual({
      version: 1,
      dispositions: {
        'project-positioning': 'deferred',
        'first-chapter': 'ignored',
      },
    })
    expect(parseProjectStartGuideState({ version: 0, dispositions: {} })).toEqual(
      emptyProjectStartGuideState(),
    )
  })
})
