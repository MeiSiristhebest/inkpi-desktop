import type { DesktopPluginCategory, PluginDrawerCapability } from '../types/plugin'

export type CapabilityMaturity =
  | 'production' // 成熟稳定的正典功能（如 Living Codex, Promise Ledger, Timeline Grid, Diff Reviewer）
  | 'beta' // 体验良好但处于调优期（如 Continuity Sentinel, Memory Palace）
  | 'experimental' // 规则启发式/实验性功能（如 Reader Hook, Narrative Linter, Water Meter）
  | 'demo' // 原型与演示专用
  | 'deprecated'

export type CapabilitySurface =
  | 'navigation' // 拥有顶级工作台侧栏入口
  | 'canvas' // 占用中央画布
  | 'inspector' // 驻留右侧上下文审查栏
  | 'drawer' // 悬浮折叠抽屉
  | 'command' // 仅通过全局命令呼出

export type CapabilityCategory =
  'core' | 'worldbuilding' | 'plot' | 'intelligence' | 'format' | 'experimental'

export interface CapabilityDescriptor {
  id: string
  name: string
  /** The registry's own taxonomy plus the plugin suite taxonomy it now derives from. */
  category: CapabilityCategory | DesktopPluginCategory
  /** Renders as a stability badge in the sidebar, so it is declared only where a human verified it. */
  maturity?: CapabilityMaturity
  surfaces: readonly CapabilitySurface[]

  /** Declared only where a write path proves it; nothing reads these two at runtime. */
  mutatesDocument?: boolean
  /** Whether the capability writes canonical world facts (StoryState / Codex). */
  mutatesCanonicalState?: boolean

  description: string
}

/**
 * §P2.14: the registry states only what no other catalog can state.
 *
 * Every entry used to hand-copy its own `id` and `name` on top of the key, and both had drifted from
 * the catalogs that actually own them: the command palette read 「世界设定集 (Living Codex)」 and
 * 「双栏审校 (Diff Reviewer)」 here while the sidebar read 「活体世界观」 and 「双栏审校合稿」 off the
 * plugin definitions, so one capability had two names on screen. Identity now comes from whichever
 * catalog owns the id — `pluginDefinitions` for plugins, `tabDefinitions` for the domain modules —
 * and `capabilityIndex` composes the two halves. `description` stays here for tab modules because
 * their own description is a long form preamble, not palette copy.
 */
export type CapabilityOverlay = {
  category: CapabilityCategory | DesktopPluginCategory
  maturity?: CapabilityMaturity
  surfaces: readonly CapabilitySurface[]
  mutatesDocument?: boolean
  mutatesCanonicalState?: boolean
  /** Palette copy. Only the domain modules need it; a plugin states its own description. */
  description?: string
}

/**
 * 统一能力分类注册中心 (P2.1, P2.2, INV-10):
 * 替代过去散落在各个 TAB_DEFINITIONS / PluginList 的碎片化声明。
 */
