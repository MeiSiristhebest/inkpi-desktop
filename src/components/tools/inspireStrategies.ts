// 灵感生成策略注册表（评审 §3.3 / OCP）。
//
// 原 InspireTools 用「类别 × 风格」的 if-else 嵌套生成随机素材；新增风格或类别需改分支。
// 这里改为数据驱动的注册表：每个 (类别, 风格) 对应一个生成策略，新增项只加一条记录。
// 随机性统一走 RandomSource 端口，不在视图层直接调用随机数生成器。

import { randomSource } from '../../adapters/randomSource'

export const CATEGORIES = ['人名', '门派', '功法', '地名', '法宝', '怪物'] as const
export type InspireCategory = (typeof CATEGORIES)[number]

export const STYLES = ['仙侠', '古风', '现代', '西幻', '科幻', '悬疑', '末日'] as const
export type InspireStyle = (typeof STYLES)[number]

const SURNAMES = ['陈', '林', '萧', '叶', '楚', '沈', '顾', '苏', '洛', '云', '秦', '宋', '陆', '江', '柳', '白', '谢', '唐', '温', '容', '慕容', '司马', '上官', '欧阳', '南宫', '东方', '独孤', '轩辕']
const NAME_XIANXIA = ['渊', '尘', '玄', '清', '寒', '冥', '霄', '鸿', '真', '阳', '虚', '尘子', '青云', '紫霞', '凌霄', '星河', '太一', '忘尘', '渡劫', '归元']
const NAME_GUFENG = ['砚', '卿', '辞', '晏', '黎', '苏', '莞', '衿', '珩', '翎', '锦书', '怀瑾', '枕月', '折柳', '南絮', '知晚', '听雪', '沉璧']
const NAME_XIHUAN = ['亚伯拉罕·雷恩', '罗兰·奥古斯塔', '艾莉丝·德拉克罗瓦', '加雷斯·蒙特罗斯', '塞西莉亚·瓦斯奎兹', '维克多·斯特恩']
const NAME_KEHUAN = ['周卡', '林诺', '艾铮', '沈曜', '陈宇航', '顾知行', '陆明远', '楚天枢']

const SECT_PREFIX = ['青云', '玄天', '太虚', '紫霄', '凌霄', '苍澜', '万剑', '天机', '幽冥', '焚天', '御兽', '丹霞', '星辰', '无极', '九幽', '流云']
const SECT_SUFFIX = ['宗', '门', '阁', '殿', '山庄', '剑派', '道统', '圣地', '古教', '学宫']

const SKILL_PREFIX = ['御剑', '焚天', '玄冥', '九转', '太上', '紫微', '周天', '星辰', '无量', '噬魂', '金刚', '清心', '天罡', '碎虚', '归一', '苍龙']
const SKILL_SUFFIX = ['诀', '神功', '心法', '真经', '剑典', '秘术', '大法', '图录', '篇', '术', '七式', '九斩']

const PLACE_PREFIX = ['落霞', '青岚', '赤炎', '寒渊', '幽篁', '断魂', '万妖', '焚天', '听雨', '沧澜', '白帝', '孤鸿', '流沙', '陨星', '昆仑', '蓬莱']
const PLACE_SUFFIX = ['城', '谷', '山', '泽', '林', '渊', '原', '关', '岛', '秘境', '禁地', '要塞', '古遗迹']

const ITEM_PREFIX = ['诛仙', '焚寂', '镇魂', '混元', '九幽', '天问', '噬灵', '破军', '绕指', '山河', '日月', '星辰', '太虚', '太初', '青铜']
const ITEM_SUFFIX = ['剑', '刀', '钟', '镜', '鼎', '塔', '印', '珠', '琴', '幡', '甲', '梭', '炉', '玉简']

const MONSTER_PREFIX = ['噬魂', '玄阴', '幽冥', '九幽', '焚天', '炼狱', '梦魇', '血煞', '黑水', '裂空', '霜寒', '虚空']
const MONSTER_SUFFIX = ['渊蛟', '天蟒', '龙蜥', '魔虎', '赤凰', '暴熊', '麒麟', '凶犼', '饕餮', '穷奇', '梼杌', '毕方', '妖夜叉']

function pickOne<T>(arr: readonly T[]): T {
  return arr[Math.floor(randomSource.next() * arr.length)]
}

type Strategy = () => string

// 注册表：key 为 `${category}::${style}`。未注册风格回退到默认策略。
const DEFAULT_BY_CATEGORY: Record<InspireCategory, Strategy> = {
  人名: () => pickOne(SURNAMES) + pickOne(NAME_XIANXIA),
  门派: () => pickOne(SECT_PREFIX) + pickOne(SECT_SUFFIX),
  功法: () => pickOne(SKILL_PREFIX) + pickOne(SKILL_SUFFIX),
  地名: () => pickOne(PLACE_PREFIX) + pickOne(PLACE_SUFFIX),
  法宝: () => pickOne(ITEM_PREFIX) + pickOne(ITEM_SUFFIX),
  怪物: () => pickOne(MONSTER_PREFIX) + pickOne(MONSTER_SUFFIX),
}

const OVERRIDES: Partial<Record<InspireCategory, Partial<Record<InspireStyle, Strategy>>>> = {
  人名: {
    西幻: () => pickOne(NAME_XIHUAN),
    科幻: () => pickOne(NAME_KEHUAN),
    古风: () => pickOne(SURNAMES) + pickOne(NAME_GUFENG),
  },
  门派: {
    西幻: () => pickOne(['圣光', '黑铁', '狮心', '烈焰', '暗影']) + pickOne(['骑士团', '兄弟会', '圣殿', '评议会']),
    科幻: () => pickOne(['星环', '天枢', '深空', '量子']) + pickOne(['联合舰队', '拓殖集团', '执政总署', '防卫军']),
  },
  功法: {
    科幻: () => pickOne(['量子', '引力', '暗能量', '次声', '光棱']) + pickOne(['共振场', '超载矩阵', '偏转战法', '聚焦脉冲']),
  },
  地名: {
    科幻: () => pickOne(['开普勒', '天狼', '半人马', '比邻']) + pickOne(['空间站', '轨道城', '前进基地', '中继星区']),
  },
  法宝: {
    科幻: () => pickOne(['深空', '量子', '星火', '黎明']) + pickOne(['高频振荡刃', '磁轨步枪', '便携力场仪', '曲速驱动核心']),
  },
  怪物: {
    科幻: () => pickOne(['异种', '基因变异', '深空潜伏', '虚空寄宿']) + pickOne(['猎手', '吞噬者', '主母', '母虫']),
  },
}

/** 按类别与风格生成一条灵感素材（策略注册表驱动）。 */
export const generateInspiration = (category: InspireCategory, style: InspireStyle): string => {
  const override = OVERRIDES[category]?.[style]
  if (override) return override()
  return DEFAULT_BY_CATEGORY[category]()
}
