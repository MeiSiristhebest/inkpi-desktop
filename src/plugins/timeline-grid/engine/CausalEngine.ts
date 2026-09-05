// 时空因果大纲核心引擎
// 基于有向无环图 (DAG) 的因果环路检测、时间悖论分析、章节碰撞与情感张力计算

import type { TimelineNode, NarrativeConflict, EmotionalCurvePoint } from '../types'

export class CausalEngine {
  /**
   * Kahn 算法：O(V + E) 拓扑排序与环路检测
   * 如果存在环，返回构成环路的事件节点冲突警报
   */
  public detectCausalCycles(nodes: TimelineNode[]): NarrativeConflict[] {
    if (nodes.length === 0) return []

    const nodeMap = new Map<string, TimelineNode>()
    const inDegree = new Map<string, number>()
    const adjList = new Map<string, string[]>() // pre -> dependent nodes

    for (const node of nodes) {
      nodeMap.set(node.id, node)
      inDegree.set(node.id, 0)
      adjList.set(node.id, [])
    }

    // 建立入度表与邻接表：prerequisite -> node.id
    for (const node of nodes) {
      for (const preId of node.prerequisites || []) {
        if (nodeMap.has(preId)) {
          inDegree.set(node.id, (inDegree.get(node.id) || 0) + 1)
          adjList.get(preId)!.push(node.id)
        }
      }
    }

    // 初始入度为 0 的节点入队
    const queue: string[] = []
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) queue.push(id)
    }

    let visitedCount = 0
    while (queue.length > 0) {
      const u = queue.shift()!
      visitedCount++

      for (const v of adjList.get(u) || []) {
        const currentDeg = (inDegree.get(v) || 0) - 1
        inDegree.set(v, currentDeg)
        if (currentDeg === 0) {
          queue.push(v)
        }
      }
    }

    // 若访问节点数 < 总节点数，则未被访问（入度 > 0）的节点构成环路
    if (visitedCount < nodes.length) {
      const cycleNodeIds: string[] = []
      for (const [id, deg] of inDegree.entries()) {
        if (deg > 0) cycleNodeIds.push(id)
      }

      const cycleTitles = cycleNodeIds
        .map((id) => `「${nodeMap.get(id)?.eventTitle || id}」`)
        .slice(0, 4)
        .join(' ↔ ')

      return [
        {
          type: 'causal_cycle',
          nodeIds: cycleNodeIds,
          description: `检测到因果死循环悖论：${cycleTitles} 相互因果依赖，无法确定叙事先后顺序。`,
          severity: 'error',
        },
      ]
    }

    return []
  }

  /**
   * 时间悖论检测：前置事件如果在章节时间轴上晚于后置事件发生，构成因果倒置
   */
  public detectTemporalParadoxes(nodes: TimelineNode[]): NarrativeConflict[] {
    const nodeMap = new Map<string, TimelineNode>(nodes.map((n) => [n.id, n]))
    const conflicts: NarrativeConflict[] = []

    for (const node of nodes) {
      for (const preId of node.prerequisites || []) {
        const preNode = nodeMap.get(preId)
        if (preNode && preNode.chapterOrder >= node.chapterOrder) {
          conflicts.push({
            type: 'temporal_paradox',
            nodeIds: [preId, node.id],
            description: `因果倒置：事件「${node.eventTitle}」(第${node.chapterOrder}章) 依赖前置事件「${preNode.eventTitle}」(第${preNode.chapterOrder}章)，但前置事件发生在后！`,
            severity: 'error',
          })
        }
      }
    }

    return conflicts
  }

  /**
   * 章节碰撞检测：同一条叙事动线在同一章节出现多个并发大纲节点
   */
  public detectChapterCollisions(nodes: TimelineNode[]): NarrativeConflict[] {
    const threadChapterMap = new Map<string, TimelineNode[]>()

    for (const node of nodes) {
      const key = `${node.threadId}__ch_${node.chapterOrder}`
      if (!threadChapterMap.has(key)) {
        threadChapterMap.set(key, [])
      }
      threadChapterMap.get(key)!.push(node)
    }

    const conflicts: NarrativeConflict[] = []
    for (const [, group] of threadChapterMap.entries()) {
      if (group.length > 1) {
        conflicts.push({
          type: 'chapter_collision',
          nodeIds: group.map((n) => n.id),
          description: `单线章节碰撞：第 ${group[0].chapterOrder} 章在同一直线上定义了 ${group.length} 个并发事件节点 (${group.map((g) => `「${g.eventTitle}」`).join('、')})。`,
          severity: 'warning',
        })
      }
    }

    return conflicts
  }

  /**
   * 执行综合因果检查
   */
  public auditAllConflicts(nodes: TimelineNode[]): NarrativeConflict[] {
    return [
      ...this.detectCausalCycles(nodes),
      ...this.detectTemporalParadoxes(nodes),
      ...this.detectChapterCollisions(nodes),
    ]
  }

  /**
   * 拓扑排序：返回合法的因果推进序列
   */
  public topoSort(nodes: TimelineNode[]): TimelineNode[] | null {
    if (nodes.length === 0) return []

    const nodeMap = new Map<string, TimelineNode>()
    const inDegree = new Map<string, number>()
    const adjList = new Map<string, string[]>()

    for (const node of nodes) {
      nodeMap.set(node.id, node)
      inDegree.set(node.id, 0)
      adjList.set(node.id, [])
    }

    for (const node of nodes) {
      for (const preId of node.prerequisites || []) {
        if (nodeMap.has(preId)) {
          inDegree.set(node.id, (inDegree.get(node.id) || 0) + 1)
          adjList.get(preId)!.push(node.id)
        }
      }
    }

    const queue: string[] = []
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) queue.push(id)
    }

    const result: TimelineNode[] = []
    while (queue.length > 0) {
      const u = queue.shift()!
      result.push(nodeMap.get(u)!)

      for (const v of adjList.get(u) || []) {
        const deg = (inDegree.get(v) || 0) - 1
        inDegree.set(v, deg)
        if (deg === 0) queue.push(v)
      }
    }

    return result.length === nodes.length ? result : null
  }

  /**
   * 计算章节维度的滑动窗口情感张力曲线
   * 窗口大小 windowSize，步长 1 章
   */
  public computeEmotionalCurve(
    nodes: TimelineNode[],
    windowSize: number = 5,
  ): EmotionalCurvePoint[] {
    if (nodes.length === 0) return []

    // 统计每章的情感均值
    const chapterPolarities = new Map<number, number[]>()
    for (const node of nodes) {
      const list = chapterPolarities.get(node.chapterOrder) || []
      list.push(node.emotionalPolarity ?? 0)
      chapterPolarities.set(node.chapterOrder, list)
    }

    const chapters = Array.from(chapterPolarities.keys()).sort((a, b) => a - b)
    if (chapters.length === 0) return []

    const minCh = chapters[0]
    const maxCh = chapters[chapters.length - 1]
    const points: EmotionalCurvePoint[] = []

    for (let c = minCh; c <= maxCh; c++) {
      let sum = 0
      let count = 0
      for (
        let w = Math.max(minCh, c - Math.floor(windowSize / 2));
        w <= Math.min(maxCh, c + Math.floor(windowSize / 2));
        w++
      ) {
        const vals = chapterPolarities.get(w)
        if (vals && vals.length > 0) {
          sum += vals.reduce((a, b) => a + b, 0)
          count += vals.length
        }
      }
      points.push({
        chapter: c,
        averagePolarity: count > 0 ? Number((sum / count).toFixed(2)) : 0,
      })
    }

    return points
  }
}

export const causalEngine = new CausalEngine()
