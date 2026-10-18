import type { NameGenerateOptions, GeneratedNameItem, NameStyle } from '../types'
import lexicons from '../data/lexicons.json'
import type { RandomSource } from '../../../ports/randomSource'
import { randomSource as defaultRandomSource } from '../../../adapters/randomSource'
import { idGenerator } from '../../../adapters/idGenerator'
export class NameForgeEngine {
  private randomSource: RandomSource
  constructor(randomSource: RandomSource = defaultRandomSource) {
    this.randomSource = randomSource
  }
  private pick(list: readonly string[], rng: RandomSource): string {
    if (!list.length) throw new Error('候选词库为空。')
    const value = rng.next()
    if (!Number.isFinite(value) || value < 0 || value >= 1)
      throw new Error('随机源须返回 [0,1) 范围内的数值。')
    return list[Math.floor(value * list.length)]
  }
  generateNames(options: NameGenerateOptions, random?: RandomSource): GeneratedNameItem[] {
    const count = options.count ?? 10,
      minLength = options.minLength ?? 1,
      maxLength = options.maxLength ?? 80
    if (!Number.isSafeInteger(count) || count < 0 || count > 100)
      throw new Error('候选数量须为 0 至 100 的整数。')
    if (
      !Number.isSafeInteger(minLength) ||
      !Number.isSafeInteger(maxLength) ||
      minLength < 1 ||
      maxLength < minLength ||
      maxLength > 80
    )
      throw new Error('名称长度范围须为 1 至 80 的整数。')
    const categories = [
      'character_cn',
      'character_western',
      'sect_faction',
      'technique_spell',
      'item_artifact',
      'location_realm',
    ]
    const styles = ['balanced', 'cold_sharp', 'domineering', 'ethereal', 'demonic', 'elegant']
    const style = options.style ?? 'balanced'
    if (!categories.includes(options.category) || !styles.includes(style))
      throw new Error('名称类别或词库风格无效。')
    const rng = random ?? this.randomSource,
      results: GeneratedNameItem[] = [],
      seen = new Set<string>()
    const excluded = new Set((options.excludedNames ?? []).map((name) => name.normalize('NFC')))
    for (
      let attempt = 0;
      attempt < Math.max(100, count * 100) && results.length < count;
      attempt++
    ) {
      const parts = this.parts(options, style, rng)
      const name =
        options.category === 'character_western'
          ? parts.prefix + '·' + parts.core
          : parts.prefix + parts.core + (parts.suffix ?? '')
      const length = Array.from(name).length,
        key = name.normalize('NFC')
      if (
        length < minLength ||
        length > maxLength ||
        seen.has(key) ||
        excluded.has(key) ||
        (options.forbiddenFragments ?? []).some((fragment) => fragment && name.includes(fragment))
      )
        continue
      if (options.fixedPrefix && !name.startsWith(options.fixedPrefix)) continue
      if (options.fixedKern && !name.includes(options.fixedKern)) continue
      seen.add(key)
      results.push({
        id: idGenerator.generate('name'),
        name,
        category: options.category,
        style,
        parts,
        meaningOrVibe: '词库组合候选；字义、读音、典故与是否适合人物须由作者复核。',
      })
    }
    return results
  }
  private parts(
    options: NameGenerateOptions,
    style: NameStyle,
    rng: RandomSource,
  ): { prefix: string; core: string; suffix?: string } {
    const prefix = options.fixedPrefix,
      core = options.fixedKern
    if (options.category === 'character_cn') {
      const pool =
        style === 'balanced'
          ? Object.values(lexicons.characters_by_style).flat()
          : lexicons.characters_by_style[style as keyof typeof lexicons.characters_by_style]
      return {
        prefix: prefix ?? this.pick(lexicons.surnames_cn, rng),
        core:
          core !== undefined
            ? core + this.pick(pool, rng)
            : this.pick(pool, rng) + this.pick(pool, rng),
      }
    }
    if (options.category === 'character_western') {
      const pool =
        options.gender === 'male'
          ? lexicons.firstnames_western_male
          : options.gender === 'female'
            ? lexicons.firstnames_western_female
            : [...lexicons.firstnames_western_male, ...lexicons.firstnames_western_female]
      return {
        prefix: prefix ?? this.pick(lexicons.surnames_western, rng),
        core: core ?? this.pick(pool, rng),
      }
    }
    const pools = {
      sect_faction: [lexicons.sect_prefixes, lexicons.sect_cores, lexicons.sect_suffixes],
      technique_spell: [
        lexicons.technique_prefixes,
        lexicons.technique_cores,
        lexicons.technique_suffixes,
      ],
      item_artifact: [lexicons.artifact_prefixes, lexicons.artifact_forms, []],
      location_realm: [lexicons.location_prefixes, lexicons.location_forms, []],
    }[options.category]!
    return {
      prefix: prefix ?? this.pick(pools[0], rng),
      core: core ?? this.pick(pools[1], rng),
      suffix: pools[2].length ? this.pick(pools[2], rng) : undefined,
    }
  }
}
export const nameForgeEngine = new NameForgeEngine()
