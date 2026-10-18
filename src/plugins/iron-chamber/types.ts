import type {
  ChamberLockMode,
  ChamberStatus,
  IronChamberRecord,
} from '../../ports/ironChamberRepository'

export type { ChamberLockMode, ChamberStatus, IronChamberRecord }

export interface LockProgress {
  valid: boolean
  error?: string
  deltaWords: number
  targetWords: number
  elapsedSeconds: number
  targetSeconds: number
  wordsPercentage: number
  timePercentage: number
  isFulfilled: boolean
}
