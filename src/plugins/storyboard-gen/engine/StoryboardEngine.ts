import type {
  ShotFrame,
  CharacterVisualCard,
  ClimaxStoryboardExtraction,
  StoryboardSceneRecord,
} from '../types'
export interface StoryboardContext {
  protagonist?: string
  antagonist?: string
  sceneGoal?: string
  artStyle?: string
  characters?: Array<{ id: string; name: string; visualFeatures?: string }>
}
export class StoryboardEngine {
  static buildAnalysisInput(params: {
    chapterTitle: string
    chapterText: string
    artStyle?: string
  }): Record<string, unknown> {
    return {
      ...params,
      artStyle: params.artStyle ?? '',
      mode: 'source-grounded-shot-options',
      missingAppearance: '未提供的外貌、服饰、光线与场景限制保持未知。',
    }
  }
  static extractStoryboard(
    chapterId: string,
    chapterTitle: string,
    chapterText: string,
    context?: StoryboardContext,
  ): ClimaxStoryboardExtraction {
    const passages = [...chapterText.matchAll(/[^\r\n]+/g)].flatMap((match) => {
      const quote = match[0].trim()
      if (!quote) return []
      const start = match.index! + match[0].length - match[0].trimStart().length
      return [{ quote, start, end: start + quote.length }]
    })
    const selected =
      passages.length <= 4
        ? passages
        : [
            ...new Set([
              0,
              Math.floor((passages.length - 1) / 3),
              Math.floor(((passages.length - 1) * 2) / 3),
              passages.length - 1,
            ]),
          ].map((index) => passages[index])
    const labels = ['可选全景', '可选中景', '可选特写', '可选广角']
    const shotTypes: ShotFrame['shotType'][] = [
      'establishing_wide',
      'medium_confrontation',
      'dutch_closeup',
      'impact_wide',
    ]
    const characters = [...(context?.characters ?? [])]
    for (const name of [context?.protagonist, context?.antagonist])
      if (name?.trim() && !characters.some((c) => c.name === name))
        characters.push({ id: 'author-' + encodeURIComponent(name), name })
    const cards: CharacterVisualCard[] = chapterText.trim()
      ? characters
          .filter((c) => c.name.trim())
          .map((c) => ({
            characterId: c.id,
            characterName: c.name,
            visualFeatures: c.visualFeatures ?? '',
            stableDiffusionPrompt:
              '作者指定角色：' +
              c.name +
              (c.visualFeatures ? '；外观约束：' + c.visualFeatures : '；尚未提供外观约束。') +
              (context?.artStyle ? '；作者画风：' + context.artStyle : ''),
            source: 'author-record',
          }))
      : []
    const frames: ShotFrame[] = selected.map((passage, index) => ({
      id: 'shot_' + (index + 1) + '_' + chapterId,
      shotOrder: index + 1,
      shotType: shotTypes[index],
      shotLabel: '镜头草案 ' + (index + 1) + ' · ' + labels[index],
      description: passage.quote,
      compositionGuide: 'rule_of_thirds',
      lightingMood: '',
      visualPrompt:
        '以此原文时刻作为分镜素材：' +
        passage.quote +
        '\n机位建议：' +
        labels[index] +
        '（可调整）。\n已提供角色外观：' +
        (cards
          .filter((c) => c.visualFeatures)
          .map((c) => c.characterName + '：' + c.visualFeatures)
          .join('；') || '未提供，生成前由作者补充。') +
        (context?.artStyle ? '\n作者画风：' + context.artStyle : ''),
      sourceQuote: passage.quote,
      sourceStart: passage.start,
      sourceEnd: passage.end,
      status: 'staging-option',
    }))
    return {
      sceneTitle: (chapterTitle || '未命名场景') + ' · 分镜草案',
      coreConflict: context?.sceneGoal ?? '',
      frames,
      suggestedCharacters: cards,
      coverage: {
        totalPassages: passages.length,
        suppliedPassages: selected.length,
        complete: selected.length === passages.length,
      },
    }
  }
  static createSceneRecord(
    id: string,
    projectId: string,
    chapterId: string,
    extracted: ClimaxStoryboardExtraction,
    createdAt: number,
  ): StoryboardSceneRecord {
    return {
      id,
      projectId,
      chapterId,
      sceneTitle: extracted.sceneTitle,
      shotFrames: structuredClone(extracted.frames),
      characterCards: structuredClone(extracted.suggestedCharacters),
      createdAt,
      coverage: extracted.coverage,
      schemaVersion: 2,
    }
  }
}
