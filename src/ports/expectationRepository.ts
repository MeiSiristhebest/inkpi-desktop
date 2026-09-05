export interface ExpectationContract {
  id: string
  projectId: string
  chapterId?: string
  title: string
  intensity: 1 | 2 | 3 | 4 | 5
  status: 'planted' | 'building' | 'climax' | 'fulfilled' | 'broken'
  plantedChapter: number
  promisedResolveChapter: number
  actualResolvedChapter?: number
  notes?: string
  createdAt: number
  updatedAt: number
}

export interface ExpectationRepository {
  getAll(projectId?: string): Promise<ExpectationContract[]>
  save(contract: ExpectationContract): Promise<void>
  delete(id: string): Promise<void>
}