export const CAPABILITY_REGISTRY = {
  // ── First-Party Complex Plugins ──
  'living-codex': {
    category: 'worldbuilding',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'inspector', 'drawer', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
  },
  'promise-ledger': {
    category: 'plot',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'drawer', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
  },
  'timeline-grid': {
    category: 'plot',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
  },
  'diff-reviewer': {
    category: 'format',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: true,
    mutatesCanonicalState: false,
  },
  'consistency-sentinel': {
    category: 'intelligence',
    maturity: 'beta',
    surfaces: ['inspector', 'drawer', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: false,
  },
  'memory-palace': {
    category: 'intelligence',
    maturity: 'beta',
    surfaces: ['navigation', 'canvas', 'drawer', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: false,
  },
  'water-meter': {
    category: 'experimental',
    maturity: 'experimental',
    surfaces: ['drawer', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: false,
  },
  'multiverse-whatif': {
    category: 'experimental',
    maturity: 'demo',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: false,
  },
  'storyboard-gen': {
    category: 'experimental',
    maturity: 'demo',
    surfaces: ['navigation', 'canvas', 'drawer', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: false,
  },

  // ── Core Domain Modules (from TAB_DEFINITIONS) ──
  // 开书定位
  positioning: {
    category: 'core',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '开书商业档案：赛道、平台、读者、卖点及差异化定位',
  },
  worldbase: {
    category: 'worldbuilding',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '世界总览、底层法则、社会文明与成长地图顶层档案',
  },
  power: {
    category: 'worldbuilding',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '力量来源、境界阶梯、能力门槛、克制关系与金手指接口',
  },

  // 大纲规划
  master: {
    category: 'plot',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '主线内核、反派序列、大结局及各卷境界规划母表',
  },
  'volume-outline': {
    category: 'plot',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '百万字各卷起承转合、核心矛盾与高潮规划',
  },
  'chapter-outline': {
    category: 'plot',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '单章细纲事件、出场人物、伏笔埋设与节奏卡点',
  },
  'chapter-master': {
    category: 'plot',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '全书章节序列、字数状态与发布节奏总览',
  },

  // 角色管理
  'char-main': {
    category: 'worldbuilding',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'drawer', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '主角团、主线对手与关键角色的核心性格、动机与弧光',
  },
  'char-secondary': {
    category: 'worldbuilding',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'drawer', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '阶段性对手、导师与重要配角档案',
  },
  'char-npc': {
    category: 'worldbuilding',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'drawer', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '功能型与过客角色档案',
  },
  relations: {
    category: 'worldbuilding',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '网状人物好感度、血缘、宗门及利益羁绊网络',
  },

  // 世界构建
  nations: {
    category: 'worldbuilding',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '诸侯皇朝、宗门圣地与隐世派系设定',
  },
  'faction-rels': {
    category: 'worldbuilding',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '势力间外交、同盟、世仇与利益博弈格局',
  },
  geography: {
    category: 'worldbuilding',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '洲域、名山大川、城邑秘境与气候风貌',
  },
  'geography-map': {
    category: 'worldbuilding',
    maturity: 'beta',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
  },
  races: {
    category: 'worldbuilding',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '原生神族、妖兽妖灵、荒古异种谱系',
  },
  items: {
    category: 'worldbuilding',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '天材地宝、灵丹妙药、神兵法宝体系',
  },
  history: {
    category: 'worldbuilding',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '纪元兴衰、上古大战与开宗立派重大年表',
  },
  terms: {
    category: 'worldbuilding',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '专有名词、功法秘术词汇表与释义',
  },

  // 创作管理
  foreshadow: {
    category: 'plot',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '长线伏笔埋设与回收状态点检',
  },
  timeline: {
    category: 'plot',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '故事发展线性时间线与事件节点',
  },
  'plot-canvas': {
    category: 'plot',
    maturity: 'beta',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '白板化自由推演高潮情节与剧情支线',
  },
  hookpoints: {
    category: 'plot',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '先抑后扬节奏、打脸期待感与释放排布',
  },
  progress: {
    category: 'core',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: false,
    description: '日更字数、月度进度与存稿余量看板',
  },
  subplots: {
    category: 'plot',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '穿插支线、独立副本与合流节点规划',
  },
  secrets: {
    category: 'plot',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '双盲信息差、角色视野与真相揭示时序',
  },

  // 运营维护
  style: {
    category: 'format',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: false,
    description: '人称视角、标点格式、文风禁忌与自检准则',
  },
  changelog: {
    category: 'core',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: false,
    description: '长篇创作设定修订日志与版本差异记录',
  },
  ideas: {
    category: 'core',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: false,
    description: '随手灵感火花、好词金句与备忘素材箱',
  },
  feedback: {
    category: 'core',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: false,
    description: '段评章评热度、毒点吐槽与反馈备忘',
  },
  about: {
    category: 'core',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: false,
    description: '平台粉丝互动、打赏感谢与周边记录',
  },

  // 工作面板与工具
  dashboard: {
    category: 'core',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: false,
    description: '全书字数、最近章节与核心数据综合看板',
  },
  guide: {
    category: 'core',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: false,
    description: '网文创作方法论与各模块详细使用指南',
  },
  'inspire-tools': {
    category: 'core',
    maturity: 'beta',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: false,
    description: '卡文破局工具箱与剧情发散生成器',
  },
  'check-tools': {
    category: 'core',
    maturity: 'beta',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: false,
    description: '错别字、敏感词与违规点检工具集',
  },
} as const satisfies Record<string, CapabilityOverlay>

/** The hand-judged half of a capability. `capabilityFor` is the one that returns a complete descriptor. */
export function getCapabilityOverlay(id: string): CapabilityOverlay | undefined {
  return CAPABILITY_REGISTRY[id as keyof typeof CAPABILITY_REGISTRY]
}

/**
 * 抽屉的三类能力形态（§P2.8）。抽屉不按插件数排列，按「作者此刻要做什么」排列：
 * 对照设定、动一次稿、还是让系统挑毛病。注册表里每个抽屉都必须落到其中一类，
 * 所以写作台的抽屉选择器就按这三类分组，打开后的抽屉标题也说明它是哪一类。
 */
export const PLUGIN_DRAWER_CAPABILITIES: {
  id: PluginDrawerCapability
  label: string
  hint: string
}[] = [
  {
    id: 'context-inspector',
    label: '上下文检视',
    hint: '对照当前正文查看设定、伏笔与状态，不改动稿子',
  },
  {
    id: 'quick-action',
    label: '快捷动作',
    hint: '生成或改写正文，结果仍需你确认采纳',
  },
  {
    id: 'live-diagnostic',
    label: '实时诊断',
    hint: '持续检查当前正文，把问题列成清单',
  },
]

/** 数组顺序即分组展示顺序，也是「同一类内部按注册表原序」的前提。 */
export const PLUGIN_DRAWER_CAPABILITY_ORDER: PluginDrawerCapability[] =
  PLUGIN_DRAWER_CAPABILITIES.map((capability) => capability.id)

export function drawerCapabilityLabel(capability: PluginDrawerCapability): string {
  return PLUGIN_DRAWER_CAPABILITIES.find((item) => item.id === capability)?.label ?? capability
}
