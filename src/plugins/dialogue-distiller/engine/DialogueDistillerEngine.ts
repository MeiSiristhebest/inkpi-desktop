import type {
  CharacterVoiceprint,
  VoiceprintVector,
  SimilarityPair,
  DialoguePreset,
} from '../types'

const ARCHAIC_WORDS = ['尔等', '本座', '老夫', '罢了', '岂敢', '此乃', '安能', '吾', '汝', '甚好', '徒儿', '道友', '本尊', '朕', '寡人']
const COLLOQUIAL_WORDS = ['俺', '老子', '切', '哼', '呀', '哇', '哈哈', '哎呀', '没门', '真特么', '滚犊子', '得了吧', '扯淡', '去你的']

const PRESETS: DialoguePreset[] = [
  {
    id: 'preset-ancient-master',
    name: '【上古宿老 · 渊深肃穆】',
    description: '平均句长偏长（20字以上），多用文言古雅虚词，自称老夫/本座，语调沉缓威严。',
    toneStyle: 'archaic',
    sampleSnippet: '老夫纵横大荒三千载，尔等这点微末伎俩，也敢在此班门弄斧？当真是不知天高地厚。',
    typicalCatchphrases: ['尔等', '老夫', '此乃天意', '罢了'],
  },
  {
    id: 'preset-arrogant-villain',
    name: '【跋扈反派 · 诘问压迫】',
    description: '高频使用反问与质问句，压迫感强，多感叹与居高临下的诘责。',
    toneStyle: 'aggressive',
    sampleSnippet: '凭你也配质问本公子？！跪下！否则今日定叫你死无葬身之地！',
    typicalCatchphrases: ['凭你也配', '跪下', '受死吧', '蝼蚁'],
  },
  {
    id: 'preset-street-rebel',
    name: '【市井豪侠 · 俚俗短促】',
    description: '平均句长极短（8字以内），口语化甚至粗豪，节奏极快，性格泼辣直率。',
    toneStyle: 'colloquial',
    sampleSnippet: '少废话！老子今天就剁了你！看招！',
    typicalCatchphrases: ['老子', '少废话', '看刀', '切'],
  },
  {
    id: 'preset-aloof-beauty',
    name: '【清冷谪仙 · 简明克制】',
    description: '字数极简，极少感叹与废话，情绪无波澜，言简意赅。',
    toneStyle: 'laconic',
    sampleSnippet: '让开。你挡路了。',
    typicalCatchphrases: ['无需多言', '让开', '不必', '无趣'],
  },
]

export class DialogueDistillerEngine {
  /**
   * 提取指定角色的所有对白语录 (支持前置引语与后置倒装)
   */
  extractCharacterQuotes(text: string, characterNames: string[]): Record<string, string[]> {
    const result: Record<string, string[]> = {}
    for (const name of characterNames) {
      result[name] = []
    }

    if (!text || characterNames.length === 0) return result

    const speechVerbPattern = '(?:道|说|冷笑|冷哼|暗道|心想|沉吟|怒斥|低语|喝道|叹道|问|答|暴喝|低呼)'

    // 正向引语
    const leadingRegex = new RegExp(
      `([\\u4e00-\\u9fa5A-Za-z0-9_]{2,15}?)${speechVerbPattern}[：:]\\s*[“「]([^”」]+)[”」]`,
      'g'
    )
    let match: RegExpExecArray | null
    while ((match = leadingRegex.exec(text)) !== null) {
      const rawPrefix = match[1]
      const speech = match[2]

      const matched = characterNames.find(
        (name) => rawPrefix.endsWith(name) || rawPrefix.includes(name)
      )
      if (matched && result[matched]) {
        result[matched].push(speech.trim())
      }
    }

    // 倒装引语
    const trailingRegex = new RegExp(
      `[“「]([^”」]+)[”」][，,。]?\\s*([\\u4e00-\\u9fa5A-Za-z0-9_]{2,15}?)${speechVerbPattern}`,
      'g'
    )
    while ((match = trailingRegex.exec(text)) !== null) {
      const speech = match[1]
      const rawPostfix = match[2]

      const matched = characterNames.find(
        (name) => rawPostfix.startsWith(name) || rawPostfix.includes(name)
      )
      if (matched && result[matched]) {
        result[matched].push(speech.trim())
      }
    }

    return result
  }

