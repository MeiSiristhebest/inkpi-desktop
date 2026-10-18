export interface QuotedSpeech {
  quote: string
  start: number
  end: number
  speakerName: string | null
  attribution: string
  attributionStatus: 'explicit' | 'unattributed'
}
const escape = (text: string) => text.replace(/[.*+?^{}()|[\]\\$]/g, '\\$&')
const VERB = '(?:说道|答道|问道|喝道|叹道|喊道|怒道|低声耳语|厉声喝道|说|问|答|道)'
const MODIFIER = '(?:(?:低声|轻声|大声|淡淡|冷冷|笑着|含笑|平静地|冷笑|冷哼|沉声|轻叹))*'
export function extractQuotedSpeech(
  text: string,
  characterNames: readonly string[] = [],
): QuotedSpeech[] {
  const names = [...new Set(characterNames.filter((name) => name.trim()))].sort(
    (a, b) => b.length - a.length,
  )
  const results: QuotedSpeech[] = []
  let previousEnd = 0
  for (const match of text.matchAll(/“([^”]*)”|「([^」]*)」|『([^』]*)』|"([^"]*)"/g)) {
    const start = match.index! + 1
    const end = match.index! + match[0].length - 1
    const quote = text.slice(start, end)
    if (!quote.trim()) {
      previousEnd = end + 1
      continue
    }
    const before = text.slice(previousEnd, match.index!)
    const after = text.slice(end + 1)
    const candidates: Array<{ name: string; attribution: string }> = []
    for (const name of names) {
      const literal = escape(name)
      const leading =
        new RegExp('(?<![对向跟给])' + literal + MODIFIER + VERB + '[：:]?\\s*$').exec(before) ??
        new RegExp('(?:^|[\\n。！？!?])\\s*' + literal + '[：:]\\s*$').exec(before) ??
        new RegExp(literal + '\\s+(?:said|asked|replied)\\s*[:,]?\\s*$', 'i').exec(before)
      const trailing =
        new RegExp('^[，,。]?\\s*' + literal + MODIFIER + VERB + '(?=[，,。！？!?\\s]|$)').exec(
          after,
        ) ??
        new RegExp('^[,.]?\\s*' + literal + '\\s+(?:said|asked|replied)(?=[,.!?\\s]|$)', 'i').exec(
          after,
        )
      if (leading) {
        const prior = before.slice(0, leading.index)
        const suffixOfLongerName = names.some(
          (other) =>
            other !== name &&
            other.endsWith(name) &&
            before.includes(other + leading[0].slice(name.length)),
        )
        if (!suffixOfLongerName && !/[对向跟给]\s*$/.test(prior))
          candidates.push({ name, attribution: leading[0] })
      }
      if (trailing) candidates.push({ name, attribution: trailing[0] })
    }
    if (!names.length) {
      const generic =
        /(?:^|[\n。！？!?])\s*([\p{L}\p{N}·._ -]{1,32}?)(?:(?:低声|轻声|大声|淡淡|冷冷|笑着|冷笑|沉声))*(?:说道|答道|问道|喝道|喊道|说|问|答|道)[：:]?\s*$/u.exec(
          before,
        )
      if (generic) candidates.push({ name: generic[1].trim(), attribution: generic[0].trim() })
    }
    const unique = new Set(candidates.map((c) => c.name))
    const attributed = unique.size === 1
    results.push({
      quote,
      start,
      end,
      speakerName: attributed ? candidates[0].name : null,
      attribution: attributed ? candidates[0].attribution : '',
      attributionStatus: attributed ? 'explicit' : 'unattributed',
    })
    previousEnd = end + 1
  }
  return results
}
