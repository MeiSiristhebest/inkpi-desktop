import type { PovSnapshotRecord } from '../../ports/povGuardRepository'

export const POV_PROJECT_CONFIG_CHAPTER_ID = '__project_pov_config__'

export const povProjectConfigRecordId = (projectId: string) => `pov-config:${projectId}`

export function findPovConfiguration(
  records: readonly PovSnapshotRecord[],
  projectId: string,
): PovSnapshotRecord | undefined {
  const projectConfig = records.find((record) => record.id === povProjectConfigRecordId(projectId))
  if (projectConfig) {
    return projectConfig.allowedCharacters.length > 0 ? projectConfig : undefined
  }

  return [...records]
    .filter((record) => record.allowedCharacters.length > 0)
    .sort((left, right) => right.updatedAt - left.updatedAt)[0]
}
