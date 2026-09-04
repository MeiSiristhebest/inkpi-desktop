import type {
  CharacterKnowledge,
  SecretItem,
  PovViolation,
  PovAnalysisResult,
} from "../types"

export interface EpistemicContext {
  povCharacter: string
  povMode: "first_person" | "third_limited" | "third_objective" | "omniscient"
  allCharacters: CharacterKnowledge[]
  secrets: SecretItem[]
  currentLocation?: string
}

/**
 * PovGuardEngine
 *
 * 理论基础：心智理论 (Theory of Mind, ToM) 与认识论模态逻辑 (Epistemic Modal Logic)。
 * - 知识域模型：K_C 为角色 C 的可认知集合。
 * - 视角规则：在第三人称受限视角 (Third Limited) 或第一人称视角 (First Person) 下，
 *   非 POV 主体角色不可出现直接心理独白或主观心理动词（"心想"、"感到"、"内心暗喜"、"暗忖"、"回忆起" 等）。
 * - 保密泄漏模型：若文本段落披露了密级为 "secret" / "top_secret" 的情报，
 *   但当前 POV 角色不在 holders 认知域中，判定为"全知泄漏 (Omniscience Leakage)"。
 */
export class PovGuardEngine {
  private static readonly PSYCHOLOGICAL_PREDICATES = [
    "心想",
    "暗想",
    "暗自思量",
    "心里暗道",
    "暗暗吃惊",
    "心中冷笑",
    "内心暗忖",
    "暗道",
    "心中大骇",
    "感到一阵后怕",
    "回忆起当年的秘密",
    "不由得在心中盘算",
    "心中暗忖",
    "只觉内心冰凉",
    "感到莫名恐惧",
  ]

  /**
   * 分析章节文本，校验视角越界与全知泄漏
   */
  public static analyze(text: string, context: EpistemicContext): PovAnalysisResult {
    const paragraphs = text
      .split(/\r?\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)

    const violations: PovViolation[] = []
    let headHoppingCount = 0
    let leakageCount = 0

    // 全知视角下允许自由洞悉所有角色心智与秘密
    if (context.povMode === "omniscient") {
      return {
        povCharacter: context.povCharacter,
        povMode: context.povMode,
        totalParagraphs: paragraphs.length,
        headHoppingCount: 0,
        leakageCount: 0,
        violations: [],
        sanitizedTextMask: text,
      }
    }

    const povChar = context.allCharacters.find(
      (c) => c.characterName === context.povCharacter || c.characterId === context.povCharacter
    )
    const povKnownSecretIds = new Set(povChar ? povChar.knownSecretIds : [])

    // 预编译非 POV 角色列表
    const otherCharacters = context.allCharacters.filter(
      (c) => c.characterName !== context.povCharacter && c.characterId !== context.povCharacter
    )

    paragraphs.forEach((para, pIdx) => {
      // 1. Head-Hopping (视角游移/非受控跳视角) 校验
      // 检查是否在描写非 POV 角色的心理活动
      for (const other of otherCharacters) {
        if (!para.includes(other.characterName)) continue

        for (const predicate of this.PSYCHOLOGICAL_PREDICATES) {
          const pattern = new RegExp(`${other.characterName}[^。！？]*?${predicate}`)
          const match = para.match(pattern)
          if (match) {
            headHoppingCount++
            violations.push({
              id: `hh-${pIdx}-${other.characterId}-${predicate}`,
              type: "head_hopping",
              paragraphIndex: pIdx,
              characterName: other.characterName,
              snippet: match[0].slice(0, 40),
              explanation: `当前章节视角为「${context.povCharacter}」，但此处直接洞悉了非POV角色「${other.characterName}」的主观心智（使用了心理谓词「${predicate}」），造成严重的视角跳跃(Head-Hopping)。`,
              suggestedFix: `改为通过外在神态、微表情或动作描写来暗示其心理，例如将「${other.characterName}${predicate}...」改为「${other.characterName}眉头紧锁，眼神微不可察地闪烁...」`,
            })
            break
          }
        }
      }

      // 2. Omniscience Leakage (全知泄露) 校验
      // 检查当前段落是否提到了受限机密，但 POV 主体并不知道该秘密
      for (const secret of context.secrets) {
        if (secret.confidentialityLevel === "low") continue
        if (povKnownSecretIds.has(secret.id)) continue

        // 若段落包含秘密标题或核心关键词
        if (para.includes(secret.title)) {
          leakageCount++
          violations.push({
            id: `leak-${pIdx}-${secret.id}`,
            type: "omniscience_leak",
            paragraphIndex: pIdx,
            characterName: context.povCharacter,
            snippet: para.slice(Math.max(0, para.indexOf(secret.title) - 10), para.indexOf(secret.title) + secret.title.length + 10),
            explanation: `视角角色「${context.povCharacter}」认知域尚未解锁机密「${secret.title}」（密级：${secret.confidentialityLevel}，知情者仅限：${secret.holders.join(", ") || "未知"}），正文中不可直接以客观叙述或POV自白披露该信息。`,
            suggestedFix: `对此机密信息进行叙述脱敏，或通过配角在对话中不经意透露的方式合规引入认知。`,
          })
        }
      }
    })

    // 生成掩码脱敏版本文本 (Sanitized Mask)
    let sanitizedTextMask = text
    violations
      .filter((v) => v.type === "omniscience_leak")
      .forEach((v) => {
        sanitizedTextMask = sanitizedTextMask.replace(v.snippet, `[POV防火墙脱敏遮蔽: ${v.snippet}]`)
      })

    return {
      povCharacter: context.povCharacter,
      povMode: context.povMode,
      totalParagraphs: paragraphs.length,
      headHoppingCount,
      leakageCount,
      violations,
      sanitizedTextMask,
    }
  }
}
