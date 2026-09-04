import type {
  NarrativeArchetypeRecord,
  ArchetypeCategory,
  ChemistryResult,
} from "../types"
import type { RandomSource } from "../../../ports/randomSource"
import { randomSource as defaultRandomSource } from "../../../adapters/randomSource"

/**
 * ArchetypeEngine (人格原型素材库与叙事母题卡牌引擎)
 *
 * 理论基础：36 种经典戏剧人格原型、MBTI 16 极性张力对与 12 大英雄之旅母题
 */
export class ArchetypeEngine {
  private randomSource: RandomSource

  constructor(random?: RandomSource) {
    this.randomSource = random || defaultRandomSource
  }

  public static getPresetArchetypes(): NarrativeArchetypeRecord[] {
    return [
      {
        id: "arch-rebel",
        name: "反叛者 (The Rebel)",
        category: "character_archetype_36",
        coreDesire: "打破腐朽陈规，重塑世界秩序",
        fatalFlaw: "极端偏执与自毁倾向",
        typicalBehaviors: ["冷笑审视规则", "挑衅权威", "随时准备孤注一掷"],
        foilArchetypeIds: ["arch-ruler", "arch-mentor"],
        conflictPrompt: "无法接受体制的妥协与牺牲，哪怕同归于尽也要撞碎旧秩序。",
      },
      {
        id: "arch-ruler",
        name: "秩序守护者 (The Ruler)",
        category: "character_archetype_36",
        coreDesire: "维持宗门与天下的大局稳定",
        fatalFlaw: "为了集体利益无情牺牲无辜个体",
        typicalBehaviors: ["权衡利弊", "不动如山", "目光深邃且冰冷"],
        foilArchetypeIds: ["arch-rebel", "arch-trickster"],
        conflictPrompt: "视反叛者为破坏稳定的狂徒，坚信少数人的牺牲是必要的代价。",
      },
      {
        id: "arch-martyr",
        name: "殉道者 (The Martyr)",
        category: "character_archetype_36",
        coreDesire: "用自身的毁灭换取他人的救赎",
        fatalFlaw: "道德洁癖与病态的奉献欲",
        typicalBehaviors: ["默默承受伤痛", "宽恕背叛者", "挡在所有人身前"],
        foilArchetypeIds: ["arch-egoist"],
        conflictPrompt: "坚信善念与牺牲的力量，与不择手段的利己主义者产生最深层的灵魂冲撞。",
      },
      {
        id: "arch-egoist",
        name: "极端利己者 (The Pragmatist/Egoist)",
        category: "character_archetype_36",
        coreDesire: "自身道途的绝对延续与利益最大化",
        fatalFlaw: "无法信任任何温情，最终众叛亲离",
        typicalBehaviors: ["精算得失", "关键时刻毫不犹豫割舍同伴"],
        foilArchetypeIds: ["arch-martyr"],
        conflictPrompt: "嘲弄殉道者的愚蠢，认为天道无情唯有唯我独尊才能登顶。",
      },
      {
        id: "motif-refusal",
        name: "拒绝召唤 (Refusal of the Call)",
        category: "narrative_motif_12",
        coreDesire: "逃避命运所赋予的沉重责任",
        fatalFlaw: "安于现状的惰性",
        typicalBehaviors: ["找借口推脱", "试图隐居避世"],
        foilArchetypeIds: [],
        conflictPrompt: "外部危机逐步逼近，原有的安逸避难所被彻底粉碎，不得不重踏征程。",
      },
      {
        id: "motif-abyss",
        name: "深渊试炼 (The Inmost Cave)",
        category: "narrative_motif_12",
        coreDesire: "直面内心最深处的梦魇与恐惧",
        fatalFlaw: "心魔噬体",
        typicalBehaviors: ["绝境中的灵魂拷问", "置之死地而后生"],
        foilArchetypeIds: [],
        conflictPrompt: "所有底牌尽失，只有抛弃过去的自我，才能完成向死而生的蜕变。",
      },
    ]
  }

  /**
   * 随机抽卡
   */
  public drawCards(
    category: ArchetypeCategory,
    count = 1,
    pool?: NarrativeArchetypeRecord[]
  ): NarrativeArchetypeRecord[] {
    const list = (pool || ArchetypeEngine.getPresetArchetypes()).filter((a) => a.category === category)
    if (list.length === 0) return []

    const results: NarrativeArchetypeRecord[] = []
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(this.randomSource.next() * list.length)
      results.push(list[idx])
    }
    return results
  }

  /**
   * 分析两位角色原型的对手戏火花阻抗
   */
  public static calculateChemistry(
    charA: NarrativeArchetypeRecord,
    charB: NarrativeArchetypeRecord
  ): ChemistryResult {
    const isFoil =
      charA.foilArchetypeIds.includes(charB.id) || charB.foilArchetypeIds.includes(charA.id)
    const tensionScore = isFoil ? 0.95 : 0.65

    return {
      archetypeA: charA,
      archetypeB: charB,
      tensionScore,
      coreEthicalConflict: `「${charA.coreDesire}」 VS 「${charB.coreDesire}」`,
      dramaticPrompt: isFoil
        ? `天然宿敌碰撞！${charA.name}与${charB.name}存在不可调和的根本伦理死结：${charA.conflictPrompt}`
        : `性格张力交互：${charA.name}的缺陷（${charA.fatalFlaw}）将无意中刺痛${charB.name}。`,
    }
  }
}
