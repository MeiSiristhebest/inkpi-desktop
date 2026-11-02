import type { ManuscriptFormat } from '../manuscript/importParser'

export interface ReferenceSourceRecord {
  id: string
  title: string
  originalFileName: string
  format: ManuscriptFormat
  text: string
  tags: string[]
  contentFingerprint: string
  importedAt: number
  updatedAt: number
}

export interface ReferenceMaterialExcerpt {
  sourceId: string
  sourceTitle: string
  start: number
  end: number
  text: string
  score: number
  truncated: boolean
}

export type ReferenceMaterialOmissionReason =
  'not-selected' | 'no-matching-passages' | 'context-budget'

export interface ReferenceSourceDisclosure {
  sourceId: string
  title: string
  selected: boolean
  matchedPassages: number
  includedPassages: number
  includedCharacters: number
  omissionReason?: ReferenceMaterialOmissionReason
}

export interface PreparedReferenceMaterials {
  excerpts: ReferenceMaterialExcerpt[]
  disclosure: {
    sourceCount: number
    selectedCount: number
    includedCount: number
    omittedCount: number
    includedCharacters: number
    sources: ReferenceSourceDisclosure[]
  }
}

interface PassageCandidate {
  sourceId: string
  sourceTitle: string
  sourceIndex: number
  passageIndex: number
  start: number
  end: number
  text: string
  score: number
}

const MAX_PASSAGE_CHARACTERS = 800
const PASSAGE_OVERLAP_CHARACTERS = 120

/**
 * Create a task-local, lexical retrieval result. Only selected and matching passages are returned;
 * the disclosure separately records linked sources that were not selected or did not fit.
 */
export function prepareReferenceMaterials(
  sources: readonly ReferenceSourceRecord[],
  selectedSourceIds: readonly string[],
  query: string,
  maxCharacters: number,
): PreparedReferenceMaterials {
  const selected = new Set(selectedSourceIds)
  const terms = tokenize(query)
  const candidates: PassageCandidate[] = []
  const matchedBySource = new Map<string, number>()

  sources.forEach((source, sourceIndex) => {
    if (!selected.has(source.id) || terms.length === 0) return
    const passages = splitReferencePassages(source.text)
    let sourceMatches = 0
    passages.forEach((passage, passageIndex) => {
      const score = passageScore(passage.text, terms)
      if (score <= 0) return
      sourceMatches += 1
      candidates.push({
        sourceId: source.id,
        sourceTitle: source.title,
        sourceIndex,
        passageIndex,
        ...passage,
        score,
      })
    })
    matchedBySource.set(source.id, sourceMatches)
  })

  candidates.sort(
    (a, b) => b.score - a.score || a.sourceIndex - b.sourceIndex || a.passageIndex - b.passageIndex,
  )

  const ordered: PassageCandidate[] = []
  const added = new Set<string>()
  // Reserve one relevant excerpt per selected source before filling remaining budget by relevance.
  for (const sourceId of selectedSourceIds) {
    const best = candidates.find((candidate) => candidate.sourceId === sourceId)
    if (best) {
      const key = `${best.sourceId}:${best.passageIndex}`
      ordered.push(best)
      added.add(key)
    }
  }
  for (const candidate of candidates) {
    const key = `${candidate.sourceId}:${candidate.passageIndex}`
    if (!added.has(key)) ordered.push(candidate)
  }

  let remainingCharacters = Math.max(0, Math.floor(maxCharacters))
  const excerpts: ReferenceMaterialExcerpt[] = []
  const includedBySource = new Map<string, { passages: number; characters: number }>()
  const truncatedSources = new Set<string>()
  for (const candidate of ordered) {
    if (remainingCharacters <= 0) break
    const text = safeSlice(candidate.text, remainingCharacters).trimEnd()
    if (!text) continue
    const includedCharacters = text.length
    const truncated = includedCharacters < candidate.text.length
    excerpts.push({
      sourceId: candidate.sourceId,
      sourceTitle: candidate.sourceTitle,
      start: candidate.start,
      end: candidate.start + includedCharacters,
      text,
      score: candidate.score,
      truncated,
    })
    if (truncated) truncatedSources.add(candidate.sourceId)
    remainingCharacters -= includedCharacters
    const previous = includedBySource.get(candidate.sourceId) ?? { passages: 0, characters: 0 }
    includedBySource.set(candidate.sourceId, {
      passages: previous.passages + 1,
      characters: previous.characters + includedCharacters,
    })
  }

  const disclosureSources = sources.map((source): ReferenceSourceDisclosure => {
    const isSelected = selected.has(source.id)
    const matchedPassages = matchedBySource.get(source.id) ?? 0
    const included = includedBySource.get(source.id)
    let omissionReason: ReferenceMaterialOmissionReason | undefined
    if (!isSelected) omissionReason = 'not-selected'
    else if (matchedPassages === 0) omissionReason = 'no-matching-passages'
    else if ((included?.passages ?? 0) < matchedPassages || truncatedSources.has(source.id)) {
      omissionReason = 'context-budget'
    }
    return {
      sourceId: source.id,
      title: source.title,
      selected: isSelected,
      matchedPassages,
      includedPassages: included?.passages ?? 0,
      includedCharacters: included?.characters ?? 0,
      ...(omissionReason ? { omissionReason } : {}),
    }
  })

  const selectedCount = disclosureSources.filter((source) => source.selected).length
  const includedCount = disclosureSources.filter((source) => source.includedPassages > 0).length
  return {
    excerpts,
    disclosure: {
      sourceCount: sources.length,
      selectedCount,
      includedCount,
      omittedCount: disclosureSources.filter((source) => source.omissionReason).length,
      includedCharacters: excerpts.reduce((total, excerpt) => total + excerpt.text.length, 0),
      sources: disclosureSources,
    },
  }
}

function tokenize(value: string): string[] {
  return [...new Set(value.toLocaleLowerCase().match(/[a-z0-9]{2,}|[\u3400-\u9fff]{2}/gu) ?? [])]
}

function passageScore(text: string, terms: readonly string[]): number {
  const normalized = text.toLocaleLowerCase()
  let score = 0
  for (const term of terms) {
    let start = 0
    let occurrences = 0
    while ((start = normalized.indexOf(term, start)) >= 0 && occurrences < 3) {
      score += 1
      occurrences += 1
      start += term.length
    }
  }
  return score
}

function splitReferencePassages(text: string): Array<{ start: number; end: number; text: string }> {
  const passages: Array<{ start: number; end: number; text: string }> = []
  let start = 0
  while (start < text.length) {
    let end = Math.min(start + MAX_PASSAGE_CHARACTERS, text.length)
    if (end < text.length) {
      const paragraphBoundary = text.lastIndexOf('\n', end)
      if (paragraphBoundary >= start + Math.floor(MAX_PASSAGE_CHARACTERS / 2)) {
        end = paragraphBoundary + 1
      }
    }
    const passage = text.slice(start, end).trim()
    if (passage) {
      const leadingWhitespace = text.slice(start, end).search(/\S/u)
      const passageStart = start + Math.max(0, leadingWhitespace)
      passages.push({ start: passageStart, end: passageStart + passage.length, text: passage })
    }
    if (end >= text.length) break
    start = Math.max(start + 1, end - PASSAGE_OVERLAP_CHARACTERS)
  }
  return passages
}

function safeSlice(value: string, maxCharacters: number): string {
  let end = Math.min(value.length, maxCharacters)
  const last = value.charCodeAt(end - 1)
  if (last >= 0xd800 && last <= 0xdbff) end -= 1
  return value.slice(0, end)
}
