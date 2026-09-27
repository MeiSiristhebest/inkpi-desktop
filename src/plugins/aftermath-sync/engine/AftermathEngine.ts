import type { EntityCandidate, AftermathAnalysisResult } from '../types'

/**
 * 缔结关系的线索，以及每条线索自己说出的那种关系。
 * 线索必须带上关系类型：把「拜其为师」统一报成「盟友/至交」是替原文编造羁绊。
 */
const BOND_CUES = [
  { cue: '结为异姓兄弟', relation: '结义兄弟' },
  { cue: '拜其为师', relation: '师徒' },
  { cue: '义结金兰', relation: '结义' },
] as const

/**
 * AftermathEngine (章后桥段设定回写器引擎)
 *
 * 理论基础：实体状态转移与所有权有向图 (Ownership Directed Graph)
 * - 境界/战力突破检测 (如 "突破到金丹初期"、"晋升为真传弟子")
 * - 物品/灵兽所有权转移 (如 "将青铜古剑收入囊中"、"赠予苏雨柔")
 * - 人际关系缔结与决裂 (如 "结为生死兄弟"、"反目成仇")
 */
export class AftermathEngine {
  /**
   * 分析章节正文，提取针对世界观实体的变更提案
   */
  public static analyzeChapter(
    chapterText: string,
    chapterId: string,
    // 允许 undefined：从面板手工扫描时并没有真实的章序，写死一个数字就是在伪造归属。
    chapterOrder: number | undefined,
    knownEntities: EntityCandidate[],
  ): AftermathAnalysisResult {
    const lines = chapterText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
    const patches: AftermathAnalysisResult['patches'] = []

    let attributeUpdates = 0
    let relations = 0
    let ownershipTransfers = 0

    const characters = knownEntities.filter((e) => e.category === 'character')
    const items = knownEntities.filter((e) => e.category === 'item')

    lines.forEach((line) => {
      // 1. 境界突破与战力跃迁模式匹配
      for (const char of characters) {
        if (!line.includes(char.name)) continue

        // 匹配突破模式："突破至/突破到/晋升为/迈入 [境界]"
        const breakPattern = new RegExp(
          `${char.name}[^。！？]*?(?:突破到|突破至|成功晋升为|一举迈入|踏入)([\u4e00-\u9fa5]{2,6}期|[\u4e00-\u9fa5]{2,6}境|[\u4e00-\u9fa5]{2,6}阶)`,
        )
        const match = line.match(breakPattern)
        if (match && match[1]) {
          const newTier = match[1]
          if (newTier !== char.currentTier) {
            attributeUpdates++
            patches.push({
              chapterId,
              chapterOrder,
              entityId: char.id,
              entityName: char.name,
              changeType: 'attribute_update',
              propertyName: '战力境界',
              beforeValue: char.currentTier || '未知',
              afterValue: newTier,
              evidenceSnippet: match[0],
            })
          }
        }
      }

      // 2. 物品/法宝所有权转移有向边匹配
      for (const item of items) {
        if (!line.includes(item.name)) continue

        for (const char of characters) {
          if (!line.includes(char.name)) continue

          // 匹配获取模式："林凡将青阳剑收入囊中" / "收服了灵狐" / "夺得紫阳令"
          const lootPattern = new RegExp(
            `${char.name}[^。！？]*?(?:收入囊中|据为己有|夺得|收服|炼化了|握住|接过)${item.name}`,
          )
          if (lootPattern.test(line)) {
            if (char.name !== item.currentOwner) {
              ownershipTransfers++
              patches.push({
                chapterId,
                chapterOrder,
                entityId: item.id,
                entityName: item.name,
                changeType: 'ownership_transfer',
                propertyName: '所有权归属',
                beforeValue: item.currentOwner || '无主/未知',
                afterValue: char.name,
                evidenceSnippet: line.slice(0, 45),
              })
            }
          }
        }
      }

      // 3. 人际关系结拜/决裂匹配
      if (characters.length >= 2) {
        for (let i = 0; i < characters.length; i++) {
          for (let j = i + 1; j < characters.length; j++) {
            const c1 = characters[i]
            const c2 = characters[j]
            if (line.includes(c1.name) && line.includes(c2.name)) {
              // 只报原文里出现的那条线索所缔结的关系。「拜其为师」被统一写成
              // 「盟友/至交」是给正文编造羁绊；谁拜谁为师这里也判不出来，所以成对陈述。
              const bond = BOND_CUES.find((entry) => line.includes(entry.cue))
              if (bond) {
                relations++
                patches.push({
                  chapterId,
                  chapterOrder,
                  entityId: c1.id,
                  entityName: c1.name,
                  changeType: 'new_relation',
                  propertyName: '人际羁绊',
                  beforeValue: '未记录',
                  afterValue: `与 ${c2.name}：原文出现「${bond.cue}」，据此记为${bond.relation}`,
                  evidenceSnippet: line.slice(0, 45),
                })
              }
            }
          }
        }
      }
    })

    return {
      chapterId,
      patches,
      summary: {
        attributeUpdates,
        relations,
        ownershipTransfers,
      },
    }
  }
}
