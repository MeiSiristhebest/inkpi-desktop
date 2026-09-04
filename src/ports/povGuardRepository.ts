export interface CharacterKnowledge {
  characterId: string
  characterName: string
  knownSecretIds: string[]
  currentLocation?: string
}

export interface SecretItem {
  id: string
  title: string
  confidentialityLevel: "low" | "secret" | "top_secret"
  originChapterOrder: number
  holders: string[]
}

export interface PovSnapshotRecord {
  id: string
  projectId: string
  chapterId: string
  chapterOrder: number
  povCharacterId: string
  povCharacterName: string
  povMode: "first_person" | "third_limited" | "third_objective" | "omniscient"
  allowedCharacters: CharacterKnowledge[]
  secrets: SecretItem[]
  headHoppingViolationsCount: number
  omniscienceLeaksCount: number
  updatedAt: number
}

export interface PovGuardRepository {
  getAll(projectId: string): Promise<PovSnapshotRecord[]>
  getByChapter(chapterId: string): Promise<PovSnapshotRecord | undefined>
  get(id: string): Promise<PovSnapshotRecord | undefined>
  save(record: PovSnapshotRecord): Promise<void>
  delete(id: string): Promise<void>
}
