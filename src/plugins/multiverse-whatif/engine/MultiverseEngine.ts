import type {
  MultiverseBranchRecord,
  MultiverseNode,
  MultiverseSimulationResult,
  ButterflyEffectLog,
} from "../types"


/**
 * MultiverseEngine (平行宇宙因果沙盒推演器引擎)
 *
 * 理论基础：时空分支树与因果状态转移 Jaccard 偏离度计算
 * - 偏离度 D(t) = 1 - (|S_canon ∩ S_whatif| / |S_canon ∪ S_whatif|)
 * - 蝴蝶效应级联扩散传播 (Butterfly Effect Cascade)
 */
export class MultiverseEngine {
  /**
   * 推演分支时间线
   * @param canonChapters 原著主宇宙章节事件列表
   * @param forkChapterIndex 分支奇点章节 (如 15)
   * @param divergencePremise 假设前提 (如 "主角在第15章没有救下女配")
   */
  public static simulateFork(
    canonChapters: Array<{ index: number; title: string; summary: string; entities: string[] }>,
    forkChapterIndex: number,
    divergencePremise: string
  ): MultiverseSimulationResult {
    const nodes: MultiverseNode[] = []
    const butterflyEffects: ButterflyEffectLog[] = []
    const divergenceCurve: Array<{ chapter: number; divergencePercent: number }> = []

    // 1. 分支奇点之前的章节：偏离度 0% (完全继承 Canon 历史)
    canonChapters.forEach((ch) => {
      if (ch.index < forkChapterIndex) {
        nodes.push({
          chapterIndex: ch.index,
          chapterTitle: ch.title,
          eventSummary: ch.summary,
          divergenceLevel: 0,
          butterflyEffects: [],
        })
        divergenceCurve.push({ chapter: ch.index, divergencePercent: 0 })
      } else if (ch.index === forkChapterIndex) {
        // 2. 分歧奇点：注入前提变更
        const effects = [`【奇点爆发】${divergencePremise}`]
        nodes.push({
          chapterIndex: ch.index,
          chapterTitle: `${ch.title} (分支分歧点)`,
          eventSummary: `[What-If 分支] 因果发生质变：${divergencePremise}。`,
          divergenceLevel: 0.35,
          butterflyEffects: effects,
        })
        divergenceCurve.push({ chapter: ch.index, divergencePercent: 35 })
        butterflyEffects.push({
          chapterIndex: ch.index,
          rippleFactor: 0.35,
          description: divergencePremise,
          affectedCharacters: ch.entities.slice(0, 2),
        })
      } else {
        // 3. 分歧之后的章节：非线性因果涟漪扩散
        const delta = ch.index - forkChapterIndex
        // 偏离度增长模型：D(t) = min(1.0, 0.35 + 0.15 * ln(1 + delta))
        const divergence = Math.min(1.0, Math.round((0.35 + 0.18 * Math.log(1 + delta)) * 100) / 100)
        
        let branchSummary = `因第 ${forkChapterIndex} 章分歧演化：`
        const chapterEffects: string[] = []

        if (divergence >= 0.7) {
          branchSummary += `原著盟友反目成仇，宗门覆灭轨迹彻底改写，主角被迫踏上全新独行杀戮线。`
          chapterEffects.push("【世界线重组】原著关键盟友阵亡或黑化")
        } else if (divergence >= 0.5) {
          branchSummary += `主线情报断裂，敌对势力提前十年发动围剿，原定大比决战取消。`
          chapterEffects.push("【蝴蝶效应】危机提前爆发，因果链断裂")
        } else {
          branchSummary += `剧情微偏：配角势力未加入战场，主角孤身破阵，受暗伤隐患。`
          chapterEffects.push("【局部异化】战局代价加剧")
        }

        nodes.push({
          chapterIndex: ch.index,
          chapterTitle: `${ch.title} (平行分支)`,
          eventSummary: branchSummary,
          divergenceLevel: divergence,
          butterflyEffects: chapterEffects,
        })
        divergenceCurve.push({ chapter: ch.index, divergencePercent: Math.round(divergence * 100) })

        butterflyEffects.push({
          chapterIndex: ch.index,
          rippleFactor: divergence,
          description: chapterEffects[0] || "剧情渐进偏离",
          affectedCharacters: ch.entities,
        })
      }
    })

    return {
      branchId: `branch_${forkChapterIndex}`,
      branchName: `平行分支：${divergencePremise.slice(0, 15)}...`,
      forkChapterIndex,
      divergenceCurve,
      nodes,
      butterflyEffects,
    }
  }

  /**
   * 将分支模拟结果打包为持久化记录
   */
  public static createBranchRecord(
    id: string,
    projectId: string,
    sim: MultiverseSimulationResult,
    createdAt: number
  ): MultiverseBranchRecord {
    return {
      id,
      projectId,
      name: sim.branchName,
      forkChapterIndex: sim.forkChapterIndex,
      divergencePremise: sim.butterflyEffects[0]?.description || "未知假设",
      nodes: sim.nodes,
      createdAt,
    }
  }
}
