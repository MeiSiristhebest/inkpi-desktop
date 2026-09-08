import type { Provenance, SourceEvidence } from './provenance'

export type NarrativePromiseStatus = 'open' | 'fulfilled' | 'broken' | 'abandoned' | 'uncertain'

export interface NarrativePromise {
  id: string
  statement: string
  status: NarrativePromiseStatus
  introducedAt?: string | number
  resolvedAt?: string | number
  evidence: SourceEvidence[]
  provenance: Provenance
}

export function createNarrativePromise(
  input: Omit<NarrativePromise, 'evidence'> & { evidence?: SourceEvidence[] },
): NarrativePromise {
  return {
    ...input,
    evidence: (input.evidence || []).map((item) => ({ ...item })),
  }
}
