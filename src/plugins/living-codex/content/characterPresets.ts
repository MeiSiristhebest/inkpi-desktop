// 男女核心人物人设模版库（提炼自高阶网文创作素材库）。展示给作者的条数一律由 countTemplates()
// 算出来，别在文案里手写：这套库此前一直对外宣称「36+」。

import type { CodexCategory } from '../types'

export interface CharacterPreset {
  id: string
  name: string
  gender: '男' | '女' | '通用'
  tagline: string // 核心标签 (如: "端庄·分寸感", "高冷·禁欲")
  fit: string[] // 适配身份 (如: ["世家千金", "宗门圣女", "仙尊", "魔皇"])
  summaryTemplate: string
  detailMarkdown: string
  suggestedAttributes: Record<string, string | number>
}

export const CHARACTER_PRESETS: CharacterPreset[] = [
  // ── 女性核心人设模版 ────────────────────────────────────
  {
    id: 'f1',
    name: '优雅贵气型',
    gender: '女',
    tagline: '端庄 · 分寸感 · 自带主场气场',
    fit: ['世家千金', '女帝', '宗门圣女', '商界女掌舵'],
    summaryTemplate: '世家贵胄，端庄从容自带分寸感。喜怒不形于色，行事滴水不漏。',
    suggestedAttributes: {
      身份定位: '宗门圣女/世家千金',
      核心性格: '端庄从容、极具分寸感',
      保密等级: '公开',
    },
    detailMarkdown: `### 核心气质\n自带距离感的从容，不是"贵"在钱，是贵在"不慌"。任何场合都像主场。\n\n### 造型符号\n剪裁利落的长袍/裙装、低饱和色（月白、黛蓝、墨绿）、素雅玉簪，一丝不苟。\n\n### 动作微表情\n入座前先抚平裙摆；端茶时指尖平稳；生气时只垂眸深呼吸，绝不提高音量。\n\n### 语言习惯\n用语完整、敬语自然；把拒绝说得像关心；极少用感叹号，多用从容陈述句。\n\n### 情感表达\n爱意藏在"替你安排好一切"里；吃醋时反而更客气守礼。\n\n### 反差与避雷\n表面无懈可击，独处时却会反复确认自己配不配被爱；切忌写成毫无底气的装腔作势。`,
  },
  {
    id: 'f2',
    name: '清冷疏离型',
    gender: '女',
    tagline: '淡漠 · 通透 · 懒得演戏',
    fit: ['隐世高人', '天才阵法师', '冷面剑客', '仙门太上长老'],
    summaryTemplate: '冷若冰霜的天才剑修，对世俗纷争漠不关心，唯独对剑道与认定的同行者倾注执念。',
    suggestedAttributes: {
      身份定位: '隐世剑尊/天才学者',
      核心性格: '清冷通透、沉默内敛',
      保密等级: '核心机密',
    },
    detailMarkdown: `### 核心气质\n对热闹毫无兴趣，像站在人群外的观察者；不是故意冷淡，是性格纯粹。\n\n### 语言习惯\n短句为主（"嗯。""不必。""随你。"）；极少主动开启话题；偶有一针见血的实话。\n\n### 情感表达\n靠近她的人会先冷后暖——用"允许你在身边"代替"我喜欢你"；一旦认定，会沉默地挡在所有人前面。`,
  },
  {
    id: 'f3',
    name: '明媚活泼型',
    gender: '女',
    tagline: '光能体 · 钝感力 · 治愈系',
    fit: ['宗门小师妹', '灵兽通灵师', '探险搭档', '治愈医仙'],
    summaryTemplate: '元气灵动的小师妹，拥有极强的情绪感染力与直觉，总能在死局中唤醒生机。',
    suggestedAttributes: {
      身份定位: '宗门小师妹/灵医',
      核心性格: '乐观坚韧、热烈坦荡',
      保密等级: '公开',
    },
    detailMarkdown: `### 核心气质\n自带升温属性，进屋像点亮了明灯；乐观不是无知，是对抗黑暗的武器。\n\n### 行为逻辑\n遇到挫折睡一觉就能满血复活；把所有人当朋友，但踩到她底线时会爆发惊人决断力。`,
  },
  {
    id: 'f4',
    name: '腹黑心机型',
    gender: '女',
    tagline: '笑里藏刀 · 步步为营 · 执棋者',
    fit: ['魔门妖女', '黑市掌柜', '深宫谋士', '情报头子'],
    summaryTemplate: '智计绝伦的幕后执棋者，巧笑嫣然间已布下连环杀局。',
    suggestedAttributes: {
      身份定位: '魔道妖女/情报首领',
      核心性格: '深沉莫测、利字当头',
      保密等级: '绝密',
    },
    detailMarkdown: `### 核心气质\n永远挂着温和无害的笑容，眼神深处却在计算每个人的利用价值与底牌。\n\n### 行为逻辑\n绝不亲自下场冒险；擅长借刀杀人与利益捆绑；面对真正心动之人反而会方寸大乱。`,
  },
  {
    id: 'f5',
    name: '病娇偏执型',
    gender: '女',
    tagline: '占有欲 · 极度依赖 · 毁灭与爱',
    fit: ['转世古神', '魔道圣女', '血脉异变者', '傀儡师'],
    summaryTemplate: '极度偏执与占有欲的宿命伴侣，宁可毁掉世界也绝不容许背叛。',
    suggestedAttributes: {
      身份定位: '古神残魂/偏执圣女',
      核心性格: '偏执病娇、炽热危险',
      保密等级: '特级危险',
    },
    detailMarkdown: `### 核心气质\n平时柔弱依顺，一旦触及逆鳞则瞬间化身毁灭一切的修罗。\n\n### 语言习惯\n呢喃细语，习惯用最温柔的语气说出最令人胆寒的誓言。`,
  },

  // ── 男性核心人设模版 ────────────────────────────────────
  {
    id: 'm1',
    name: '高冷禁欲型',
    gender: '男',
    tagline: '仙姿佚貌 · 律己至苛 · 冰山深情',
    fit: ['第一剑仙', '执法长老', '仙尊大能', '神皇'],
    summaryTemplate: '白衣胜雪的正道至尊，严守戒律铁面无私，内心深处却压抑着跨越万年的深情。',
    suggestedAttributes: {
      身份定位: '仙道至尊/执法长老',
      实力境界: '化神圆满/半步真仙',
      核心性格: '克制严谨、外冷内热',
    },
    detailMarkdown: `### 核心气质\n如万载玄冰，拒人于千里之外；身负天下苍生重担，克制压抑是他的本能。\n\n### 动作习惯\n负手而立，目光如电；出剑快若惊鸿，一击必杀。\n\n### 情感表达\n从不言爱，却会在暗中替对方挡下所有必死之劫。`,
  },
  {
    id: 'm2',
    name: '邪魅狂狷型',
    gender: '男',
    tagline: '不羁 · 霸道 · 唯我独尊',
    fit: ['魔界至尊', '九幽魔帝', '邪道巨擘', '反派大BOSS'],
    summaryTemplate: '行事全凭喜恶的魔皇霸主，藐视世俗规矩，睥睨诸天神佛。',
    suggestedAttributes: {
      身份定位: '九幽魔皇',
      实力境界: '合体期/魔尊',
      核心性格: '霸道狂妄、快意恩仇',
    },
    detailMarkdown: `### 核心气质\n黑袍如墨，红发张扬；视三界如棋盘，万物皆可为刍狗。\n\n### 语言习惯\n冷笑居多，"顺我者昌，逆我者亡"；极度护短。`,
  },
  {
    id: 'm3',
    name: '退休大佬型',
    gender: '男',
    tagline: '扮猪吃虎 · 深藏不露 · 慵懒无敌',
    fit: ['藏经阁扫地僧', '隐退老祖', '客栈厨子', '废柴小卒'],
    summaryTemplate: '曾经横推万界的无上巨头，厌倦纷争后隐姓埋名，随手一击皆是大道真理。',
    suggestedAttributes: {
      身份定位: '扫地杂役(实为上古老祖)',
      实力境界: '返璞归真',
      核心性格: '慵懒随性、返璞归真',
    },
    detailMarkdown: `### 核心气质\n看似平平无奇甚至有点懒散，对年轻一代的争斗报以看戏心态；关键时刻一指破苍穹。`,
  },
  {
    id: 'm4',
    name: '热血意气型',
    gender: '男',
    tagline: '赤子之心 · 逆境不屈 · 一往无前',
    fit: ['升级流主角', '边境少年', '废脉逆袭者', '刀客'],
    summaryTemplate: '不信天命的赤诚少年，凭手中凡铁与不灭意志，硬生生走出一条无敌之路。',
    suggestedAttributes: {
      身份定位: '主角/逆袭刀修',
      实力境界: '练气/淬体期',
      核心性格: '坚毅勇敢、重情重义',
    },
    detailMarkdown: `### 核心气质\n眼神清亮如初阳，即便跌入深渊也绝不认输；"我命由我不由天"。`,
  },
  {
    id: 'm5',
    name: '腹黑权谋型',
    gender: '男',
    tagline: '算无遗策 · 隐忍决绝 · 执掌乾坤',
    fit: ['落魄皇子', '宗门智囊', '权臣', '天下第一谋士'],
    summaryTemplate: '以天下为局的操盘手，隐忍十年不鸣，一鸣则鼎革天下。',
    suggestedAttributes: {
      身份定位: '皇子/军师智囊',
      实力境界: '金丹初期',
      核心性格: '隐忍克制、算无遗策',
    },
    detailMarkdown: `### 核心气质\n体弱多病，手握羽扇；常年隐于幕后，喜怒不形于色。`,
  },
]

