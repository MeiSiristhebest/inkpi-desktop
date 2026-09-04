export type ArchetypeCategory = "character_archetype_36" | "mbti_matrix" | "narrative_motif_12" | "conflict_deck"

export interface NarrativeArchetypeRecord {
  id: string
  name: string
  category: ArchetypeCategory
  coreDesire: string
  fatalFlaw: string
  typicalBehaviors: string[]
  foilArchetypeIds: string[]
  conflictPrompt: string
}

export interface ArchetypeRepository {
  getAll(): Promise<NarrativeArchetypeRecord[]>
  getByCategory(category: ArchetypeCategory): Promise<NarrativeArchetypeRecord[]>
  get(id: string): Promise<NarrativeArchetypeRecord | undefined>
  save(record: NarrativeArchetypeRecord): Promise<void>
}
