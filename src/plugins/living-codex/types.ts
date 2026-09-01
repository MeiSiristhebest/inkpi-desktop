// 活体世界观实体图谱 (living-codex) 领域模型

export type CodexCategory =
  | 'character' // 角色卡 (主要/次要/NPC)
  | 'faction'   // 国家势力 (王朝/宗门/世家/商会/魔道)
  | 'location'  // 地理风物 (大陆/区域/城市/秘境/禁地)
  | 'item'      // 物品资源 (功法/法宝/丹药/材料/传承)
  | 'race'      // 种族生物 (人族/神族/魔兽/异种)
  | 'history'   // 历史事件 (编年史/真相vs民间流传)
  | 'term'      // 名词术语 (专有名词/法则/称谓)

export interface EntityRelation {
  targetId: string
  targetName: string
  relationType: string // 如 '宿敌' | '盟友' | '师徒' | '持有者' | '上级' | '从属'
  description?: string
}

export interface CodexEntity {
  id: string
  projectId: string
  name: string
  aliases: string[] // 别名、绰号、简称 (如: ["陈渊", "渊哥", "废脉少主"])
  category: CodexCategory
  parentId?: string // 树形层级上级 (如: 宗门 -> 杂役院; 中州 -> 云州)
  
  // 结构化业务属性 (如境界、品级、危险度、保密等级、首次出场章节)
  attributes: Record<string, string | number | boolean>
  
  // 图谱关联边
  relations: EntityRelation[]
  
  // 供 AI 消费的高密度摘要 (<= 50 字)
  summary: string
  
  // 作家完整设定正文 (Markdown 格式)
  detailMarkdown?: string
  
  createdAt: number
  updatedAt: number
}

export interface ScanHit {
  entityId: string
  keyword: string
  startIndex: number
  endIndex: number
}

export interface CodexSliceResult {
  matchedEntities: CodexEntity[]
  xmlContext: string
  totalEstimatedTokens: number
}
