export type ReaderPersonaType = "critical_toxic" | "plot_detective" | "romance_shipper" | "power_fantasy" | "lore_scholar"

export interface ShadowDanmakuRecord {
  id: string
  projectId: string
  chapterId: string
  paragraphIndex: number
  personaType: ReaderPersonaType
  personaName: string
  content: string
  sentiment: "toxic_rage" | "applause" | "suspicious" | "excited"
  isToxicAlert: boolean
  toxicCategory?: "weak_protagonist" | "virgin_plot" | "book_breaking" | "cuckold_fear"
  createdAt: number
}

export interface ShadowReaderRepository {
  getAll(projectId: string): Promise<ShadowDanmakuRecord[]>
  getByChapter(chapterId: string): Promise<ShadowDanmakuRecord[]>
  save(record: ShadowDanmakuRecord): Promise<void>
  delete(id: string): Promise<void>
}
