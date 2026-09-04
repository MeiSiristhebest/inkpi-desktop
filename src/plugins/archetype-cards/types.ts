import type {
  ArchetypeCategory,
  NarrativeArchetypeRecord,
} from "../../ports/archetypeRepository"

export type { ArchetypeCategory, NarrativeArchetypeRecord }

export interface ChemistryResult {
  archetypeA: NarrativeArchetypeRecord
  archetypeB: NarrativeArchetypeRecord
  tensionScore: number // 0.0 ~ 1.0
  coreEthicalConflict: string
  dramaticPrompt: string
}
