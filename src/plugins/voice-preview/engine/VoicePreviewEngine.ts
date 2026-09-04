import type {
  DialogueLine,
  RadioDramaScript,
  VoiceCastProfileRecord,
  VoiceGender,
  VoiceAgeGroup,
} from "../types"

/**
 * VoicePreviewEngine (角色拟真有声对白试听器引擎)
 *
 * 理论基础：
 * 1. 自然语言正则有限状态机对白解构（Speaker-Quote Finite State Machine）
 * 2. 角色声学基频映射 (Pitch, Rate, Biquad DSP Formant)
 */
export class VoicePreviewEngine {
  /**
   * 从章节文本中抽取说话人与对白行
   */
  public static extractScript(chapterText: string): RadioDramaScript {
    const lines: DialogueLine[] = []
    const speakersSet = new Set<string>()

    const rawLines = chapterText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0)

    let lineIndex = 1

    for (const raw of rawLines) {
      // 匹配经典对话模式：
      // 如：林凡冷笑道：“今日之辱，来日必报！”
      // 或：苏清月低声耳语：“林凡哥哥，小心他的烈火剑气。”
      const quoteMatch = raw.match(/(?:([^\s：“”]{1,10}?)(?:冷笑道|厉声喝道|低声耳语|沉声道|怒道|冷笑|笑道|说道|说|道|叹道|喝道|喊道|问道|答道)[：:])?[“"]([^“”"]{2,120})[”"]/i)

      if (quoteMatch) {
        let speaker = quoteMatch[1] ? quoteMatch[1].trim() : "旁白/未名角色"
        speaker = speaker.replace(/(冷笑|厉声|低声|耳语|大声|暗自|沉声|微笑|淡淡|轻声)/g, "")
        if (!speaker) speaker = "旁白/未名角色"
        const text = quoteMatch[2]

        let emotion: DialogueLine["emotion"] = "neutral"
        if (/(怒|杀|死|滚|灭|斩|狂徒)/.test(raw)) {
          emotion = "angry"
        } else if (/(冷笑|淡然|漠然|毫无波澜|冰冷)/.test(raw)) {
          emotion = "cold"
        } else if (/(低声|耳语|喃喃|自语|悄悄)/.test(raw)) {
          emotion = "whisper"
        } else if (/(爽|哈哈|痛快|大笑|兴奋)/.test(raw)) {
          emotion = "excited"
        }

        speakersSet.add(speaker)
        lines.push({
          lineIndex: lineIndex++,
          speakerName: speaker,
          dialogueText: text,
          emotion,
        })
      }
    }

    return {
      totalLines: lines.length,
      characterSpeakers: Array.from(speakersSet),
      lines,
    }
  }

  /**
   * 基于角色元数据推导默认声学配音参数
   */
  public static deriveDefaultProfile(
    characterName: string,
    gender: VoiceGender,
    ageGroup: VoiceAgeGroup
  ): Omit<VoiceCastProfileRecord, "id" | "projectId" | "characterId" | "updatedAt"> {
    let pitch = 1.0
    let rate = 1.0
    let timbreFilter: VoiceCastProfileRecord["timbreFilter"] = "standard"

    if (gender === "female") {
      pitch = ageGroup === "child" ? 1.4 : ageGroup === "youth" ? 1.2 : 1.05
    } else if (gender === "male") {
      pitch = ageGroup === "child" ? 1.2 : ageGroup === "elder" ? 0.75 : 0.9
    }

    if (ageGroup === "elder") {
      rate = 0.85
      timbreFilter = "villain_lowpass"
    } else if (ageGroup === "child") {
      rate = 1.15
    }

    return {
      characterName,
      gender,
      ageGroup,
      pitch,
      rate,
      timbreFilter,
    }
  }
}

