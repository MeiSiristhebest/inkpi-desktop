import type { CompiledDialogueTrack } from "../types"

/**
 * SubtextCompilerEngine (潜台词与冰山对白双轨编译器)
 *
 * 理论基础：海明威“冰山理论”与心理防御机制（Psychological Defense Mechanism）
 * - 表面台词 (Spoken, 露出水面的八分之一)
 * - 水下潜台词 (Subtext, 掩藏在水下的八分之七)
 * - 肢体微动作 (Beat Action, 身体不自主流露的泄露微反应)
 */
export class SubtextCompilerEngine {
  /**
   * 将普通对白编译重构为包含潜台词与微反应的三轨立体对白
   */
  public static compile(
    spoken: string,
    speakerName: string,
    innerEmotion: "anger" | "fear" | "pride" | "affection" | "jealousy" | "guilt"
  ): CompiledDialogueTrack {
    let subtext = ""
    let beatAction = ""
    let defenseMechanism = "反向形成 (Reaction Formation)"
    let tensionLevel = 3

    switch (innerEmotion) {
      case "fear":
        subtext = "我现在非常害怕，但绝不能在你面前露出丝毫怯懦。"
        beatAction = "手指无意识地摩挲着腰间剑柄，喉结极快地滚动了一下。"
        defenseMechanism = "否认与坚硬外壳 (Denial & Shielding)"
        tensionLevel = 4
        break
      case "jealousy":
        subtext = "凭什么是你得到这一切？我明明比你付出了十倍努力。"
        beatAction = "嘴角勉强扯出一抹僵硬的笑意，视线却不自然地移向窗外。"
        defenseMechanism = "酸葡萄与理智化 (Rationalization)"
        tensionLevel = 4
        break
      case "affection":
        subtext = "我只在乎你的安危，哪怕天崩地裂我也想护着你，但我不能明说。"
        beatAction = "眼神微颤着掠过对方的侧脸，长袖下的双手微微攥紧又松开。"
        defenseMechanism = "情感隔离与闪烁 (Emotional Suppression)"
        tensionLevel = 3
        break
      case "guilt":
        subtext = "那件事是我对不起你，可我没有回头路了。"
        beatAction = "声音骤然低沉下去，有些狼狈地避开对方投来的目光。"
        defenseMechanism = "投射与回避 (Avoidance)"
        tensionLevel = 5
        break
      case "pride":
        subtext = "我其实内心慌张，但我必须维持高高在上的绝对权威。"
        beatAction = "下颌微微扬起，神色冷峻倨傲，眼神透着一丝居高临下的审视。"
        defenseMechanism = "过度补偿 (Overcompensation)"
        tensionLevel = 3
        break
      case "anger":
      default:
        subtext = "你已经踩到了我的底线，若再敢前进一步我必让你付出代价。"
        beatAction = "瞳孔骤然收缩，呼吸频率骤降，周遭空气隐隐泛起肃杀之意。"
        defenseMechanism = "压抑与攻击转移 (Suppressed Aggression)"
        tensionLevel = 5
        break
    }

    return {
      speakerName,
      spoken,
      subtext,
      beatAction,
      tensionLevel,
      defenseMechanism,
    }
  }

  /**
   * 将三轨数据融合成标准文学小说段落
   */
  public static renderNovelParagraph(track: CompiledDialogueTrack): string {
    return `${track.speakerName}${track.beatAction}，缓缓开口道：“${track.spoken}”`
  }
}
