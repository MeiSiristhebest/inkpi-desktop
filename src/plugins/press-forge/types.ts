import type { PlatformPresetId } from '../../ports/pressConfigRepository'

export interface TypesetResult {
  formattedText: string
  lineCount: number
  characterCount: number
  warnings: string[]
  fixedPunctuationCount: number
}

export interface PressFormatOptions {
  presetId: PlatformPresetId
  indentSpaces: number
  paragraphSpacing: number
  dialogueStyle: 'standard-quotes' | 'dash' | 'bracket'
  fixPunctuation: boolean
  checkSensitiveWords: boolean
}
