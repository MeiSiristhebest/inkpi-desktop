// name-forge 中西奇幻起名姬类型定义

export type NameCategory =
  | 'character_cn'       // 修仙/东方人名
  | 'character_western'  // 西方/奇幻人名
  | 'sect_faction'       // 宗门/帮派/势力
  | 'technique_spell'    // 功法/神通/禁术
  | 'item_artifact'      // 法宝/神兵/灵器
  | 'location_realm'     // 秘境/洞府/界域

export type NameStyle =
  | 'balanced'    // 平衡中正
  | 'cold_sharp'  // 冷峻肃杀
  | 'domineering' // 霸道狂傲
  | 'ethereal'    // 飘逸出尘
  | 'demonic'     // 邪魅诡异
  | 'elegant'     // 古雅温润

export interface NameGenerateOptions {
  category: NameCategory
  style?: NameStyle
  count?: number
  fixedPrefix?: string  // 固定前缀或姓氏
  fixedKern?: string    // 固定字辈或核心意象
  gender?: 'male' | 'female' | 'neutral'
}

export interface GeneratedNameItem {
  id: string
  name: string
  category: NameCategory
  style: NameStyle
  parts: {
    prefix?: string
    core: string
    suffix?: string
  }
  phoneticsScore: number
  meaningOrVibe: string
}