  /**
   * 分析计算角色的对白声纹特征向量 (规范化加权特征)
   */
  computeVoiceprint(
    characterName: string,
    quotes: string[],
    projectId: string = ''
  ): CharacterVoiceprint & { vector: VoiceprintVector } {
    const compositeId = projectId
      ? `${projectId}::vp::${encodeURIComponent(characterName)}`
      : `vp-${characterName}`

    if (quotes.length === 0) {
      const defaultVec: VoiceprintVector = {
        asl: 12,
        questionRatio: 0.1,
        exclamationRatio: 0.1,
        archaicRatio: 0.05,
        colloquialRatio: 0.05,
      }
      return {
        id: compositeId,
        projectId,
        characterName,
        sampleDialogueCount: 0,
        averageSentenceLength: 12,
        questionRatio: 0.1,
        exclamationRatio: 0.1,
        catchphrases: [],
        toneStyle: 'colloquial',
        updatedAt: 0,
        vector: defaultVec,
      }
    }

    const sentences: string[] = []
    for (const q of quotes) {
      const parts = q.split(/[。！？!?\n]+/).map((s) => s.trim()).filter(Boolean)
      if (parts.length > 0) sentences.push(...parts)
      else sentences.push(q)
    }

    const totalChars = quotes.reduce((acc, q) => acc + q.replace(/\s+/g, '').length, 0)
    const asl = Math.round((totalChars / Math.max(1, sentences.length)) * 10) / 10

    let questionCount = 0
    let exclamationCount = 0
    let archaicCount = 0
    let colloquialCount = 0

    for (const s of sentences) {
      if (s.includes('?') || s.includes('？') || s.includes('难道') || s.includes('岂') || s.includes('怎') || s.includes('莫非')) {
        questionCount++
      }
      if (s.includes('!') || s.includes('！') || s.includes('受死') || s.includes('休得') || s.includes('绝不') || s.includes('放肆')) {
        exclamationCount++
      }
      for (const w of ARCHAIC_WORDS) {
        if (s.includes(w)) {
          archaicCount++
          break
        }
      }
      for (const w of COLLOQUIAL_WORDS) {
        if (s.includes(w)) {
          colloquialCount++
          break
        }
      }
    }

    const totalS = Math.max(1, sentences.length)
    const questionRatio = Math.round((questionCount / totalS) * 100) / 100
    const exclamationRatio = Math.round((exclamationCount / totalS) * 100) / 100
    const archaicRatio = Math.round((archaicCount / totalS) * 100) / 100
    const colloquialRatio = Math.round((colloquialCount / totalS) * 100) / 100

    let toneStyle: CharacterVoiceprint['toneStyle'] = 'colloquial'
    if (archaicRatio > 0.3) toneStyle = 'archaic'
    else if (questionRatio > 0.35 || exclamationRatio > 0.35) toneStyle = 'aggressive'
    else if (asl <= 7) toneStyle = 'laconic'

    const vector: VoiceprintVector = {
      asl,
      questionRatio,
      exclamationRatio,
      archaicRatio,
      colloquialRatio,
    }

    return {
      id: compositeId,
      projectId,
      characterName,
      sampleDialogueCount: quotes.length,
      averageSentenceLength: asl,
      questionRatio,
      exclamationRatio,
      catchphrases: [],
      toneStyle,
      updatedAt: 0,
      vector,
    }
  }

  /**
   * 计算两位角色的声纹余弦相似度
   */
  computeCosineSimilarity(vA: VoiceprintVector, vB: VoiceprintVector): number {
    const a = [vA.asl / 25, vA.questionRatio, vA.exclamationRatio, vA.archaicRatio, vA.colloquialRatio]
    const b = [vB.asl / 25, vB.questionRatio, vB.exclamationRatio, vB.archaicRatio, vB.colloquialRatio]

    let dot = 0
    let normA = 0
    let normB = 0
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    if (normA === 0 || normB === 0) return 1.0
    const cos = dot / (Math.sqrt(normA) * Math.sqrt(normB))
    return Math.round(Math.min(1.0, Math.max(0, cos)) * 100) / 100
  }

  /**
   * 比对两位角色，并生成同质化诊断
   */
  comparePair(
    charA: string,
    vA: VoiceprintVector,
    charB: string,
    vB: VoiceprintVector
  ): SimilarityPair {
    const similarity = this.computeCosineSimilarity(vA, vB)
    const isHomogeneous = similarity >= 0.85

    let advice = '两名角色声纹差异清晰，句式与口吻辨识度良好。'
    if (isHomogeneous) {
      const aslDiff = Math.abs(vA.asl - vB.asl)
      if (aslDiff < 3) {
        advice = `【声纹严重同质化（相似度 ${Math.round(similarity * 100)}%）】：${charA} 与 ${charB} 的平均句长过于雷同（均为 ~${Math.round(vA.asl)} 字），建议将其中一人调整为短促利落句式或拉长从容句式。`
      } else {
        advice = `【声纹雷同警告（相似度 ${Math.round(similarity * 100)}%）】：两位角色的反问/感叹情绪频率与助词过于相似，建议通过专属口头禅或文言/口语差异拉开距离。`
      }
    }

    return {
      charA,
      charB,
      similarity,
      isHomogeneous,
      advice,
    }
  }

  getPresets(): DialoguePreset[] {
    return PRESETS
  }
}

export const dialogueDistillerEngine = new DialogueDistillerEngine()
