export type ToneType = 'ping' | 'ze' | 'unknown'
/** Groups explicitly supplied modern Mandarin tones. No character-code or dictionary guesses. */
export class PhoneticsEvaluator {
  static getTone(_char: string, reading?: number | null): ToneType {
    return reading === 1 || reading === 2
      ? 'ping'
      : reading === 3 || reading === 4
        ? 'ze'
        : 'unknown'
  }
  static analyzeToneFluctuation(name: string, readings?: ReadonlyArray<number | null>) {
    const chars = Array.from(name)
    if (
      readings &&
      (readings.length !== chars.length ||
        readings.some(
          (value) => value !== null && (!Number.isInteger(value) || value < 0 || value > 4),
        ))
    )
      throw new Error('每个字符填写一个现代声调 1 至 4；未知或轻声用 0 或空值。')
    const tones = chars.map((char, index) => this.getTone(char, readings?.[index]))
    const known = tones.filter((tone) => tone !== 'unknown').length
    const complete = known === tones.length && tones.length > 0
    return {
      pattern: tones.map((tone) => (tone === 'ping' ? '平' : tone === 'ze' ? '仄' : '?')).join(''),
      isAlternating:
        complete && tones.length >= 2
          ? tones.every((tone, index) => index === 0 || tone !== tones[index - 1])
          : null,
      hasAdjacentIdentical: chars.some((char, index) => index > 0 && char === chars[index - 1]),
      cadence: tones.at(-1) ?? 'empty',
      pingRatio: complete ? tones.filter((tone) => tone === 'ping').length / tones.length : null,
      knownToneCount: known,
      totalCharacters: chars.length,
    }
  }
  static getTonePattern(name: string, readings?: ReadonlyArray<number | null>): string {
    return this.analyzeToneFluctuation(name, readings).pattern
  }
  static evaluatePhonetics(name: string, readings?: ReadonlyArray<number | null>) {
    return {
      ...this.analyzeToneFluctuation(name, readings),
      readingsSource: readings ? 'author_provided' : 'unknown',
    }
  }
}
