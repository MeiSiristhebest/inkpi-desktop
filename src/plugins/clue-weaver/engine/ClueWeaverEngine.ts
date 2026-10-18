import type {
  ClueItem,
  ClueCognitionRecord,
  GodViewViolation,
  InformationAdvantage,
  EpistemicState,
} from '../types'

export class ClueWeaverEngine {
  private extractUtterances(
    text: string,
    knownCharNames: string[],
  ): Array<{ speaker: string; speech: string; speechStart: number }> {
    const names = [...new Set(knownCharNames.filter((name) => name.trim()))].sort(
      (a, b) => b.length - a.length,
    )
    if (!text || !names.length) return []
    const escaped = names.map((name) => name.replace(/[.*+?^$()|[\]{}\\]/g, '\\$&')).join('|')
    const verb =
      '(?:冷笑道|冷笑|冷哼道|说道|说|道|问道|问|回答|答|低语|沉吟道|怒斥|喝道|喊道|轻声说|低声说)'
    const leading = new RegExp('(' + escaped + ')' + verb + '[：:]\\s*[“「"]([^”」"]+)[”」"]', 'g')
    const trailing = new RegExp('[“「"]([^”」"]+)[”」"][，,。]?\\s*(' + escaped + ')' + verb, 'g')
    const utterances: Array<{ speaker: string; speech: string; speechStart: number }> = []
    for (const match of text.matchAll(leading))
      utterances.push({
        speaker: match[1],
        speech: match[2],
        speechStart: match.index! + match[0].indexOf(match[2], match[1].length),
      })
    for (const match of text.matchAll(trailing)) {
      const speechStart = match.index! + 1
      if (!utterances.some((utterance) => utterance.speechStart === speechStart))
        utterances.push({ speaker: match[2], speech: match[1], speechStart })
    }
    return utterances.sort((a, b) => a.speechStart - b.speechStart)
  }

  scanGodViewLeakage(
    text: string,
    clues: ClueItem[],
    cognitions: ClueCognitionRecord[],
    currentChapter?: number,
  ): GodViewViolation[] {
    const violations: GodViewViolation[] = []
    const utterances = this.extractUtterances(
      text,
      cognitions.map((cognition) => cognition.characterName),
    )
    for (const utterance of utterances)
      for (const clue of clues) {
        if (clue.status === 'abandoned') continue
        const cognition = cognitions
          .filter(
            (record) =>
              record.clueId === clue.id &&
              (record.characterName === utterance.speaker ||
                record.characterId === utterance.speaker),
          )
          .sort((a, b) => b.updatedAt - a.updatedAt)[0]
        if (!cognition) continue
        const beforeAcquisition =
          currentChapter !== undefined &&
          cognition.learnedAtChapter !== undefined &&
          currentChapter < cognition.learnedAtChapter
        if (cognition.epistemicState !== 'blind' && !beforeAcquisition) continue
        for (const keyword of new Set(
          clue.keywords.map((keyword) => keyword.trim()).filter(Boolean),
        )) {
          let from = 0
          while (from < utterance.speech.length) {
            const index = utterance.speech.indexOf(keyword, from)
            if (index < 0) break
            const startOffset = utterance.speechStart + index,
              endOffset = startOffset + keyword.length
            violations.push({
              characterName: utterance.speaker,
              characterId: cognition.characterId,
              clueId: clue.id,
              clueTitle: clue.title,
              matchedKeyword: keyword,
              startOffset,
              endOffset,
              snippet: text.slice(startOffset, endOffset),
              status: 'candidate',
              reason:
                '角色「' +
                utterance.speaker +
                '」的台词提及「' +
                keyword +
                '」。' +
                (beforeAcquisition
                  ? '当前章节早于记录的获知章节。'
                  : '作者记录其对本线索处于未知盲区。') +
                '词项提及不能证明角色掌握真相；请复核提问、否定、猜测、引述和获知来源。',
            })
            from = index + keyword.length
          }
        }
      }
    return violations
  }

  /**
   * 计算角色 A 对角色 B 的情报不对称优势指数 (IAI)
   */
  computeAdvantage(
    charAId: string,
    charAName: string,
    charBId: string,
    charBName: string,
    clues: ClueItem[],
    cognitions: ClueCognitionRecord[],
  ): InformationAdvantage {
    const activeClues = clues.filter((c) => c.status !== 'abandoned')
    const activeClueIds = new Set(activeClues.map((c) => c.id))

    const aKnown = new Set<string>()
    const bKnown = new Set<string>()

    for (const cog of cognitions) {
      if (!activeClueIds.has(cog.clueId)) continue
      if (cog.epistemicState === 'known') {
        if (cog.characterId === charAId || cog.characterName === charAName) {
          aKnown.add(cog.clueId)
        }
        if (cog.characterId === charBId || cog.characterName === charBName) {
          bKnown.add(cog.clueId)
        }
      }
    }

    const knownByAOnly: string[] = []
    const knownByBOnly: string[] = []
    const mutualKnown: string[] = []

    const allUnion = new Set([...aKnown, ...bKnown])
    for (const id of allUnion) {
      const inA = aKnown.has(id)
      const inB = bKnown.has(id)
      const clue = activeClues.find((c) => c.id === id)
      const title = clue ? clue.title : id

      if (inA && inB) mutualKnown.push(title)
      else if (inA) knownByAOnly.push(title)
      else if (inB) knownByBOnly.push(title)
    }

    const denom = Math.max(1, allUnion.size)
    const rawScore = (knownByAOnly.length - knownByBOnly.length) / denom
    const unrecordedPairs = activeClues.reduce(
      (count, clue) =>
        count +
        [
          [charAId, charAName],
          [charBId, charBName],
        ].filter(
          ([id, name]) =>
            !cognitions.some(
              (record) =>
                record.clueId === clue.id &&
                (record.characterId === id || record.characterName === name),
            ),
        ).length,
      0,
    )
    const advantageScore =
      allUnion.size === 0 || unrecordedPairs > 0 ? null : Math.round(rawScore * 100) / 100

    return {
      characterA: charAName,
      characterB: charBName,
      advantageScore,
      unrecordedPairs,
      knownByAOnly,
      knownByBOnly,
      mutualKnown,
    }
  }

  /**
   * 生成角色 × 线索二维认知矩阵切片
   */
  getCognitionMatrix(
    characters: Array<{ id: string; name: string }>,
    clues: ClueItem[],
    cognitions: ClueCognitionRecord[],
  ): Array<{
    character: { id: string; name: string }
    clueStates: Array<{ clueId: string; state: EpistemicState | 'unrecorded' }>
  }> {
    const activeClues = clues.filter((c) => c.status !== 'abandoned')
    return characters.map((char) => {
      const clueStates = activeClues.map((clue) => {
        const found = cognitions.find(
          (cog) =>
            cog.clueId === clue.id &&
            (cog.characterId === char.id || cog.characterName === char.name),
        )
        return {
          clueId: clue.id,
          state: found ? found.epistemicState : ('unrecorded' as const),
        }
      })
      return {
        character: char,
        clueStates,
      }
    })
  }
}

export const clueWeaverEngine = new ClueWeaverEngine()
