import { describe, expect, it } from 'vitest'
import { IronChamberEngine } from './IronChamberEngine'
import type { IronChamberRecord } from '../types'
const base: IronChamberRecord = {
  id: 'one',
  projectId: 'p',
  mode: 'words',
  targetWords: 10,
  targetMinutes: 1,
  startWords: 2,
  currentWords: 2,
  status: 'locked',
  pledgedAt: 1000,
}
describe('Focus session progress boundaries', () => {
  it('does not complete malformed or zero-target sessions', () => {
    for (const targetWords of [0, -1, 0.5, NaN, Infinity]) {
      const progress = IronChamberEngine.calculateProgress({ ...base, targetWords }, 20, 2000)
      expect(progress.isFulfilled).toBe(false)
      expect(progress.valid).toBe(false)
    }
    expect(IronChamberEngine.calculateProgress(base, NaN, 2000).valid).toBe(false)
    expect(IronChamberEngine.calculateProgress(base, 30, 500).isFulfilled).toBe(false)
  })
  it('allows voluntary termination with no explanation', () => {
    expect(IronChamberEngine.validateEmergencyAbort('').valid).toBe(true)
    expect(IronChamberEngine.validateEmergencyAbort('休息').valid).toBe(true)
  })
  it('counts Unicode characters consistently and counts whitespace separately', () => {
    expect(IronChamberEngine.countCharacters(' 😀 字\nA ')).toBe(3)
    expect(IronChamberEngine.countCharacters('')).toBe(0)
  })
})
