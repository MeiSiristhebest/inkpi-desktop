import type { MultiverseBranchRecord, MultiverseNode } from '../../ports/multiverseRepository'

export type { MultiverseBranchRecord, MultiverseNode }

export interface ButterflyEffectLog {
  chapterIndex: number
  rippleFactor: number | null
  description: string
  affectedCharacters: string[]
}

export interface MultiverseSimulationResult {
  branchId: string
  branchName: string
  divergencePremise: string
  suppliedChapterCount?: number
  forkChapterIndex: number
  divergenceCurve: Array<{ chapter: number; divergencePercent: number | null }>
  nodes: MultiverseNode[]
  butterflyEffects: ButterflyEffectLog[]
}
