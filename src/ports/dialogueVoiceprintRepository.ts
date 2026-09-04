export type ToneStyle =
  | 'archaic'
  | 'colloquial'
  | 'aggressive'
  | 'laconic'
  | 'polite'
  | 'custom'

export interface CharacterVoiceprint {
  id: string
  projectId: string
  characterName: string
  sampleDialogueCount: number
  averageSentenceLength: number
  questionRatio: number
  exclamationRatio: number
  catchphrases: string[]
  toneStyle: ToneStyle
  updatedAt: number
}

export interface DialogueVoiceprintRepository {
  getAll(projectId: string): Promise<CharacterVoiceprint[]>
  getByName(projectId: string, name: string): Promise<CharacterVoiceprint | undefined>
  save(record: CharacterVoiceprint): Promise<void>
  delete(id: string): Promise<void>
}