export interface WorldTemplatePreset {
  id: string
  /** 只填表时写进 attributes.类别 的标签，与卡片标题分开维护。 */
  title: string
  category: Extract<CodexCategory, 'faction' | 'item' | 'location'>
  heading: string
  blurb: string
  summary: string
  detailMarkdown: string
}

export const WORLD_TEMPLATE_PRESETS: WorldTemplatePreset[] = [
  {
    id: 'w-faction-orthodox',
    category: 'faction',
    title: '隐世仙门/名门正派',
    heading: '隐世仙门 / 名门正派',
    blurb: '传承万载的正道巨擘，以阵法、剑诀与浩然正气著称。',
    summary: '传承万年的正道巨擘，拥有护宗大阵与太上长老团，门风严谨。',
    detailMarkdown:
      '### 宗门构架\n分为内门、外门、执法堂、传功阁。\n\n### 镇派至宝\n护宗天阶大阵、不灭真火。',
  },
  {
    id: 'w-faction-shadow',
    category: 'faction',
    title: '魔门九幽/暗杀公会',
    heading: '魔门九幽 / 暗杀公会',
    blurb: '行事狠辣不择手段的暗影势力，视规矩为无物。',
    summary: '藏于暗处的杀伐势力，实力为尊，内部遵循残酷的丛林法则。',
    detailMarkdown:
      '### 组织戒律\n完成任务赏千金，泄密者诛灭九族。\n\n### 核心秘法\n九幽匿影身法、煞血噬魂术。',
  },
  {
    id: 'w-item-artifact',
    category: 'item',
    title: '上古神器/本命法宝',
    heading: '上古神器 / 本命至宝',
    blurb: '主角专属随身金手指法宝，带残魂或独立空间。',
    summary: '封印中的太古至尊神物，内蕴残破乾坤小世界，可成长进化。',
    detailMarkdown:
      '### 法宝特质\n随宿主境界逐步解封九重神禁。\n\n### 附带神通\n时间流速加速、提纯天地灵药。',
  },
  {
    id: 'w-location-realm',
    category: 'location',
    title: '远古秘境/太古神墟',
    heading: '远古秘境 / 太古神墟',
    blurb: '各大势力抢夺机缘的副本舞台，杀人夺宝高发地。',
    summary: '千年一开的试炼遗迹，机缘与大凶并存，内有太古妖兽盘踞。',
    detailMarkdown:
      '### 入境限制\n仅容许骨龄百岁以下或金丹以下修士进入。\n\n### 核心产出\n筑基灵草、上古功法残卷、天外神石。',
  },
]

/** 模版库对作者报出的条数：只能由这两份数据算出来。 */
export const CHARACTER_PRESET_COUNT = CHARACTER_PRESETS.length

export function countTemplates(): number {
  return CHARACTER_PRESET_COUNT + WORLD_TEMPLATE_PRESETS.length
}
