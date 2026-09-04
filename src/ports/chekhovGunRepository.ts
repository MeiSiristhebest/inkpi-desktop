export type GunStatus = 'dormant' | 'incubating' | 'resurfaced' | 'fired' | 'abandoned'

export interface ChekhovGunRecord {
  id: string
  projectId: string
  gunName: string
  category: 'item' | 'secret' | 'character' | 'promise' | 'technique'
  status: GunStatus
  plantChapterOrder: number
  plantChapterTitle?: string
  plantSnippet: string
  expectedPayoffChapterOrder?: number
  actualFiredChapterOrder?: number
  firedSnippet?: string
  notes?: string
  rustingDistance: number // 当前连载章与埋枪章的跨度
  isRustingAlert: boolean // >= 30 章未引爆且仍处于休眠
  updatedAt: number
}

export interface ChekhovGunRepository {
  getAll(projectId: string): Promise<ChekhovGunRecord[]>
  get(id: string): Promise<ChekhovGunRecord | undefined>
  save(record: ChekhovGunRecord): Promise<void>
  delete(id: string): Promise<void>
}
