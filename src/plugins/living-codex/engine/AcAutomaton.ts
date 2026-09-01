// Aho-Corasick 多模式字符匹配自动机
// 时间复杂度：构建 O(sum|L_i|)，文本扫描严格 O(N + Z)，Z 为命中数

import type { ScanHit } from '../types'

interface ACNode {
  children: Map<string, ACNode>
  fail: ACNode | null
  outputs: Array<{ entityId: string; keyword: string }>
}

export class AcAutomaton {
  private root: ACNode = { children: new Map(), fail: null, outputs: [] }
  private patternCount = 0

  /**
   * 构建 AC 自动机 Trie 树并使用 BFS 构造失败指针
   * @param entities 包含主名称与所有别名的实体列表
   */
  public build(entities: Array<{ id: string; name: string; aliases?: string[] }>): void {
    this.root = { children: new Map(), fail: null, outputs: [] }
    this.patternCount = 0

    // 1. 插入所有词条（主名称 + 全部别名）
    for (const ent of entities) {
      const keys = [ent.name, ...(ent.aliases || [])]
        .map((k) => (k ? k.trim() : ''))
        .filter((k) => k.length > 0)

      for (const key of keys) {
        let curr = this.root
        for (const char of key) {
          if (!curr.children.has(char)) {
            curr.children.set(char, { children: new Map(), fail: null, outputs: [] })
          }
          curr = curr.children.get(char)!
        }
        curr.outputs.push({ entityId: ent.id, keyword: key })
        this.patternCount++
      }
    }

    // 2. BFS 队列构建 Fail 指针
    const queue: ACNode[] = []
    for (const child of this.root.children.values()) {
      child.fail = this.root
      queue.push(child)
    }

    while (queue.length > 0) {
      const curr = queue.shift()!
      for (const [char, child] of curr.children.entries()) {
        let fail = curr.fail
        while (fail !== null && !fail.children.has(char)) {
          fail = fail.fail
        }
        child.fail = fail ? fail.children.get(char)! : this.root

        // 合并后缀命中输出链
        if (child.fail.outputs.length > 0) {
          child.outputs.push(...child.fail.outputs)
        }
        queue.push(child)
      }
    }
  }

  /**
   * O(N) 极速扫描输入文本，返回所有命中的实体及起止索引
   * @param text 正文或段落字符串
   */
  public scan(text: string): ScanHit[] {
    if (!text || this.patternCount === 0) return []
    const hits: ScanHit[] = []
    let curr = this.root

    for (let i = 0; i < text.length; i++) {
      const char = text[i]
      while (curr !== this.root && !curr.children.has(char)) {
        curr = curr.fail || this.root
      }
      curr = curr.children.get(char) || this.root

      if (curr.outputs.length > 0) {
        for (const out of curr.outputs) {
          hits.push({
            entityId: out.entityId,
            keyword: out.keyword,
            startIndex: i - out.keyword.length + 1,
            endIndex: i + 1,
          })
        }
      }
    }

    return hits
  }

  public getPatternCount(): number {
    return this.patternCount
  }
}
