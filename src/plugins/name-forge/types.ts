export type NameCategory =
  | 'character_cn'
  | 'character_western'
  | 'sect_faction'
  | 'technique_spell'
  | 'item_artifact'
  | 'location_realm'
export type NameStyle =
  'balanced' | 'cold_sharp' | 'domineering' | 'ethereal' | 'demonic' | 'elegant'
export interface NameGenerateOptions {
  category: NameCategory
  style?: NameStyle
  count?: number
  fixedPrefix?: string
  fixedKern?: string
  gender?: 'male' | 'female' | 'neutral'
  minLength?: number
  maxLength?: number
  excludedNames?: string[]
  forbiddenFragments?: string[]
}
export interface GeneratedNameItem {
  id: string
  name: string
  category: NameCategory
  style: NameStyle
  parts: { prefix?: string; core: string; suffix?: string }
  meaningOrVibe: string
}
