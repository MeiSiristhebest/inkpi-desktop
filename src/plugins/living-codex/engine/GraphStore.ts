// 图拓扑关联扩散模型 + 0-1 背包 Token 预算裁剪引擎

import type { CodexEntity, CodexSliceResult } from '../types'
import { AcAutomaton } from './AcAutomaton'

export class CodexGraphStore {
  private entities = new Map<string, CodexEntity>()
  private scanner = new AcAutomaton()

  /**
   * 全量同步实体数据并重新构建 AC 自动机与拓扑图
   */
  public updateDataset(entities: CodexEntity[]): void {
    this.entities.clear()
    entities.forEach((e) => this.entities.set(e.id, e))
    this.scanner.build(entities)
  }

  public getEntity(id: string): CodexEntity | undefined {
    return this.entities.get(id)
  }

  public getAllEntities(): CodexEntity[] {
    return Array.from(this.entities.values())
  }

  /**
   * 核心算法：根据正文输入，执行 AC 扫描 -> 能量扩散 -> 背包裁剪
   * @param text 当前正文或段落文本
   * @param tokenBudget 大模型上下文 Token 预算上限（默认 800 Tokens）
   */
  public resolveContextSlice(text: string, tokenBudget: number = 800): CodexSliceResult {
    const hits = this.scanner.scan(text)
    if (hits.length === 0) {
      return { matchedEntities: [], xmlContext: '', totalEstimatedTokens: 0 }
    }

    // 1. 计算直接命中的词频能量 (Direct Hit Base Energy)
    const energyMap = new Map<string, number>()
    for (const hit of hits) {
      const current = energyMap.get(hit.entityId) || 0
      // 较长词条给予更高初始权重（防止短词偏置）
      const weight = Math.max(1.0, hit.keyword.length * 0.4)
      energyMap.set(hit.entityId, current + weight)
    }

    // 2. 1-hop 拓扑能量扩散 (Spreading Activation)
    // 如果提到了 A，且 A 与 B 存在关系边，则 B 的激活能量获得增益
    const activatedEnergy = new Map<string, number>(energyMap)
    for (const [entityId, baseEnergy] of energyMap.entries()) {
      const entity = this.entities.get(entityId)
      if (entity && entity.relations) {
        for (const rel of entity.relations) {
          if (this.entities.has(rel.targetId)) {
            const current = activatedEnergy.get(rel.targetId) || 0
            // 扩散系数 lambda = 0.5
            activatedEnergy.set(rel.targetId, current + baseEnergy * 0.5)
          }
        }
      }
    }

    // 3. 准备候选实体及其代价（Tokens）与价值（激活能量 / 重要性权值）
    const candidateItems = Array.from(activatedEnergy.entries())
      .map(([id, score]) => {
        const entity = this.entities.get(id)
        if (!entity) return null
        const line = this.formatEntityLine(entity)
        const estTokens = Math.ceil(line.length * 0.7) + 4
        return {
          entity,
          line,
          cost: estTokens,
          value: score,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)

    const baseTagTokens = 20 // 标签预估开销 <living_codex_context> ... </living_codex_context>
    const availableBudget = tokenBudget - baseTagTokens

    if (availableBudget <= 0 || candidateItems.length === 0) {
      return { matchedEntities: [], xmlContext: '', totalEstimatedTokens: 0 }
    }

    // 4. 标准 0-1 背包动态规划算法 (0-1 Knapsack DP)
    // 状态定义：dp[i][w] 表示在前 i 个候选实体中选取，总 Token 代价不超过 w 时的最大激活能量
    const n = candidateItems.length
    const W = availableBudget

    // 二维 DP 表用于追踪并精准回溯最佳选取方案
    // 使用 Float64Array 节省内存与提升性能
    const dp: Float64Array[] = Array.from({ length: n + 1 }, () => new Float64Array(W + 1))

    for (let i = 1; i <= n; i++) {
      const item = candidateItems[i - 1]
      const prevRow = dp[i - 1]
      const currRow = dp[i]
      for (let w = 0; w <= W; w++) {
        if (item.cost <= w) {
          const withItem = prevRow[w - item.cost] + item.value
          const withoutItem = prevRow[w]
          currRow[w] = withItem > withoutItem ? withItem : withoutItem
        } else {
          currRow[w] = prevRow[w]
        }
      }
    }

    // 回溯找出被选中的实体集合
    const selected: typeof candidateItems = []
    let remainingW = W
    for (let i = n; i >= 1; i--) {
      // 若 dp[i][remainingW] !== dp[i-1][remainingW]，说明选取了第 i 个候选（candidateItems[i-1]）
      if (dp[i][remainingW] !== dp[i - 1][remainingW]) {
        const item = candidateItems[i - 1]
        selected.push(item)
        remainingW -= item.cost
      }
    }

    // 按照候选权重或原始顺序由高到低呈现
    selected.sort((a, b) => b.value - a.value)

    if (selected.length === 0) {
      return { matchedEntities: [], xmlContext: '', totalEstimatedTokens: 0 }
    }

    const xmlLines: string[] = ['<living_codex_context>']
    let totalTokens = baseTagTokens
    const selectedEntities: CodexEntity[] = []

    for (const item of selected) {
      selectedEntities.push(item.entity)
      xmlLines.push(`  ${item.line}`)
      totalTokens += item.cost
    }
    xmlLines.push('</living_codex_context>')

    return {
      matchedEntities: selectedEntities,
      xmlContext: xmlLines.join('\n'),
      totalEstimatedTokens: totalTokens,
    }
  }

  /**
   * 格式化单个实体为高密度单行文本
   */
  private formatEntityLine(e: CodexEntity): string {
    let line = `[${e.category.toUpperCase()}] ${e.name}`
    if (e.aliases && e.aliases.length > 0) {
      line += `(别名:${e.aliases.join('/')})`
    }
    line += `: ${e.summary || '暂无描述'}`
    if (e.relations && e.relations.length > 0) {
      const relStr = e.relations
        .map((r) => `${r.relationType}->${r.targetName}`)
        .join(', ')
      line += ` | 关系:[${relStr}]`
    }
    return line
  }
}
