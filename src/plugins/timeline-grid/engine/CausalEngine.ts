// 时空因果大纲核心引擎
// 基于有向无环图 (DAG) 的因果环路检测、时间悖论分析、章节碰撞与情感张力计算

import type { TimelineNode, NarrativeConflict, EmotionalCurvePoint } from '../types'

export class CausalEngine {
  private validateDefinitions(nodes: TimelineNode[]): NarrativeConflict[] {
    const ids = new Set<string>(),
      conflicts: NarrativeConflict[] = []
    for (const node of nodes) {
      if (!node.id.trim() || ids.has(node.id))
        conflicts.push({
          type: 'invalid_definition',
          nodeIds: [node.id],
          severity: 'error',
          description: '事件 ID 为空或重复，无法确定依赖对象：' + node.id,
        })
      ids.add(node.id)
    }
    for (const node of nodes)
      for (const prerequisite of new Set(node.prerequisites ?? [])) {
        if (!ids.has(prerequisite))
          conflicts.push({
            type: 'missing_prerequisite',
            nodeIds: [node.id],
            severity: 'error',
            description:
              '事件「' +
              node.eventTitle +
              '」依赖未登记事件 ' +
              prerequisite +
              '，无法给出完整推进顺序。',
          })
      }
    return conflicts
  }

  /**
   * Kahn 算法：O(V + E) 拓扑排序与环路检测
   * 如果存在环，返回构成环路的事件节点冲突警报
   */
  public detectCausalCycles(nodes: TimelineNode[]): NarrativeConflict[] {
    const nodeMap = new Map(nodes.map((node) => [node.id, node]))
    if (nodeMap.size !== nodes.length) return []
    const adjacency = new Map(
      nodes.map((node) => [
        node.id,
        [...new Set(node.prerequisites ?? [])].filter((id) => nodeMap.has(id)),
      ]),
    )
    const reverse = new Map(nodes.map((node) => [node.id, [] as string[]]))
    for (const [id, prerequisites] of adjacency)
      for (const prerequisite of prerequisites) reverse.get(prerequisite)!.push(id)
    const visited = new Set<string>(),
      order: string[] = []
    for (const id of nodeMap.keys()) {
      if (visited.has(id)) continue
      visited.add(id)
      const stack = [{ id, next: 0 }]
      while (stack.length) {
        const frame = stack[stack.length - 1]
        const neighbors = adjacency.get(frame.id)!
        if (frame.next < neighbors.length) {
          const next = neighbors[frame.next++]
          if (!visited.has(next)) {
            visited.add(next)
            stack.push({ id: next, next: 0 })
          }
        } else {
          order.push(frame.id)
          stack.pop()
        }
      }
    }
    visited.clear()
    const conflicts: NarrativeConflict[] = []
    for (const id of order.reverse()) {
      if (visited.has(id)) continue
      const component: string[] = [],
        pending = [id]
      visited.add(id)
      while (pending.length) {
        const current = pending.pop()!
        component.push(current)
        for (const next of reverse.get(current)!)
          if (!visited.has(next)) {
            visited.add(next)
            pending.push(next)
          }
      }
      if (component.length > 1 || adjacency.get(id)!.includes(id)) {
        const titles = component
          .map((member) => '「' + nodeMap.get(member)!.eventTitle + '」')
          .join('、')
        conflicts.push({
          type: 'causal_cycle',
          nodeIds: component,
          severity: 'error',
          description:
            '已声明的前置关系存在环：' +
            titles +
            '。请检查依赖定义；受此环阻塞的后续节点未计为环内成员。',
        })
      }
    }
    return conflicts
  }

