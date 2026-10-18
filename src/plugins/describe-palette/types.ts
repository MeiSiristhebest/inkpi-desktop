export type SenseType = 'sight' | 'sound' | 'scent' | 'taste' | 'touch' | 'metaphor'
export type GenreType =
  'all' | 'xianxia' | 'fantasy' | 'scifi' | 'urban' | 'wuxia' | 'horror' | 'history'
export interface SensorySnippet {
  id: string
  primarySense: SenseType
  secondarySenses?: SenseType[]
  genre: GenreType
  category: string
  keywords: string[]
  text: string
  exampleContext?: string
  tags?: string[]
  isCustom?: boolean
}
export interface SensoryRadarScore {
  sight: number
  sound: number
  scent: number
  taste: number
  touch: number
  metaphor: number
}
export interface SensoryDiagnosisReport {
  totalWordCount: number
  radar: SensoryRadarScore
  radarPercentages: SensoryRadarScore
  matches: Array<{ sense: SenseType; quote: string; start: number; end: number }>
  inputStatus: 'empty' | 'provided'
  advice: string
}
