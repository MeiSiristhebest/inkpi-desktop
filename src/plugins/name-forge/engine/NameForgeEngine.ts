// 中西奇幻起名姬核心引擎
// 基于上下文无关文法（CFG）与平仄声韵和谐度采样的智能命名系统

import type {
  NameStyle,
  NameGenerateOptions,
  GeneratedNameItem,
} from '../types'
import lexicons from '../data/lexicons.json'
import type { RandomSource } from '../../../ports/randomSource'
import { randomSource as defaultRandomSource } from '../../../adapters/randomSource'
import { idGenerator } from '../../../adapters/idGenerator'
import { PhoneticsEvaluator } from './PhoneticsEvaluator'

export class NameForgeEngine {
  private randomSource: RandomSource

  constructor(random?: RandomSource) {
    this.randomSource = random || defaultRandomSource
  }

  private pickOne<T>(list: T[], rng: RandomSource): T {
    const idx = Math.floor(rng.next() * list.length)
    return list[Math.min(idx, list.length - 1)]
  }

  /**
   * 生成指定类别与风格的名称候选列表
   */
  public generateNames(
    options: NameGenerateOptions,
    random?: RandomSource,
  ): GeneratedNameItem[] {
    const rng = random || this.randomSource
    const count = options.count && options.count > 0 ? options.count : 10
    const style = options.style || 'balanced'
    const results: GeneratedNameItem[] = []
    const seen = new Set<string>()

    for (let i = 0; i < count * 3 && results.length < count; i++) {
      const item = this.generateSingle(options, style, rng)
      if (!seen.has(item.name)) {
        seen.add(item.name)
        results.push(item)
      }
    }

    return results
  }

  private generateSingle(
    options: NameGenerateOptions,
    style: NameStyle,
    rng: RandomSource,
  ): GeneratedNameItem {
    const id = idGenerator.generate('name')

    switch (options.category) {
      case 'character_cn':
        return this.generateChineseCharacter(id, options, style, rng)
      case 'character_western':
        return this.generateWesternCharacter(id, options, style, rng)
      case 'sect_faction':
        return this.generateSect(id, options, style, rng)
      case 'technique_spell':
        return this.generateTechnique(id, options, style, rng)
      case 'item_artifact':
        return this.generateArtifact(id, options, style, rng)
      case 'location_realm':
        return this.generateLocation(id, options, style, rng)
      default:
        return this.generateChineseCharacter(id, options, style, rng)
    }
  }

  private getCharacterCharPool(style: NameStyle, rng: RandomSource): string[] {
    if (style === 'balanced') {
      const styles: (keyof typeof lexicons.characters_by_style)[] = [
        'cold_sharp',
        'domineering',
        'ethereal',
        'elegant',
      ]
      const chosen = this.pickOne(styles, rng)
      return lexicons.characters_by_style[chosen]
    }
    const pool = lexicons.characters_by_style[style as keyof typeof lexicons.characters_by_style]
    return pool || lexicons.characters_by_style.elegant
  }

  private generateChineseCharacter(
    id: string,
    options: NameGenerateOptions,
    style: NameStyle,
    rng: RandomSource,
  ): GeneratedNameItem {
    const surname = options.fixedPrefix || this.pickOne(lexicons.surnames_cn, rng)
    const pool = this.getCharacterCharPool(style, rng)

    let givenName = ''
    if (options.fixedKern) {
      const extra = this.pickOne(pool, rng)
      givenName = rng.next() > 0.5 ? `${options.fixedKern}${extra}` : `${extra}${options.fixedKern}`
    } else {
      // 80% 概率双字名，20% 概率单字名
      if (rng.next() < 0.2) {
        givenName = this.pickOne(pool, rng)
      } else {
        const c1 = this.pickOne(pool, rng)
        let c2 = this.pickOne(pool, rng)
        let tries = 0
        while (c2 === c1 && tries < 5) {
          c2 = this.pickOne(pool, rng)
          tries++
        }
        givenName = `${c1}${c2}`
      }
    }

    const fullName = `${surname}${givenName}`
    const evalResult = PhoneticsEvaluator.evaluatePhonetics(fullName)

    let vibe = `【${evalResult.pattern}】${evalResult.toneVibe}`
    if (style === 'cold_sharp') vibe += '。冷峻孤绝，如寒芒出匣，适合独行剑客或孤高道子'
    else if (style === 'domineering') vibe += '。气势磅礴，威压四海，适合一方宗主或天命皇尊'
    else if (style === 'ethereal') vibe += '。清灵出尘，飘逸洒脱，适合不染凡尘的羽化修士'
    else if (style === 'demonic') vibe += '。邪魅桀骜，深不可测，适合魔道巨擘或宿命枭雄'
    else if (style === 'elegant') vibe += '。古雅端庄，文质彬彬，适合书院儒侠或名门望族'

    return {
      id,
      name: fullName,
      category: 'character_cn',
      style,
      parts: { prefix: surname, core: givenName },
      phoneticsScore: evalResult.score,
      meaningOrVibe: vibe,
    }
  }

