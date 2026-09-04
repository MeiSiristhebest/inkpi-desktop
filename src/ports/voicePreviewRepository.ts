export type VoiceGender = "male" | "female" | "neutral"
export type VoiceAgeGroup = "youth" | "adult" | "elder" | "child"
export type VoiceTimbreFilter = "standard" | "heroic_highpass" | "villain_lowpass" | "whisper_bandpass"

export interface VoiceCastProfileRecord {
  id: string
  projectId: string
  characterId: string
  characterName: string
  gender: VoiceGender
  ageGroup: VoiceAgeGroup
  pitch: number // 0.5 ~ 2.0 (1.0 default)
  rate: number // 0.5 ~ 2.0 (1.0 default)
  timbreFilter: VoiceTimbreFilter
  updatedAt: number
}

export interface VoicePreviewRepository {
  getAll(projectId: string): Promise<VoiceCastProfileRecord[]>
  get(id: string): Promise<VoiceCastProfileRecord | undefined>
  save(record: VoiceCastProfileRecord): Promise<void>
  delete(id: string): Promise<void>
}

