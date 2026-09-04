import * as Diff from "diff"
import type {
  DiffComputeResult,
  ReviewHunkView,
  DiffLineChange,
  DiffWordToken,
  HunkResolution,
} from "../types"

/**
 * DiffReviewerEngine
 *
 * 核心算法：Myers 最短编辑脚本 (Shortest Edit Script, SES) + 行内字词级细化 (Word/Char-level Diff)
 * 职责：
 * 1. 计算原文本与 AI 提案文本之间的结构化 Hunk 差异
 * 2. 支持独立 Hunk 的 apply / reject 决策
 * 3. 动态合成应用部分 Hunk 后的完整合稿文本
 */
export class DiffReviewerEngine {
  /**
   * 对两段文本进行分块 Diff 分析并拆解为可独立审校的 Hunk
   */
  public static computeDiff(oldText: string, newText: string): DiffComputeResult {
    const patch = Diff.structuredPatch(
      "original.txt",
      "proposed.txt",
      oldText,
      newText,
      "",
      "",
      { context: 2 }
    )

    let additions = 0
    let deletions = 0
    let unmodified = 0

    const hunks: ReviewHunkView[] = patch.hunks.map((rawHunk, hIdx) => {
      const lineChanges: DiffLineChange[] = []
      let oldCur = rawHunk.oldStart
      let newCur = rawHunk.newStart

      // 提取本 Hunk 的各行变更
      for (const line of rawHunk.lines) {
        const marker = line[0]
        const content = line.slice(1)

        if (marker === "+") {
          additions++
          lineChanges.push({
            type: "added",
            newLineNumber: newCur++,
            content,
          })
        } else if (marker === "-") {
          deletions++
          lineChanges.push({
            type: "removed",
            oldLineNumber: oldCur++,
            content,
          })
        } else {
          unmodified++
          lineChanges.push({
            type: "unchanged",
            oldLineNumber: oldCur++,
            newLineNumber: newCur++,
            content,
          })
        }
      }

      // 计算行内字词级 Diff (Intra-line word tokens)
      this.enrichWordTokens(lineChanges)

      return {
        id: `hunk-${hIdx}-${rawHunk.oldStart}-${rawHunk.newStart}`,
        oldStartLine: rawHunk.oldStart,
        oldLineCount: rawHunk.oldLines,
        newStartLine: rawHunk.newStart,
        newLineCount: rawHunk.newLines,
        lines: rawHunk.lines,
        resolution: "pending" as HunkResolution,
        lineChanges,
      }
    })

    return {
      hunks,
      stats: { additions, deletions, unmodified },
    }
  }

  /**
   * 行内字词级对齐对比
   */
  private static enrichWordTokens(lineChanges: DiffLineChange[]): void {
    // 提取所有的 removed 行与 added 行进行就近配对
    const removedIndices: number[] = []
    const addedIndices: number[] = []

    lineChanges.forEach((lc, idx) => {
      if (lc.type === "removed") removedIndices.push(idx)
      else if (lc.type === "added") addedIndices.push(idx)
    })

    const pairCount = Math.min(removedIndices.length, addedIndices.length)
    for (let p = 0; p < pairCount; p++) {
      const remChange = lineChanges[removedIndices[p]]
      const addChange = lineChanges[addedIndices[p]]

      const wordDiff = Diff.diffWordsWithSpace(remChange.content, addChange.content)
      const oldTokens: DiffWordToken[] = []
      const newTokens: DiffWordToken[] = []

      wordDiff.forEach((part) => {
        if (part.added) {
          newTokens.push({ type: "added", value: part.value })
        } else if (part.removed) {
          oldTokens.push({ type: "removed", value: part.value })
        } else {
          oldTokens.push({ type: "unchanged", value: part.value })
          newTokens.push({ type: "unchanged", value: part.value })
        }
      })

      remChange.wordTokens = oldTokens
      addChange.wordTokens = newTokens
    }
  }

  /**
   * 根据各个 Hunk 的裁决状态 (applied / rejected / pending)，重构合并后的终稿文本
   * - applied: 采纳 proposed (新版)
   * - rejected 或 pending: 保留 original (旧版)
   */
  public static applyHunks(
    oldText: string,
    hunks: Array<{ lines: string[]; resolution: HunkResolution }>
  ): string {
    // 筛选出所有状态为 applied 的 hunks 并组装 unified patch 进行精准应用
    const appliedHunks = hunks.filter((h) => h.resolution === "applied")
    if (appliedHunks.length === 0) {
      return oldText
    }

    // 简单高效且确定的重组策略：将 oldText 按行切分，依 hunk 行范围做状态机替换
    const oldLines = oldText.split(/\r?\n/)
    const resultLines: string[] = []
    let cursor = 0 // oldLines 的行指针

    for (const hunk of hunks) {
      // 提取 hunk 内的上下文匹配与变更
      const hunkOldLines: string[] = []
      const hunkNewLines: string[] = []

      for (const line of hunk.lines) {
        const marker = line[0]
        const content = line.slice(1)
        if (marker === " ") {
          hunkOldLines.push(content)
          hunkNewLines.push(content)
        } else if (marker === "-") {
          hunkOldLines.push(content)
        } else if (marker === "+") {
          hunkNewLines.push(content)
        }
      }

      // 在 oldLines 中定位 hunkOldLines 的起始索引
      if (hunkOldLines.length === 0) continue
      const targetFirstLine = hunkOldLines[0]
      let matchIdx = -1

      for (let i = cursor; i <= oldLines.length - hunkOldLines.length; i++) {
        if (oldLines[i] === targetFirstLine) {
          let matched = true
          for (let k = 0; k < hunkOldLines.length; k++) {
            if (oldLines[i + k] !== hunkOldLines[k]) {
              matched = false
              break
            }
          }
          if (matched) {
            matchIdx = i
            break
          }
        }
      }

      if (matchIdx !== -1) {
        // 先复制 cursor 到 matchIdx 之间的原文本
        for (let j = cursor; j < matchIdx; j++) {
          resultLines.push(oldLines[j])
        }

        // 根据 resolution 决定写入 hunkNewLines 还是 hunkOldLines
        if (hunk.resolution === "applied") {
          resultLines.push(...hunkNewLines)
        } else {
          resultLines.push(...hunkOldLines)
        }

        cursor = matchIdx + hunkOldLines.length
      }
    }

    // 将剩余的尾部原文本全部推入
    for (let j = cursor; j < oldLines.length; j++) {
      resultLines.push(oldLines[j])
    }

    return resultLines.join("\n")
  }
}
