import type {
  ClueItem,
  ClueCognitionRecord,
  GodViewViolation,
  InformationAdvantage,
  EpistemicState,
} from '../types'

export class ClueWeaverEngine {
  /**
   * 鲁棒的多模式对话台词与说话者提取器 (Robust Speaker-Dialogue Extractor)
   */
  private extractUtterances(
    text: string,
    knownCharNames: string[]
  ): Array<{ speaker: string; speech: string; fullSnippet: string }> {
    const utterances: Array<{ speaker: string; speech: string; fullSnippet: string }> = []
    if (!text) return utterances

    const speechVerbPattern =
      '(?:道|说|冷笑|冷哼|暗道|心想|沉吟|怒斥|低语|喝道|叹道|大笑|微笑|问|答|呼喊|暴喝|低呼)'

    // 模式 1：正向引领: 角色 + 动作动词 + 冒号 + “台词”
    const leadingRegex = new RegExp(
      `([\\u4e00-\\u9fa5A-Za-z0-9_]{2,15}?)${speechVerbPattern}[：:]\\s*[“「]([^”」]+)[”」]`,
      'g'
    )
    let m: RegExpExecArray | null
    while ((m = leadingRegex.exec(text)) !== null) {
      const prefix = m[1]
      const speech = m[2]
      const matched = knownCharNames.find((n) => prefix.endsWith(n) || prefix.includes(n)) || prefix
      utterances.push({ speaker: matched.trim(), speech: speech.trim(), fullSnippet: m[0] })
    }

    // 模式 2：倒装后置: “台词”，角色 + 动作动词
    const trailingRegex = new RegExp(
      `[“「]([^”」]+)[”」][，,。]?\\s*([\\u4e00-\\u9fa5A-Za-z0-9_]{2,15}?)${speechVerbPattern}`,
      'g'
    )
    while ((m = trailingRegex.exec(text)) !== null) {
      const speech = m[1]
      const postfix = m[2]
      const matched = knownCharNames.find((n) => postfix.startsWith(n) || postfix.includes(n)) || postfix
      utterances.push({ speaker: matched.trim(), speech: speech.trim(), fullSnippet: m[0] })
    }

    return utterances
  }

  /**
   * 扫描文本中的对话/内心独白，检测是否出现形式化“天降全知（未掌握线索却说了出来）”逻辑漏洞
   */
  scanGodViewLeakage(
    text: string,
    clues: ClueItem[],
    cognitions: ClueCognitionRecord[]
  ): GodViewViolation[] {
    const violations: GodViewViolation[] = []
    if (!text || clues.length === 0) return violations

    const clueKeywordMap: Array<{ clue: ClueItem; keyword: string }> = []
    for (const clue of clues) {
      if (clue.status === 'abandoned') continue
      for (const kw of clue.keywords) {
        if (kw.trim().length >= 2) {
          clueKeywordMap.push({ clue, keyword: kw.trim() })
        }
      }
    }

    const knownCharNames = Array.from(
      new Set(cognitions.map((c) => c.characterName).filter(Boolean))
    )

    const utterances = this.extractUtterances(text, knownCharNames)

    for (const u of utterances) {
      for (const { clue, keyword } of clueKeywordMap) {
        if (u.speech.includes(keyword)) {
          const cog = cognitions.find(
            (c) =>
              c.clueId === clue.id &&
              (c.characterName === u.speaker || c.characterId === u.speaker)
          )

          const state: EpistemicState = cog ? cog.epistemicState : 'blind'

          if (state === 'blind') {
            violations.push({
              characterName: u.speaker,
              characterId: cog?.characterId || u.speaker,
              clueId: clue.id,
              clueTitle: clue.title,
              matchedKeyword: keyword,
              snippet: u.fullSnippet.length > 60 ? u.fullSnippet.slice(0, 60) + '...' : u.fullSnippet,
              reason: `角色【${u.speaker}】在认知模态图谱中对线索【${clue.title}】处于未知盲区(Blind)，却在对白中泄露了关键真值命题“${keyword}”！`,
            })
          }
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
    cognitions: ClueCognitionRecord[]
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
    const advantageScore = Math.round(rawScore * 100) / 100

    return {
      characterA: charAName,
      characterB: charBName,
      advantageScore,
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
    cognitions: ClueCognitionRecord[]
  ): Array<{
    character: { id: string; name: string }
    clueStates: Array<{ clueId: string; state: EpistemicState }>
  }> {
    const activeClues = clues.filter((c) => c.status !== 'abandoned')
    return characters.map((char) => {
      const clueStates = activeClues.map((clue) => {
        const found = cognitions.find(
          (cog) =>
            cog.clueId === clue.id &&
            (cog.characterId === char.id || cog.characterName === char.name)
        )
        return {
          clueId: clue.id,
          state: found ? found.epistemicState : ('blind' as EpistemicState),
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
