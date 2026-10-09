import { describe, expect, it } from 'vitest'
import type { PovSnapshotRecord } from '../../ports/povGuardRepository'
import { findPovConfiguration, povProjectConfigRecordId } from './config'

const record = (id: string, updatedAt: number): PovSnapshotRecord => ({
  id,
  projectId: 'project-1',
  chapterId: 'chapter-1',
  chapterOrder: 1,
  povCharacterId: 'character-1',
  povCharacterName: '林凡',
  povMode: 'third_limited',
  allowedCharacters: [{ characterId: 'character-1', characterName: '林凡', knownSecretIds: [] }],
  secrets: [],
  headHoppingViolationsCount: 0,
  omniscienceLeaksCount: 0,
  updatedAt,
})

describe('POV configuration selection', () => {
  it('prefers the project configuration record over chapter snapshots', () => {
    const projectConfig = record(povProjectConfigRecordId('project-1'), 1)
    const chapterSnapshot = record('chapter-snapshot', 99)

    expect(findPovConfiguration([chapterSnapshot, projectConfig], 'project-1')).toBe(projectConfig)
  })

  it('uses the newest configured snapshot when no project record exists', () => {
    const older = record('older', 1)
    const newer = record('newer', 2)

    expect(findPovConfiguration([newer, older], 'project-1')).toBe(newer)
  })

  it('does not fall back to an old snapshot when a saved project record is empty', () => {
    const emptyProjectConfig = {
      ...record(povProjectConfigRecordId('project-1'), 2),
      allowedCharacters: [],
    }
    const older = record('older', 1)

    expect(findPovConfiguration([older, emptyProjectConfig], 'project-1')).toBeUndefined()
  })
})
