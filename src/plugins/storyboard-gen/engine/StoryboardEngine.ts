import type {
  ShotFrame,
  CharacterVisualCard,
  ClimaxStoryboardExtraction,
  StoryboardSceneRecord,
} from "../types"

/**
 * StoryboardEngine (角色立绘与分镜生成器引擎)
 *
 * 理论基础：电影视听分镜四格语法（Cinematic 4-Beats Grammar）
 * 1. 起（Establishing Shot 远景/全景）：宏观环境与压迫氛围
 * 2. 承（Medium Shot 中景对峙）：剑拔弩张与动作交锋
 * 3. 转（Dutch / Closeup 特写倾斜）：底牌逆转与绝境异变
 * 4. 合（Impact Wide 广角高潮）：余波席卷与胜负定格
 */
export class StoryboardEngine {
  public static extractStoryboard(
    chapterId: string,
    chapterTitle: string,
    chapterText: string
  ): ClimaxStoryboardExtraction {
    const textSnippet = chapterText.trim().slice(0, 100)
    const defaultConflict = textSnippet
      ? `基于章节文本提炼名场面对决: “${textSnippet.slice(0, 40)}...”`
      : "宗门演武场生死对决，退婚反派倾力一击，主角于绝境中爆发反杀"

    const frames: ShotFrame[] = [
      {
        id: `shot_1_${chapterId}`,
        shotOrder: 1,
        shotType: "establishing_wide",
        shotLabel: "【起】远景全景 · 环境入胜",
        description: "乌云压顶，九霄雷云翻滚。宏伟的演武石台四周万千弟子肃立，狂风吹拂玄黑旌旗。",
        compositionGuide: "rule_of_thirds",
        lightingMood: "雷暴雷光，天昏地暗",
        visualPrompt: "epic cinematic establishing wide shot, ancient chinese cultivation arena under stormy sky, thunderstorm, thousands of disciples watching, dark fantasy atmosphere, 8k masterpiece, Unreal Engine 5 render",
      },
      {
        id: `shot_2_${chapterId}`,
        shotOrder: 2,
        shotType: "medium_confrontation",
        shotLabel: "【承】中景对峙 · 剑拔弩张",
        description: "敌对长老手持赤焰战刃居高临下狞笑，主角青衫猎猎横剑而立，二人杀意在空气中激荡起肉眼可见的涟漪。",
        compositionGuide: "leading_sightlines",
        lightingMood: "赤炎火光映照冷色阴影",
        visualPrompt: "cinematic medium confrontation two-shot, young swordsman in cyan robes facing arrogant elder with flaming broadsword, intense tension, dynamic tension line, photorealistic volumetric lighting, raytracing",
      },
      {
        id: `shot_3_${chapterId}`,
        shotOrder: 3,
        shotType: "dutch_closeup",
        shotLabel: "【转】特写倾斜 · 绝命反转",
        description: "镜头45度极度倾斜特写！主角瞳孔深处金红神纹骤然点亮，嘴角勾起一抹从容冷笑，指尖剑芒吞吐如龙！",
        compositionGuide: "diagonal_impact",
        lightingMood: "神纹金芒破夜爆发",
        visualPrompt: "extreme dutch angle dramatic closeup shot, protagonist glowing golden-crimson eyes, subtle calm smirk, glowing arcane rune aura around fingers, shockwave ripples, highly detailed anime keyframe style, Makoto Shinkai style lighting",
      },
      {
        id: `shot_4_${chapterId}`,
        shotOrder: 4,
        shotType: "impact_wide",
        shotLabel: "【合】广角高潮 · 余波震撼",
        description: "一剑既出，千丈石台平整切裂！全场烟尘退散，唯留主角执剑傲立，反派重创吐血跪伏，满场众人倒吸凉气目瞪口呆。",
        compositionGuide: "center_monumental",
        lightingMood: "朝霞破晓，金光万道",
        visualPrompt: "monumental wide angle victory climax frame, shattered arena stone split in half, dust clouds parting, victorious hero standing center holding gleaming sword, defeated foe kneeling in defeat, glorious dawn light piercing through storm clouds, awe-inspiring scale",
      },
    ]

    const suggestedCharacters: CharacterVisualCard[] = [
      {
        characterId: "c_main",
        characterName: "林凡",
        visualFeatures: "少年剑修，黑发高马尾，青白色云纹道袍，神情坚毅冷峻，手持断水古剑，周身有淡金雷芒流转。",
        stableDiffusionPrompt: "handsome young male cultivation swordsman, high ponytail black hair, cyan and white flowing daoist robe, sharp confident gaze, holding ancient mystical sword, subtle golden lightning aura, concept art, trending on ArtStation",
      },
      {
        characterId: "c_rival",
        characterName: "赵家长老",
        visualFeatures: "鹰钩鼻中年修士，面色阴鸷，暗红锦袍，手持烈焰巨刃，神色狰狞骄横。",
        stableDiffusionPrompt: "arrogant fierce middle-aged cultivator villain, sinister hawk nose, dark crimson embroidered robe, blazing fire greatsword, aggressive posture, highly detailed fantasy character illustration",
      },
    ]

    return {
      sceneTitle: `${chapterTitle || "第 1 章"} 名场面高潮分镜`,
      coreConflict: defaultConflict,
      frames,
      suggestedCharacters,
    }
  }

  public static createSceneRecord(
    id: string,
    projectId: string,
    chapterId: string,
    extracted: ClimaxStoryboardExtraction,
    createdAt: number
  ): StoryboardSceneRecord {
    return {
      id,
      projectId,
      chapterId,
      sceneTitle: extracted.sceneTitle,
      shotFrames: extracted.frames,
      characterCards: extracted.suggestedCharacters,
      createdAt,
    }
  }
}

