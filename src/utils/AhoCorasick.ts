/**
 * 通用高性能 Aho-Corasick 多模式字符串匹配自动机
 *
 * 时间复杂度：
 * - 字典树及失败指针构建：O(Σ |pattern_i|)
 * - 文本扫描：严格 O(N + Z)，其中 N 为文本长度，Z 为命中总次数
 *
 * 特性：
 * - 强类型泛型 Payload 支持，附带任意用户元数据
 * - 自动消除前后缀冗余与空词保护
 * - 支持线性单次扫描并准确输出命中区间的起止索引 [startIndex, endIndex)
 */

export interface ACMatch<T = unknown> {
  keyword: string
  payload: T
  startIndex: number
  endIndex: number // exclusive
}

interface ACInternalNode<T> {
  children: Map<string, ACInternalNode<T>>
  fail: ACInternalNode<T> | null
  outputs: Array<{ keyword: string; payload: T }>
}

export class GenericAhoCorasick<T = unknown> {
  private root: ACInternalNode<T> = {
    children: new Map(),
    fail: null,
    outputs: [],
  }
  private patternCount = 0

  /**
   * 清空并重新根据输入的词条集构建自动机
   * @param items 包含 keyword 和对应 payload 的词条集合
   */
  public build(items: Array<{ keyword: string; payload: T }>): void {
    this.root = {
      children: new Map(),
      fail: null,
      outputs: [],
    }
    this.patternCount = 0

    // 1. 插入所有词条到 Trie
    for (const item of items) {
      const word = item.keyword ? item.keyword.trim() : ''
      if (!word) continue

      let curr = this.root
      for (const char of word) {
        let child = curr.children.get(char)
        if (!child) {
          child = {
            children: new Map(),
            fail: null,
            outputs: [],
          }
          curr.children.set(char, child)
        }
        curr = child
      }

      curr.outputs.push({
        keyword: word,
        payload: item.payload,
      })
      this.patternCount++
    }

    // 2. BFS 队列构建失败指针 (Fail transitions)
    const queue: Array<ACInternalNode<T>> = []
    for (const child of this.root.children.values()) {
      child.fail = this.root
      queue.push(child)
    }

    while (queue.length > 0) {
      const curr = queue.shift()
      if (!curr) continue

      for (const [char, child] of curr.children.entries()) {
        let fail = curr.fail
        while (fail !== null && !fail.children.has(char)) {
          fail = fail.fail
        }
        const failTarget = fail ? fail.children.get(char) : null
        child.fail = failTarget || this.root

        // 合并 Fail 节点的后缀输出链，保证所有子串命中均被捕获
        if (child.fail.outputs.length > 0) {
          child.outputs.push(...child.fail.outputs)
        }

        queue.push(child)
      }
    }
  }

  /**
   * O(N + Z) 极速扫描输入文本
   */
  public scan(text: string): ACMatch<T>[] {
    if (!text || this.patternCount === 0) return []

    const matches: ACMatch<T>[] = []
    let curr = this.root

    for (let i = 0; i < text.length; i++) {
      const char = text[i]
      while (curr !== this.root && !curr.children.has(char)) {
        curr = curr.fail || this.root
      }
      curr = curr.children.get(char) || this.root

      if (curr.outputs.length > 0) {
        for (const out of curr.outputs) {
          matches.push({
            keyword: out.keyword,
            payload: out.payload,
            startIndex: i - out.keyword.length + 1,
            endIndex: i + 1,
          })
        }
      }
    }

    return matches
  }

  public getPatternCount(): number {
    return this.patternCount
  }
}
