export interface SubtextDialogueRecord {
  id: string
  projectId: string
  chapterId: string
  speakerName: string
  spoken: string // 表面台词
  subtext: string // 水下潜台词
  beatAction: string // 伴随肢体微动作
  defenseMechanism?: string // 心理防御机制 (反语、逃避、理智化等)
  tensionLevel: number // 1 ~ 5
  updatedAt: number
}

export interface SubtextRepository {
  getAll(projectId: string): Promise<SubtextDialogueRecord[]>
  getByChapter(chapterId: string): Promise<SubtextDialogueRecord[]>
  get(id: string): Promise<SubtextDialogueRecord | undefined>
  save(record: SubtextDialogueRecord): Promise<void>
  delete(id: string): Promise<void>
}
