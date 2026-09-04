export interface PowerTierSystem {
  projectId: string
  systemName: string
  tiers: string[]
  specialModifiers: string[]
  updatedAt: number
}

export interface PowerTierRepository {
  get(projectId: string): Promise<PowerTierSystem | null>
  save(system: PowerTierSystem): Promise<void>
  delete(projectId: string): Promise<void>
}
