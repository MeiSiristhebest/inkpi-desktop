// Aho-Corasick 多模式字符匹配自动机
// 采用统一底层 GenericAhoCorasick 实现，增加实体指纹缓存跳过无变动重构
// 时间复杂度：构建 O(sum|L_i|)，文本扫描严格 O(N + Z)，Z 为命中数

import type { ScanHit } from '../types'
import { GenericAhoCorasick } from '../../../utils/AhoCorasick'

export class AcAutomaton {
  private engine = new GenericAhoCorasick<{ entityId: string }>()
  private lastFingerprint = ''

  /**
   * 构建 AC 自动机 Trie 树并使用 BFS 构造失败指针
   * 采用脏标记/实体指纹检查，避免无变动时高频重复构建
   * @param entities 包含主名称与所有别名的实体列表
   */
  public build(entities: Array<{ id: string; name: string; aliases?: string[] }>): void {
    const fingerprint = entities
      .map((e) => `${e.id}:${e.name}:${(e.aliases || []).join(',')}`)
      .join('|')

    if (fingerprint === this.lastFingerprint && this.engine.getPatternCount() > 0) {
      return
    }
    this.lastFingerprint = fingerprint

    const items: Array<{ keyword: string; payload: { entityId: string } }> = []

    for (const ent of entities) {
      const keys = [ent.name, ...(ent.aliases || [])]
        .map((k) => (k ? k.trim() : ''))
        .filter((k) => k.length > 0)

      for (const key of keys) {
        items.push({
          keyword: key,
          payload: { entityId: ent.id },
        })
      }
    }

    this.engine.build(items)
  }

  /**
   * O(N) 极速扫描输入文本，返回所有命中的实体及起止索引
   * @param text 正文或段落字符串
   */
  public scan(text: string): ScanHit[] {
    const matches = this.engine.scan(text)
    return matches.map((m) => ({
      entityId: m.payload.entityId,
      keyword: m.keyword,
      startIndex: m.startIndex,
      endIndex: m.endIndex,
    }))
  }

  public getPatternCount(): number {
    return this.engine.getPatternCount()
  }
}
