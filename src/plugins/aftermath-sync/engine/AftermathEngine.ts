import type { EntityCandidate, AftermathAnalysisResult } from '../types'

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const uncertain =
  /没有|没能|未能|不曾|不能|并非|无法|不会|打算|计划|试图|如果|假如|倘若|要是|据说|传闻|认为|以为|提出|希望|想要/
const bondCues = [
  { cue: '结为异姓兄弟', relation: '结义兄弟' },
  { cue: '拜其为师', relation: '师徒方向待作者确认' },
  { cue: '义结金兰', relation: '结义' },
]

export class AftermathEngine {
  public static analyzeChapter(
    text: string,
    chapterId: string,
    chapterOrder: number | undefined,
    knownEntities: EntityCandidate[],
  ): AftermathAnalysisResult {
    const masked = text.replace(/“[^”]*”|「[^」]*」|『[^』]*』|"[^"]*"/g, (quote) =>
      ' '.repeat(quote.length),
    )
    const characters = knownEntities.filter(
      (entity) =>
        entity.category === 'character' &&
        entity.name &&
        knownEntities.filter((other) => other.name === entity.name).length === 1,
    )
    const items = knownEntities.filter(
      (entity) =>
        entity.category === 'item' &&
        entity.name &&
        knownEntities.filter((other) => other.name === entity.name).length === 1,
    )
    const patches: AftermathAnalysisResult['patches'] = []
    const add = (
      patch: Pick<
        AftermathAnalysisResult['patches'][number],
        'entityId' | 'entityName' | 'changeType' | 'propertyName' | 'beforeValue' | 'afterValue'
      >,
      start: number,
      end: number,
    ) => {
      patches.push({
        ...patch,
        chapterId,
        chapterOrder,
        evidenceSnippet: text.slice(start, end),
        evidenceStart: start,
        evidenceEnd: end,
        evidenceStatus: 'candidate',
        sourceText: text,
      })
    }
    for (const sentence of masked.matchAll(/[^。！？\r\n]+/g)) {
      const source = sentence[0]
      if (uncertain.test(source)) continue
      for (const character of characters) {
        const name = escape(character.name)
        const breaks = new RegExp(
          `${name}([^。！？:：]*?)(?:突破到|突破至|成功晋升为|一举迈入|踏入)([\u4e00-\u9fff]{2,6}(?:期|境|阶))`,
          'g',
        )
        for (const match of source.matchAll(breaks)) {
          if (
            /看着|告诉|说|听见|让|命令/.test(match[1]) ||
            characters.some((other) => other.id !== character.id && match[1].includes(other.name))
          )
            continue
          if (match[2] === character.currentTier) continue
          const start = sentence.index + match.index
          add(
            {
              entityId: character.id,
              entityName: character.name,
              changeType: 'attribute_update',
              propertyName: '战力境界',
              beforeValue: character.currentTier || '未知',
              afterValue: match[2],
            },
            start,
            start + match[0].length,
          )
        }
        for (const item of items) {
          const itemName = escape(item.name)
          const patterns = [
            new RegExp(`${name}([^。！？:：]*?)(?:夺得|收服|炼化了)(?:了)?${itemName}`, 'g'),
            new RegExp(`${name}([^。！？:：]*?)(?:将|把)${itemName}(?:收入囊中|据为己有)`, 'g'),
          ]
          for (const pattern of patterns)
            for (const match of source.matchAll(pattern)) {
              if (
                /看着|告诉|说|听见|让|命令/.test(match[1]) ||
                characters.some(
                  (other) => other.id !== character.id && match[1].includes(other.name),
                ) ||
                item.currentOwner === character.name
              )
                continue
              const start = sentence.index + match.index
              add(
                {
                  entityId: item.id,
                  entityName: item.name,
                  changeType: 'ownership_transfer',
                  propertyName: '所有权归属',
                  beforeValue: item.currentOwner || '未知',
                  afterValue: character.name,
                },
                start,
                start + match[0].length,
              )
            }
        }
      }
      const present = characters.filter((character) => source.includes(character.name))
      // More than two named characters makes the relationship participants ambiguous.
      if (present.length !== 2) continue
      for (const bond of bondCues) {
        const index = source.indexOf(bond.cue)
        if (index < 0) continue
        add(
          {
            entityId: present[0].id,
            entityName: present[0].name,
            changeType: 'new_relation',
            propertyName: '人际羁绊',
            beforeValue: '未记录',
            afterValue: `与 ${present[1].name}：原文出现「${bond.cue}」；${bond.relation}候选`,
          },
          sentence.index,
          sentence.index + source.length,
        )
      }
    }
    const unique = [
      ...new Map(
        patches.map((patch) => [
          JSON.stringify([
            patch.entityId,
            patch.changeType,
            patch.afterValue,
            patch.evidenceStart,
            patch.evidenceEnd,
          ]),
          patch,
        ]),
      ).values(),
    ]
    return {
      chapterId,
      patches: unique,
      summary: {
        attributeUpdates: unique.filter((patch) => patch.changeType === 'attribute_update').length,
        relations: unique.filter((patch) => patch.changeType === 'new_relation').length,
        ownershipTransfers: unique.filter((patch) => patch.changeType === 'ownership_transfer')
          .length,
      },
    }
  }
}
