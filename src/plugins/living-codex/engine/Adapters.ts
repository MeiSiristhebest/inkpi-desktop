// 8 大世界观业务表单与统一 CodexEntity 的双向适配转换器。
//
// 以纯函数（而非静态工具类）实现，符合「组合优于继承 / 无状态工具」原则；
// 时间戳通过 now 参数注入，避免在纯转换逻辑中直接取系统时间，便于测试确定性。

import type { CodexEntity, CodexCategory, EntityRelation } from '../types'
import { clock } from '../../../adapters/clock'

export interface CardRecordLike {
  id: string
  projectId: string
  tabId: string
  name: string
  data: Record<string, any>
  order?: number
}

export interface TableRowLike {
  id: string
  projectId: string
  tabId: string
  data: Record<string, any>
}

/** 将原始卡片记录 (CardRecord) 转换为标准 CodexEntity */
export const cardRecordToCodexEntity = (
  card: CardRecordLike,
  allRelations: Array<{ personA: string; personB: string; relType: string; status?: string }> = [],
  now: number = clock.now(),
): CodexEntity => {
  const data = card.data || {}
  const aliases = extractAliases(data['一、基础信息::别称'] || data['别称'] || '')
  const category: CodexCategory = 'character'

  const attributes: Record<string, string | number | boolean> = {}
  if (data['一、基础信息::身份定位'] || data['身份定位']) attributes['identity'] = data['一、基础信息::身份定位'] || data['身份定位']
  if (data['三、能力与成长::实力境界'] || data['实力境界']) attributes['realm'] = data['三、能力与成长::实力境界'] || data['实力境界']
  if (data['一、基础信息::保密等级'] || data['保密等级']) attributes['securityLevel'] = data['一、基础信息::保密等级'] || data['保密等级']
  if (data['一、基础信息::人物状态'] || data['人物状态']) attributes['status'] = data['一、基础信息::人物状态'] || data['人物状态']

  const summary = buildCharacterSummary(card.name, data)

  const relations: EntityRelation[] = []
  for (const rel of allRelations) {
    if (rel.personA === card.name) {
      relations.push({
        targetId: normalizeEntityKey(rel.personB),
        targetName: rel.personB,
        relationType: rel.relType,
        description: rel.status,
      })
    } else if (rel.personB === card.name) {
      relations.push({
        targetId: normalizeEntityKey(rel.personA),
        targetName: rel.personA,
        relationType: `被${rel.relType}`,
        description: rel.status,
      })
    }
  }

  return {
    id: card.id,
    projectId: card.projectId,
    name: card.name,
    aliases,
    category,
    attributes,
    relations,
    summary,
    detailMarkdown: buildMarkdownDetails(data),
    createdAt: now,
    updatedAt: now,
  }
}

/** 将表格行记录 (TableRowRecord 如 nations, geography, items, races, terms, history) 转换为 CodexEntity */
export const tableRowToCodexEntity = (
  row: TableRowLike,
  now: number = clock.now(),
): CodexEntity => {
  const data = row.data || {}
  const name = data['名称'] || data['事件名称'] || data['术语名称'] || '未命名'
  const aliases = extractAliases(data['别称'] || '')
  const category = mapTabIdToCategory(row.tabId)
  const parentId = data['上级'] || data['层级归属'] || undefined

  const attributes: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      attributes[k] = v
    }
  }

  const relations: EntityRelation[] = []
  if (data['势力归属']) {
    relations.push({ targetId: data['势力归属'], targetName: data['势力归属'], relationType: '势力归属' })
  }
  if (data['当前持有者']) {
    relations.push({ targetId: data['当前持有者'], targetName: data['当前持有者'], relationType: '持有者' })
  }
  if (data['地理位置']) {
    relations.push({ targetId: data['地理位置'], targetName: data['地理位置'], relationType: '位于' })
  }

  const summary = buildTableSummary(category, data)

  return {
    id: row.id,
    projectId: row.projectId,
    name,
    aliases,
    category,
    parentId,
    attributes,
    relations,
    summary,
    detailMarkdown: Object.entries(data).map(([k, v]) => `**${k}**: ${v}`).join('\n\n'),
    createdAt: now,
    updatedAt: now,
  }
}

// §3.2：类别映射表驱动（新增 tab 类型只加一条记录，无需改 switch）
const TAB_CATEGORY_MAP: Record<string, CodexCategory> = {
  nations: 'faction',
  geography: 'location',
  items: 'item',
  races: 'race',
  history: 'history',
  terms: 'term',
}

const mapTabIdToCategory = (tabId: string): CodexCategory => TAB_CATEGORY_MAP[tabId] ?? 'term'

const extractAliases = (raw: string): string[] => {
  if (!raw) return []
  return raw
    .split(/[,，、/|;\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

// 关系图边的引用键：以规范化后的名称作为稳定键（去除空白、统一小写），
// 避免直接以「原始人名展示文本」充当实体 ID（评审 §4.3）。
const normalizeEntityKey = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, '-')

const buildCharacterSummary = (name: string, data: Record<string, any>): string => {
  const parts: string[] = []
  const identity = data['一、基础信息::身份定位'] || data['身份定位'] || data['身份']
  const realm = data['三、能力与成长::实力境界'] || data['实力境界']
  const personality = data['二、性格与内心::核心性格'] || data['二、性格与动机::核心性格'] || data['一句话性格']
  const role = data['五、剧情功能::角色弧光'] || data['剧情功能'] || data['功能定位']

  if (identity) parts.push(identity)
  if (realm) parts.push(realm)
  if (personality) parts.push(personality)
  if (role) parts.push(role)

  return parts.length > 0 ? parts.join(' | ') : `${name} 角色档案`
}

// §3.2：摘要策略注册表（组合优于分支，新增类别只注册一个 Summarizer）
const SUMMARIZERS: Record<CodexCategory, (data: Record<string, any>) => string> = {
  faction: (data) => `${data['类别'] || '势力'} · ${data['实力等级'] || ''} · 核心:${data['镇派功法/核心武力'] || '无'}`,
  location: (data) => `${data['类别'] || '地点'} · 危险:${data['危险等级'] || '普通'} · 行程:${data['距离与行程时间'] || '未知'}`,
  item: (data) => `${data['类别'] || '物品'} · 品级:${data['品级'] || '普通'} · 效果:${data['能力/效果'] || '无'}`,
  race: (data) => `${data['类别'] || '种族'} · 威胁:${data['威胁等级'] || '普通'} · 特性:${data['能力特性'] || '无'}`,
  history: (data) => `时间:${data['故事内时间'] || '上古'} · 真相:${data['事件经过（真相）'] || '未知'}`,
  term: (data) => `${data['类别'] || '术语'} · 定义:${data['定义（一句话）'] || '无'}`,
  character: (data) => `${data['类别'] || '角色'} · ${data['身份定位'] || ''}`,
}

const buildTableSummary = (category: CodexCategory, data: Record<string, any>): string =>
  SUMMARIZERS[category]?.(data) ?? Object.values(data).slice(0, 2).join(' · ')

const buildMarkdownDetails = (data: Record<string, any>): string => {
  return Object.entries(data)
    .map(([k, v]) => `### ${k}\n${v}`)
    .join('\n\n')
}
