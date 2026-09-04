import type {
  MechanicalSwitchType,
  AmbienceType,
  SoundscapeConfigRecord,
} from "../../ports/soundscapeConfigRepository"

export type { MechanicalSwitchType, AmbienceType, SoundscapeConfigRecord }

export interface SynthParams {
  transientFreq: number
  resonanceFreq: number
  transientDecay: number
  resonanceDecay: number
  volume: number
}
