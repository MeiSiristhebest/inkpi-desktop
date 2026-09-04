export type FactionStance =
  | 'allied'
  | 'friendly'
  | 'neutral'
  | 'hostile'
  | 'mortal_enemy'
  | 'vassal'

export interface FactionDiplomacyRecord {
  id: string
  projectId: string
  factionAId: string
  factionAName: string
  factionBId: string
  factionBName: string
  stance: FactionStance
  reputationScore: number // -100 到 +100
  notes?: string
  updatedAt: number
}

export interface FactionDiplomacyRepository {
  getAll(projectId: string): Promise<FactionDiplomacyRecord[]>
  save(record: FactionDiplomacyRecord): Promise<void>
  delete(id: string): Promise<void>
}
