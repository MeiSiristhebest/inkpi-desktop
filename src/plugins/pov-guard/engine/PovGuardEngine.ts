import type { CharacterKnowledge, SecretItem, PovViolation, PovAnalysisResult } from '../types'

export interface EpistemicContext {
  povCharacter: string
  povMode: 'first_person' | 'third_limited' | 'third_objective' | 'omniscient'
  allCharacters: CharacterKnowledge[]
  secrets: SecretItem[]
  currentLocation?: string
}

const literalPattern = (value: string) => value.replace(/[.*+?^$()|[\]{}\\]/g, '\\$&')

/** Masks paired dialogue while preserving every UTF-16 position. */
function withoutDialogue(text: string): string {
  const closers: Record<string, string> = { '“': '”', '「': '」', '『': '』', '"': '"' }
  let closing = ''
  let output = ''
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (closing) {
      output += char === '\n' || char === '\r' ? char : ' '
      if (char === closing) closing = ''
    } else if (closers[char]) {
      closing = closers[char]
      output += ' '
    } else output += char
  }
  return output
}

/** Literal candidates for author review; predicate matches do not prove a POV error. */
export class PovGuardEngine {
  private static readonly PREDICATES = [
    '心想',
    '暗想',
    '暗自思量',
    '心里暗道',
    '暗暗吃惊',
    '心中冷笑',
    '内心暗忖',
    '暗道',
    '心中大骇',
    '感到一阵后怕',
    '回忆起当年的秘密',
    '不由得在心中盘算',
    '心中暗忖',
    '只觉内心冰凉',
    '感到莫名恐惧',
  ]

  static analyze(text: string, context: EpistemicContext): PovAnalysisResult {
    const paragraphs = [...text.matchAll(/[^\r\n]+/g)]
    const violations: PovViolation[] = []
    const pov = context.allCharacters.find(
      (c) => c.characterName === context.povCharacter || c.characterId === context.povCharacter,
    )
    const known = new Set(pov?.knownSecretIds ?? [])
    const holderNames = new Set(
      [context.povCharacter, pov?.characterName, pov?.characterId].filter(Boolean),
    )
    const narration = withoutDialogue(text)
    const restricted =
      context.povMode === 'third_objective'
        ? context.allCharacters
        : context.allCharacters.filter((c) => c !== pov)
    if (context.povMode !== 'omniscient') {
      for (const paragraph of paragraphs) {
        const start = paragraph.index!
        const paragraphIndex = (text.slice(0, start).match(/\n/g) ?? []).length
        const visible = narration.slice(start, start + paragraph[0].length)
        for (const character of restricted) {
          if (!character.characterName.trim()) continue
          const pattern = new RegExp(
            literalPattern(character.characterName) +
              '(?:此时|也|却|正)?(?:心中|心里|内心)?(?:' +
              this.PREDICATES.map(literalPattern).join('|') +
              ')',
            'g',
          )
          for (const match of visible.matchAll(pattern)) {
            const startOffset = start + match.index!
            const endOffset = startOffset + match[0].length
            violations.push({
              id: 'hh-' + startOffset + '-' + character.characterId,
              type: 'head_hopping',
              status: 'candidate',
              paragraphIndex,
              characterName: character.characterName,
              startOffset,
              endOffset,
              snippet: text.slice(startOffset, endOffset),
              explanation:
                '叙述中「' +
                character.characterName +
                '」紧邻心理词。当前视角为「' +
                context.povCharacter +
                '」；这可能是心理叙述、转述或推测，词项匹配不能确认视角越界。',
              suggestedFix:
                '核对该句的主体、转述来源和本场景视角。若确属受限视角外的心理，可改写为视角角色能观察到的证据。',
            })
          }
        }
        for (const secret of context.secrets) {
          if (
            !secret.title.trim() ||
            secret.confidentialityLevel === 'low' ||
            known.has(secret.id) ||
            secret.holders.some((holder) => holderNames.has(holder))
          )
            continue
          for (const match of paragraph[0].matchAll(
            new RegExp(literalPattern(secret.title), 'g'),
          )) {
            const startOffset = start + match.index!
            const endOffset = startOffset + secret.title.length
            violations.push({
              id: 'leak-' + startOffset + '-' + secret.id,
              type: 'omniscience_leak',
              status: 'candidate',
              paragraphIndex,
              characterName: context.povCharacter,
              startOffset,
              endOffset,
              snippet: text.slice(startOffset, endOffset),
              explanation:
                '正文提及「' +
                secret.title +
                '」，已保存配置没有记录视角角色知情。提及标题不能证明秘密被披露；请核对对话传递、否定、推测和配置是否完整。',
              suggestedFix: '确认知情来源和发生时间后更新设定，或只保留该视角能获知的内容。',
            })
          }
        }
      }
    }
    let sanitizedTextMask = text
    const redactions = violations
      .filter((v) => v.type === 'omniscience_leak')
      .sort((a, b) => b.startOffset - a.startOffset)
    let nextStart = text.length
    for (const finding of redactions) {
      if (finding.endOffset > nextStart) continue
      sanitizedTextMask =
        sanitizedTextMask.slice(0, finding.startOffset) +
        '[隐藏信息]' +
        sanitizedTextMask.slice(finding.endOffset)
      nextStart = finding.startOffset
    }
    return {
      povCharacter: context.povCharacter,
      povMode: context.povMode,
      totalParagraphs: paragraphs.filter((p) => p[0].trim()).length,
      headHoppingCount: violations.filter((v) => v.type === 'head_hopping').length,
      leakageCount: redactions.length,
      violations,
      sanitizedTextMask,
    }
  }
}
