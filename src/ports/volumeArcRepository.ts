export type ActStage = 'act1_intro' | 'act2_rising' | 'act3_climax' | 'act4_fallout'

export interface VolumeArcRecord {
  id: string
  projectId: string
  volumeId: string
  volumeTitle: string
  volumeOrder: number
  targetWordCount: number
  coreConflict: string
  climaxNode: string
  rewardOutcome: string
  crossVolumeCliffhanger: string
  actStage: ActStage
  updatedAt: number
}

export interface VolumeArcRepository {
  getAll(projectId: string): Promise<VolumeArcRecord[]>
  getByVolumeId(projectId: string, volumeId: string): Promise<VolumeArcRecord | undefined>
  save(record: VolumeArcRecord): Promise<void>
  delete(id: string): Promise<void>
}
