export type EpistemicState = 'blind' | 'suspected' | 'known'

export interface ClueItem {
  id: string
  projectId: string
  title: string
  category: 'murder' | 'identity' | 'treasure' | 'conspiracy' | 'secret'
  description: string
  keywords: string[]
  status: 'active' | 'solved' | 'abandoned'
  createdAt: number
  updatedAt: number
}

export interface ClueCognitionRecord {
  id: string
  projectId: string
  clueId: string
  characterId: string
  characterName: string
  epistemicState: EpistemicState
  learnedAtChapter?: number
  notes?: string
  updatedAt: number
}

export interface ClueWeaverData {
  clues: ClueItem[]
  cognitions: ClueCognitionRecord[]
}

export interface ClueWeaverRepository {
  getAllClues(projectId: string): Promise<ClueItem[]>
  saveClue(clue: ClueItem): Promise<void>
  deleteClue(id: string): Promise<void>
  getAllCognitions(projectId: string): Promise<ClueCognitionRecord[]>
  saveCognition(record: ClueCognitionRecord): Promise<void>
  deleteCognition(id: string): Promise<void>
}