  /** Chapter placement can flag an ordering question, but cannot establish story time. */
  public detectTemporalParadoxes(nodes: TimelineNode[]): NarrativeConflict[] {
    const nodeMap = new Map<string, TimelineNode>(nodes.map((n) => [n.id, n]))
    const conflicts: NarrativeConflict[] = []

    for (const node of nodes) {
      for (const preId of node.prerequisites || []) {
        const preNode = nodeMap.get(preId)
        if (
          preNode &&
          preNode.id !== node.id &&
          node.chapterOrder >= 1 &&
          preNode.chapterOrder >= 1 &&
          preNode.chapterOrder >= node.chapterOrder
        ) {
          const sameChapter = preNode.chapterOrder === node.chapterOrder
          conflicts.push({
            type: 'temporal_paradox',
            nodeIds: [preId, node.id],
            description: sameChapter
              ? `前置事件「${preNode.eventTitle}」和依赖事件「${node.eventTitle}」都位于第 ${node.chapterOrder} 章。章节序号不能确定章内顺序，请核对正文。`
              : `前置事件「${preNode.eventTitle}」位于第 ${preNode.chapterOrder} 章，晚于依赖事件「${node.eventTitle}」所在的第 ${node.chapterOrder} 章。章节位置不能证明故事时间顺序；请核对正文，倒叙、回忆或不可靠叙述也可能解释此排序。`,
            severity: 'warning',
            sources: getConflictSources(preNode, node),
          })
        }
      }
    }

    return conflicts
  }

  /**
   * 章节碰撞检测：同一条叙事动线在同一章节出现多个并发大纲节点
   */
  public detectChapterCollisions(
    nodes: TimelineNode[],
    validThreadIds?: ReadonlySet<string>,
  ): NarrativeConflict[] {
    const threadChapterMap = new Map<string, TimelineNode[]>()

    for (const node of nodes) {
      if (
        node.chapterOrder < 1 ||
        (validThreadIds !== undefined && !validThreadIds.has(node.threadId))
      )
        continue
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
  public auditAllConflicts(
    nodes: TimelineNode[],
    validThreadIds?: ReadonlySet<string>,
  ): NarrativeConflict[] {
    return [
      ...this.validateDefinitions(nodes),
      ...this.detectCausalCycles(nodes),
      ...this.detectTemporalParadoxes(nodes),
      ...this.detectChapterCollisions(nodes, validThreadIds),
    ]
  }

  /**
   * 拓扑排序：返回合法的因果推进序列
   */
  public topoSort(nodes: TimelineNode[]): TimelineNode[] | null {
    if (nodes.length === 0) return []
    if (this.validateDefinitions(nodes).length) return null

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
  public computeEmotionalCurve(nodes: TimelineNode[], windowSize = 5): EmotionalCurvePoint[] {
    if (!Number.isSafeInteger(windowSize) || windowSize < 1)
      throw new RangeError('滑动窗口必须是正整数。')
    const chapterValues = new Map<number, number[]>()
    for (const node of nodes) {
      if (
        !Number.isSafeInteger(node.chapterOrder) ||
        node.chapterOrder < 1 ||
        !Number.isFinite(node.emotionalPolarity)
      )
        continue
      const list = chapterValues.get(node.chapterOrder) ?? []
      list.push(node.emotionalPolarity)
      chapterValues.set(node.chapterOrder, list)
    }
    const chapters = [...chapterValues.keys()].sort((a, b) => a - b)
    const before = Math.floor((windowSize - 1) / 2),
      after = windowSize - 1 - before
    return chapters.map((chapter) => {
      const values = chapters
        .filter((other) => other >= chapter - before && other <= chapter + after)
        .flatMap((other) => chapterValues.get(other)!)
      return {
        chapter,
        averagePolarity: Number(
          (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2),
        ),
      }
    })
  }
}

function getConflictSources(
  prerequisite: TimelineNode,
  dependent: TimelineNode,
): NonNullable<NarrativeConflict['sources']> {
  return [prerequisite, dependent].flatMap((node) => {
    const provenance = node.provenance
    if (
      !provenance ||
      (!provenance.sourceDocumentId &&
        !provenance.sourceBlockId &&
        provenance.sourceRevision === undefined &&
        !provenance.evidence?.length)
    ) {
      return []
    }
    return [
      {
        eventTitle: node.eventTitle,
        ...(provenance.sourceDocumentId ? { sourceDocumentId: provenance.sourceDocumentId } : {}),
        ...(provenance.sourceBlockId ? { sourceBlockId: provenance.sourceBlockId } : {}),
        ...(provenance.sourceRevision !== undefined
          ? { sourceRevision: provenance.sourceRevision }
          : {}),
        ...(provenance.evidence
          ? { evidence: provenance.evidence.map((item) => ({ ...item })) }
          : {}),
      },
    ]
  })
}

export const causalEngine = new CausalEngine()
