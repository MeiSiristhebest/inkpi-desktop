export type PlatformPresetId =
  | 'qidian-standard'
  | 'jinjiang-clean'
  | 'fanqie-compact'
  | 'zongheng-classic'
  | 'print-typeset'

export interface PlatformPresetConfig {
  id: PlatformPresetId
  name: string
  description: string
  indentSpaces: number // 首行缩进空格数 (通常全角 2 格)
  paragraphSpacing: number // 段落间距 (行)
  dialogueStyle: 'standard-quotes' | 'dash' | 'bracket'
  punctuationNormalization: boolean // 标点正规化（中文双引号、省略号、破折号修复）
  antiSpiderWatermark: boolean // 防盗网文微水印插入
  forbiddenWordCheck: boolean // 平台违禁敏感词预警
}

export interface PressExportConfigRecord {
  projectId: string
  activePresetId: PlatformPresetId
  customIndent: number
  customParagraphSpacing: number
  customDialogueStyle: 'standard-quotes' | 'dash' | 'bracket'
  enablePunctuationFix: boolean
  enableSensitiveFilter: boolean
  updatedAt: number
}

export interface PressConfigRepository {
  get(projectId: string): Promise<PressExportConfigRecord | undefined>
  save(record: PressExportConfigRecord): Promise<void>
}