  private generateWesternCharacter(
    id: string,
    options: NameGenerateOptions,
    style: NameStyle,
    rng: RandomSource,
  ): GeneratedNameItem {
    let firstNames = [
      ...lexicons.firstnames_western_male,
      ...lexicons.firstnames_western_female,
    ]
    if (options.gender === 'male') {
      firstNames = lexicons.firstnames_western_male
    } else if (options.gender === 'female') {
      firstNames = lexicons.firstnames_western_female
    }

    const first = options.fixedKern || this.pickOne(firstNames, rng)
    const last = options.fixedPrefix || this.pickOne(lexicons.surnames_western, rng)
    const fullName = `${first}·${last}`

    // 西方音律：音节对称度与轻重读步频（长名轻读、短名重读）
    const totalSyllables = first.length + last.length
    const cadenceRatio = Math.min(first.length, last.length) / Math.max(first.length, last.length)
    const phoneticsScore = Math.min(98, Math.max(65, Math.round(75 + cadenceRatio * 15 + (totalSyllables % 3) * 3)))

    return {
      id,
      name: fullName,
      category: 'character_western',
      style,
      parts: { prefix: first, core: last },
      phoneticsScore,
      meaningOrVibe: '具备古典西方奇幻韵味，带有贵族氏族或古老魔法传承质感',
    }
  }

  private generateSect(
    id: string,
    options: NameGenerateOptions,
    style: NameStyle,
    rng: RandomSource,
  ): GeneratedNameItem {
    const prefix = options.fixedPrefix || this.pickOne(lexicons.sect_prefixes, rng)
    const core = options.fixedKern || this.pickOne(lexicons.sect_cores, rng)
    const suffix = this.pickOne(lexicons.sect_suffixes, rng)
    const fullName = `${prefix}${core}${suffix}`
    const evalResult = PhoneticsEvaluator.evaluatePhonetics(fullName)

    return {
      id,
      name: fullName,
      category: 'sect_faction',
      style,
      parts: { prefix, core, suffix },
      phoneticsScore: evalResult.score,
      meaningOrVibe: `传承久远的古老势力（${evalResult.pattern}），擅御【${core}】道，名震八方修真界`,
    }
  }

  private generateTechnique(
    id: string,
    options: NameGenerateOptions,
    style: NameStyle,
    rng: RandomSource,
  ): GeneratedNameItem {
    const prefix = options.fixedPrefix || this.pickOne(lexicons.technique_prefixes, rng)
    const core = options.fixedKern || this.pickOne(lexicons.technique_cores, rng)
    const suffix = this.pickOne(lexicons.technique_suffixes, rng)
    const fullName = `${prefix}${core}${suffix}`
    const evalResult = PhoneticsEvaluator.evaluatePhonetics(fullName)

    return {
      id,
      name: fullName,
      category: 'technique_spell',
      style,
      parts: { prefix, core, suffix },
      phoneticsScore: evalResult.score,
      meaningOrVibe: `威震寰宇的玄奥法门（${evalResult.pattern}），修至圆满可借【${core}】之力逆天改命`,
    }
  }

  private generateArtifact(
    id: string,
    options: NameGenerateOptions,
    style: NameStyle,
    rng: RandomSource,
  ): GeneratedNameItem {
    const prefix = options.fixedPrefix || this.pickOne(lexicons.artifact_prefixes, rng)
    const form = options.fixedKern || this.pickOne(lexicons.artifact_forms, rng)
    const fullName = `${prefix}${form}`
    const evalResult = PhoneticsEvaluator.evaluatePhonetics(fullName)

    return {
      id,
      name: fullName,
      category: 'item_artifact',
      style,
      parts: { prefix, core: form },
      phoneticsScore: evalResult.score,
      meaningOrVibe: `采九天神料由大能修士淬炼而成的至宝神兵（${evalResult.pattern}），攻守莫测`,
    }
  }

  private generateLocation(
    id: string,
    options: NameGenerateOptions,
    style: NameStyle,
    rng: RandomSource,
  ): GeneratedNameItem {
    const prefix = options.fixedPrefix || this.pickOne(lexicons.location_prefixes, rng)
    const form = options.fixedKern || this.pickOne(lexicons.location_forms, rng)
    const fullName = `${prefix}${form}`
    const evalResult = PhoneticsEvaluator.evaluatePhonetics(fullName)

    return {
      id,
      name: fullName,
      category: 'location_realm',
      style,
      parts: { prefix, core: form },
      phoneticsScore: evalResult.score,
      meaningOrVibe: `传闻有上古仙魔陨落于此（${evalResult.pattern}），步步机锋凶险，伴随逆天机缘`,
    }
  }
}

export const nameForgeEngine = new NameForgeEngine()
