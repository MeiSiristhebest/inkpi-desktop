import type {
  ShotFrame,
  CharacterVisualCard,
  ClimaxStoryboardExtraction,
  StoryboardSceneRecord,
} from '../types'

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
    chapterText: string,
  ): ClimaxStoryboardExtraction {
    const rawLines = chapterText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 5)

    // 尝试从文本中解析人物与动作焦点
    let mainHero = '林凡'
    let opponent = '赵家长老'

    // 简单扫描提取高频双字/三字主语
    const nameMatches = chapterText.match(
      /([\u4e00-\u9fa5]{2,3})(?:手持|冷笑|暴起|挥剑|喝道|怒吼|一掌|踏出)/g,
    )
    if (nameMatches && nameMatches.length > 0) {
      const extractedNames = Array.from(
        new Set(
          nameMatches.map((m) => m.replace(/(手持|冷笑|暴起|挥剑|喝道|怒吼|一掌|踏出)/g, '')),
        ),
      ).filter((n) => n.length >= 2 && n.length <= 3)

      if (extractedNames.length >= 1) mainHero = extractedNames[0]
      if (extractedNames.length >= 2) opponent = extractedNames[1]
    }

    // 提取关键冲突段落片段作为描述基础
    const actionSnippet =
      rawLines.find((l) => /(剑|刀|斩|杀|掌|拳|雷|火|轰)/.test(l)) || rawLines[0] || '双方对峙'
    const defaultConflict = `围绕「${mainHero}」与「${opponent}」的关键交锋：${actionSnippet.slice(0, 45)}`

    const frames: ShotFrame[] = [
      {
        id: `shot_1_${chapterId}`,
        shotOrder: 1,
        shotType: 'establishing_wide',
        shotLabel: '【起】远景全景 · 环境入胜',
        description: `环境与压迫定场：风云激变。${chapterTitle || '本章'}战局全面铺展，宏大场景见证${mainHero}与${opponent}之决断。`,
        compositionGuide: 'rule_of_thirds',
        lightingMood: '雷暴雷光，天昏地暗',
        visualPrompt: `epic cinematic establishing wide shot, ancient chinese cultivation scene under dramatic sky, ${mainHero} vs ${opponent}, cinematic composition, 8k masterpiece, Unreal Engine 5 render`,
      },
      {
        id: `shot_2_${chapterId}`,
        shotOrder: 2,
        shotType: 'medium_confrontation',
        shotLabel: '【承】中景对峙 · 剑拔弩张',
        description: `核心交锋：${opponent}挟势威逼，${mainHero}横刀立剑相迎。动荡气机激荡出肉眼可见的狂暴涟漪。`,
        compositionGuide: 'leading_sightlines',
        lightingMood: '冷暖光影交割相持',
        visualPrompt: `cinematic medium confrontation two-shot, ${mainHero} facing fierce ${opponent}, dynamic tension line, photorealistic volumetric lighting, raytracing`,
      },
      {
        id: `shot_3_${chapterId}`,
        shotOrder: 3,
        shotType: 'dutch_closeup',
        shotLabel: '【转】特写倾斜 · 绝命反转',
        description: `绝命反击特写！${mainHero}眼中异彩骤亮，底牌杀招于毫厘之间逆境爆发，胜负天平轰然逆转！`,
        compositionGuide: 'diagonal_impact',
        lightingMood: '神芒破夜爆发',
        visualPrompt: `extreme dutch angle dramatic closeup shot, ${mainHero} eyes glowing with mystical arcane runes, intense cinematic keyframe, Makoto Shinkai lighting`,
      },
      {
        id: `shot_4_${chapterId}`,
        shotOrder: 4,
        shotType: 'impact_wide',
        shotLabel: '【合】广角高潮 · 余波震撼',
        description: `余波定格：天地风波席卷平息，高潮落幕。胜者傲然渊渟岳峙，满场震撼动容。`,
        compositionGuide: 'center_monumental',
        lightingMood: '破晓辉光破云而降',
        visualPrompt: `monumental wide angle victory climax frame, smoke and dust clearing, ${mainHero} standing victorious, awe-inspiring scale, cinematic lighting`,
      },
    ]

    const suggestedCharacters: CharacterVisualCard[] = [
      {
        characterId: 'c_main',
        characterName: mainHero,
        visualFeatures: `${mainHero}：坚毅少年修士，道袍猎猎，神色沉静自若，周身雷芒流转。`,
        stableDiffusionPrompt: `handsome young cultivator ${mainHero}, flowing robes, sharp confident gaze, holding mystical weapon, concept art, trending on ArtStation`,
      },
      {
        characterId: 'c_rival',
        characterName: opponent,
        visualFeatures: `${opponent}：面色阴鸷的中年对手，战袍翻飞，气焰嚣张。`,
        stableDiffusionPrompt: `fierce rival cultivator ${opponent}, aggressive stance, glowing destructive aura, detailed fantasy illustration`,
      },
    ]

    return {
      sceneTitle: `${chapterTitle || '第 1 章'} 名场面高潮分镜`,
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
    createdAt: number,
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
