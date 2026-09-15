/**
 * Context Budget 分桶策略 (P1.7):
 * 从过去的粗暴 priority 抢占转为显式预留的分桶机制，
 * 避免超长正文直接吃光所有 token budget，导致 StoryState/JIT 关键事实被完全挤出。
 */
export interface ContextBudgetDistribution {
  /** 默认 20%: 系统指令与格式要求 */
  instructionsTokens: number
  /** 默认 40%: 当前正文切片或选区 */
  sceneTokens: number
  /** 默认 20%: 正典世界观事实 (Canonical Facts / Codex) */
  canonicalStoryTokens: number
  /** 默认 15%: 检索记忆与 JIT */
  retrievedMemoryTokens: number
  /** 默认 5%: 任务历史与工作状态 */
  workingStateTokens: number
}

export function calculateContextBudgetBuckets(totalTokenBudget: number): ContextBudgetDistribution {
  const safeTotal = Math.max(500, totalTokenBudget)

  return {
    instructionsTokens: Math.floor(safeTotal * 0.2),
    sceneTokens: Math.floor(safeTotal * 0.4),
    canonicalStoryTokens: Math.floor(safeTotal * 0.2),
    retrievedMemoryTokens: Math.floor(safeTotal * 0.15),
    workingStateTokens: Math.max(
      0,
      safeTotal -
        (Math.floor(safeTotal * 0.2) +
          Math.floor(safeTotal * 0.4) +
          Math.floor(safeTotal * 0.2) +
          Math.floor(safeTotal * 0.15)),
    ),
  }
}
