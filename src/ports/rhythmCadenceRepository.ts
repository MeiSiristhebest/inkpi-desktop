export interface RhythmCadenceRecord {
  projectId: string
  microCycleLength: number // 默认 3 章 (小循环: 制造悬念/局部爽点)
  mesoCycleLength: number // 默认 15 章 (中循环: 副本开启到终结收获)
  macroCycleLength: number // 默认 50 章 (大循环: 卷末大决战与地图更替)
  currentMicroStep: number // 1 - microCycleLength
  currentMesoStep: number // 1 - mesoCycleLength
  currentMacroStep: number // 1 - macroCycleLength
  stagnationChapterCount: number // 连续无推进章节数
  autoDetectEnabled: boolean
  updatedAt: number
}

export interface RhythmCadenceRepository {
  get(projectId: string): Promise<RhythmCadenceRecord | undefined>
  save(record: RhythmCadenceRecord): Promise<void>
}
