import type {
  MultiverseBranchRecord,
  MultiverseNode,
} from "../../ports/multiverseRepository"

export type { MultiverseBranchRecord, MultiverseNode }

export interface ButterflyEffectLog {
  chapterIndex: number
  rippleFactor: number
  description: string
  affectedCharacters: string[]
}

export interface MultiverseSimulationResult {
  branchId: string
  branchName: string
  forkChapterIndex: number
  divergenceCurve: Array<{ chapter: number; divergencePercent: number }>
  nodes: MultiverseNode[]
  butterflyEffects: ButterflyEffectLog[]
}

