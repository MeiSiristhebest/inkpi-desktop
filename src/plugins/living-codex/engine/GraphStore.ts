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

    // 3. 按最终激活能量降序排序
    const sortedCandidates = Array.from(activatedEnergy.entries())
      .map(([id, score]) => ({ entity: this.entities.get(id)!, score }))
      .filter((item) => Boolean(item.entity))
      .sort((a, b) => b.score - a.score)

    // 4. 0-1 背包贪心组装标准化 XML 切片
    const selected: CodexEntity[] = []
    const xmlLines: string[] = ['<living_codex_context>']
    let currentTokens = 20 // 标签预估开销

    for (const { entity } of sortedCandidates) {
      const line = this.formatEntityLine(entity)
      // 汉字与符号预估 Token 系数约 0.7
      const estTokens = Math.ceil(line.length * 0.7) + 4

      if (currentTokens + estTokens <= tokenBudget) {
        selected.push(entity)
        xmlLines.push(`  ${line}`)
        currentTokens += estTokens
      }
    }
    xmlLines.push('</living_codex_context>')

    return {
      matchedEntities: selected,
      xmlContext: selected.length > 0 ? xmlLines.join('\n') : '',
      totalEstimatedTokens: selected.length > 0 ? currentTokens : 0,
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
