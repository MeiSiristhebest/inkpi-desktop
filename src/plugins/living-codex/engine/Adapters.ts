// 8 大世界观业务表单与统一 CodexEntity 的双向适配转换器

import type { CodexEntity, CodexCategory, EntityRelation } from '../types'

export class CodexAdapters {
  /**
   * 将原始卡片记录 (CardRecord) 转换为标准 CodexEntity
   */
  public static fromCardRecord(
    card: { id: string; projectId: string; tabId: string; name: string; data: Record<string, any>; order?: number },
    allRelations: Array<{ personA: string; personB: string; relType: string; status?: string }> = []
  ): CodexEntity {
    const data = card.data || {}
    const aliases = this.extractAliases(data['一、基础信息::别称'] || data['别称'] || '')
    const category: CodexCategory = 'character'

    // 组装业务属性
    const attributes: Record<string, string | number | boolean> = {}
    if (data['一、基础信息::身份定位'] || data['身份定位']) attributes['identity'] = data['一、基础信息::身份定位'] || data['身份定位']
    if (data['三、能力与成长::实力境界'] || data['实力境界']) attributes['realm'] = data['三、能力与成长::实力境界'] || data['实力境界']
    if (data['一、基础信息::保密等级'] || data['保密等级']) attributes['securityLevel'] = data['一、基础信息::保密等级'] || data['保密等级']
    if (data['一、基础信息::人物状态'] || data['人物状态']) attributes['status'] = data['一、基础信息::人物状态'] || data['人物状态']

    // 提炼高密度摘要
    const summary = this.buildCharacterSummary(card.name, data)

    // 提取关联边 (从 relations 表与所属势力/地理中提取)
    const relations: EntityRelation[] = []
    for (const rel of allRelations) {
      if (rel.personA === card.name) {
        relations.push({
          targetId: rel.personB,
          targetName: rel.personB,
          relationType: rel.relType,
          description: rel.status,
        })
      } else if (rel.personB === card.name) {
        relations.push({
          targetId: rel.personA,
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
      detailMarkdown: this.buildMarkdownDetails(data),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
  }

  /**
   * 将表格行记录 (TableRowRecord 如 nations, geography, items, races, terms, history) 转换为 CodexEntity
   */
  public static fromTableRow(
    row: { id: string; projectId: string; tabId: string; data: Record<string, any> }
  ): CodexEntity {
    const data = row.data || {}
    const name = data['名称'] || data['事件名称'] || data['术语名称'] || '未命名'
    const aliases = this.extractAliases(data['别称'] || '')
    const category = this.mapTabIdToCategory(row.tabId)
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

    const summary = this.buildTableSummary(category, data)

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
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
  }

  private static mapTabIdToCategory(tabId: string): CodexCategory {
    switch (tabId) {
      case 'nations':
        return 'faction'
      case 'geography':
        return 'location'
      case 'items':
        return 'item'
      case 'races':
        return 'race'
      case 'history':
        return 'history'
      case 'terms':
        return 'term'
      default:
        return 'term'
    }
  }

  private static extractAliases(raw: string): string[] {
    if (!raw) return []
    return raw
      .split(/[,，、/|;\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  }

  private static buildCharacterSummary(name: string, data: Record<string, any>): string {
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

  private static buildTableSummary(category: CodexCategory, data: Record<string, any>): string {
    switch (category) {
      case 'faction':
        return `${data['类别'] || '势力'} · ${data['实力等级'] || ''} · 核心:${data['镇派功法/核心武力'] || '无'}`
      case 'location':
        return `${data['类别'] || '地点'} · 危险:${data['危险等级'] || '普通'} · 行程:${data['距离与行程时间'] || '未知'}`
      case 'item':
        return `${data['类别'] || '物品'} · 品级:${data['品级'] || '普通'} · 效果:${data['能力/效果'] || '无'}`
      case 'race':
        return `${data['类别'] || '种族'} · 威胁:${data['威胁等级'] || '普通'} · 特性:${data['能力特性'] || '无'}`
      case 'history':
        return `时间:${data['故事内时间'] || '上古'} · 真相:${data['事件经过（真相）'] || '未知'}`
      case 'term':
        return `${data['类别'] || '术语'} · 定义:${data['定义（一句话）'] || '无'}`
      default:
        return Object.values(data).slice(0, 2).join(' · ')
    }
  }

  private static buildMarkdownDetails(data: Record<string, any>): string {
    return Object.entries(data)
      .map(([k, v]) => `### ${k}\n${v}`)
      .join('\n\n')
  }
}
