export type MechanicalSwitchType = "blue" | "brown" | "vintage" | "silent"
export type AmbienceType = "none" | "rain" | "campfire" | "temple"

export interface SoundscapeConfigRecord {
  projectId: string
  switchType: MechanicalSwitchType
  backgroundAmbience: AmbienceType
  volumeKey: number // 0.0 ~ 1.0
  volumeAmbience: number // 0.0 ~ 1.0
  enabled: boolean
}

export interface SoundscapeConfigRepository {
  get(projectId: string): Promise<SoundscapeConfigRecord | undefined>
  save(record: SoundscapeConfigRecord): Promise<void>
}
