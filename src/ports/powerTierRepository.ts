import type { Provenance } from '../domain/story/provenance'

export interface PowerTierSystem {
  projectId: string
  systemName: string
  tiers: string[]
  specialModifiers: string[]
  /** undefined uses the author-listed linear order; [] explicitly declares no ordering edges. */
  relations?: { lowerTier: string; higherTier: string }[]
  updatedAt: number
  provenance?: Provenance
}

export interface PowerTierRepository {
  get(projectId: string): Promise<PowerTierSystem | null>
  save(system: PowerTierSystem): Promise<void>
  delete(projectId: string): Promise<void>
}
