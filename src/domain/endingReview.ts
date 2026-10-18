export interface EndingObservation {
  label: string
  quote: string
  start: number
  end: number
  status: 'literal_match'
}
export interface EndingReview {
  inputStatus: 'empty' | 'provided'
  characters: number
  coverage: { start: number; end: number; total: number }
  endingText: string
  observations: EndingObservation[]
}
const CUES = ['？', '?', '倒计时', '只剩', '然而', '但是', '原来', '竟是', '真相', '突然']
/** Literal locating aid. Occurrences do not establish suspense or reader response. */
export function reviewEnding(text: string): EndingReview {
  let start = Math.max(0, text.length - 400)
  if (start > 0 && /[\uDC00-\uDFFF]/.test(text[start])) start++
  const observations: EndingObservation[] = []
  for (const cue of CUES) {
    let offset = text.indexOf(cue, start)
    while (offset >= 0) {
      observations.push({
        label: '词项「' + cue + '」',
        quote: cue,
        start: offset,
        end: offset + cue.length,
        status: 'literal_match',
      })
      offset = text.indexOf(cue, offset + cue.length)
    }
  }
  observations.sort((a, b) => a.start - b.start || a.end - b.end)
  return {
    inputStatus: text.trim() ? 'provided' : 'empty',
    characters: Array.from(text.replace(/\s/g, '')).length,
    coverage: { start, end: text.length, total: text.length },
    endingText: text.slice(start),
    observations,
  }
}
export interface CutAlternative {
  start: number
  end: number
  quote: string
  continuation: string
  beforeCharacters: number
  afterCharacters: number
}
/** Sentence/paragraph boundaries outside dialogue; the last eight are shown. */
export function endingCuts(text: string): CutAlternative[] {
  const pairs: Record<string, string> = { '“': '”', '「': '」', '『': '』' }
  const stack: string[] = []
  const boundaries: number[] = []
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (pairs[ch]) stack.push(pairs[ch])
    else if (stack.at(-1) === ch) {
      stack.pop()
      if (!stack.length && /[。！？!?]/.test(text[i - 1] ?? '')) boundaries.push(i + 1)
    } else if (ch === '"') {
      if (stack.at(-1) === '"') stack.pop()
      else stack.push('"')
    }
    if (!stack.length && /[。！？!?\n\r]/.test(ch)) {
      let end = i + 1
      while (end < text.length && /[。！？!?\r\n]/.test(text[end])) end++
      boundaries.push(end)
      i = end - 1
    }
  }
  if (!stack.length && text.trim()) boundaries.push(text.length)
  const unique = [...new Set(boundaries)].sort((a, b) => a - b)
  const spans = unique
    .flatMap((end, index) => {
      let start = unique[index - 1] ?? 0
      while (start < end && /\s/.test(text[start])) start++
      if (!text.slice(start, end).trim()) return []
      return [{ start, end }]
    })
    .slice(-8)
  return spans.map(({ start, end }) => ({
    start,
    end,
    quote: text.slice(start, end),
    continuation: text.slice(end),
    beforeCharacters: Array.from(text.slice(0, end).replace(/\s/g, '')).length,
    afterCharacters: Array.from(text.slice(end).replace(/\s/g, '')).length,
  }))
}
