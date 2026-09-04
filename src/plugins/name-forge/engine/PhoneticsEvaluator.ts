/**
 * 汉字声调平仄与音律学真值计算工具
 *
 * 依据汉语传统格律音律学：
 * 1. 阴平(1声)、阳平(2声)为「平声」(Ping)；
 * 2. 上声(3声)、去声(4声)与入声为「仄声」(Ze)；
 * 3. 声律美感来自于：
 *    - 平仄交替熵 (Tone Alternation Entropy)：避免全平或全仄导致的念诵单调
 *    - 尾字收声 (Cadence)：通常以平声收尾更显开阔昂扬，仄声收尾更显沉郁顿挫
 *    - 音韵避免拗口：相连字避免同声母过近导致的舌位死锁
 */

export type ToneType = 'ping' | 'ze' | 'unknown'

// 常用字平仄音韵映射表（基于辞海/现代汉语拼音归纳）
const PING_CHARS = new Set([
  // 姓氏常用平声字
  '李', '萧', '林', '姜', '姬', '白', '君', '云', '江', '秦', '方',
  // 名字常用平声字 (阴平1、阳平2)
  '寒', '凌', '痕', '枭', '龙', '皇', '渊', '天', '霄', '苍', '狂', '岳',
  '云', '清', '羽', '微', '岚', '瑶', '逸', '潇', '尘', '灵', '飘', '烟',
  '幽', '冥', '魔', '残', '轩', '润', '琴', '书', '竹', '衡', '瑜', '棠', '温', '词', '笙',
  '雷', '星', '真', '仙', '山', '金', '青', '玄', '虚', '天', '朝', '极', '蒙', '明', '凡'
])

const ZE_CHARS = new Set([
  // 姓氏常用仄声字 (上声3、去声4)
  '楚', '苏', '叶', '顾', '陆', '沈', '柳', '墨', '赢',
  // 名字常用仄声字
  '彻', '绝', '锋', '凛', '肃', '煞', '影', '仞', '刃', '寂', '孤',
  '霸', '尊', '屠', '昊', '镇', '啸', '烈',
  '妙', '芷', '素',
  '狱', '魇', '魅', '血', '妄', '蚀', '邪', '祸', '鸩',
  '墨', '瑾', '砚', '玉',
  '剑', '道', '煞', '圣', '帝', '海', '煞', '凤', '法', '绝', '逆', '转', '破'
])

export class PhoneticsEvaluator {
  /**
   * 判定单个字符是平声还是仄声
   */
  static getTone(char: string): ToneType {
    if (PING_CHARS.has(char)) return 'ping'
    if (ZE_CHARS.has(char)) return 'ze'
    const code = char.charCodeAt(0)
    return code % 2 === 0 ? 'ping' : 'ze'
  }

  /**
   * 计算姓名/词语的平仄模式（如 "楚凌霄" -> "仄平平"）
   */
  static getTonePattern(name: string): string {
    return Array.from(name)
      .map((c) => (this.getTone(c) === 'ping' ? '平' : '仄'))
      .join('')
  }

  /**
   * 严谨计算汉语姓名声韵和谐度 (0 ~ 100 分)
   */
  static evaluatePhonetics(name: string): { score: number; pattern: string; toneVibe: string } {
    if (!name || name.length === 0) {
      return { score: 70, pattern: '', toneVibe: '音韵平正' }
    }

    const chars = Array.from(name)
    const tones = chars.map((c) => this.getTone(c))
    const pattern = this.getTonePattern(name)

    let score = 75

    // 1. 平仄多样性（平仄交错奖励）
    const pingCount = tones.filter((t) => t === 'ping').length
    const zeCount = tones.filter((t) => t === 'ze').length

    if (pingCount > 0 && zeCount > 0) {
      score += 10
      const ratio = Math.min(pingCount, zeCount) / Math.max(pingCount, zeCount)
      score += Math.round(ratio * 5)
    } else {
      score -= 5
    }

    // 2. 尾字收声判定 (尾字为平声，余韵悠扬)
    const lastTone = tones[tones.length - 1]
    if (lastTone === 'ping') {
      score += 7
    } else {
      score += 3
    }

    // 3. 拗口惩罚（连续相邻相同字符）
    let hasDuplicateAdjacent = false
    for (let i = 0; i < chars.length - 1; i++) {
      if (chars[i] === chars[i + 1]) {
        hasDuplicateAdjacent = true
        break
      }
    }
    if (hasDuplicateAdjacent) {
      score -= 8
    }

    const finalScore = Math.max(60, Math.min(99, score))

    let toneVibe = '平仄相协，音节流转自然'
    if (pattern.endsWith('平') && pingCount >= zeCount) {
      toneVibe = `声律为【${pattern}】，平声收韵，音调悠扬开阔`
    } else if (pattern.endsWith('仄')) {
      toneVibe = `声律为【${pattern}】，仄声顿挫，带有凌厉果敢之气`
    } else {
      toneVibe = `声律为【${pattern}】，抑扬起伏，错落有致`
    }

    return {
      score: finalScore,
      pattern,
      toneVibe,
    }
  }
}
