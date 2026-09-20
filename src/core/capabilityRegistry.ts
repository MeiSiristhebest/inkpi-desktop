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

export interface CapabilityDescriptor {
  id: string
  name: string
  category: 'core' | 'worldbuilding' | 'plot' | 'intelligence' | 'format' | 'experimental'
  maturity: CapabilityMaturity
  surfaces: CapabilitySurface[]

  /** 是否直接修改正文章节内容 */
  mutatesDocument: boolean
  /** 是否修改正典世界观事实 (StoryState / Codex) */
  mutatesCanonicalState: boolean

  description: string
}

/**
 * 统一能力分类注册中心 (P2.1, P2.2, INV-10):
 * 替代过去散落在各个 TAB_DEFINITIONS / PluginList 的碎片化声明。
 */
export const CAPABILITY_REGISTRY = {
  // ── First-Party Complex Plugins ──
  'living-codex': {
    id: 'living-codex',
    name: '世界设定集 (Living Codex)',
    category: 'worldbuilding',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'inspector', 'drawer', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '结构化世界观、角色、势力、宗门及概念关系图谱',
  },
  'promise-ledger': {
    id: 'promise-ledger',
    name: '伏笔总账 (Promise Ledger)',
    category: 'plot',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'drawer', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '追踪伏笔埋设、演进状态与回收偿付甘特图',
  },
  'timeline-grid': {
    id: 'timeline-grid',
    name: '时间线矩阵 (Timeline Grid)',
    category: 'plot',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '多线叙事因果图与冲突对齐矩阵',
  },
  'diff-reviewer': {
    id: 'diff-reviewer',
    name: '双栏审校 (Diff Reviewer)',
    category: 'format',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: true,
    mutatesCanonicalState: false,
    description: '基于 Myers 最短编辑算法的差异采纳与 CAS 正文原子写回',
  },
  'consistency-sentinel': {
    id: 'consistency-sentinel',
    name: '连续性哨兵 (Consistency Sentinel)',
    category: 'intelligence',
    maturity: 'beta',
    surfaces: ['inspector', 'drawer', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: false,
    description: '深度校验前后章节逻辑、时间线与角色设定一致性',
  },
  'memory-palace': {
    id: 'memory-palace',
    name: '记忆宫殿 (Memory Palace)',
    category: 'intelligence',
    maturity: 'beta',
    surfaces: ['navigation', 'canvas', 'drawer', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: false,
    description: '智能扫描实体在全书各章节的出场频率与分布',
  },
  'water-meter': {
    id: 'water-meter',
    name: '水文水分计 (Water Meter)',
    category: 'experimental',
    maturity: 'experimental',
    surfaces: ['drawer', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: false,
    description: '基于短语冗余与描写密度的即时规则水分检测',
  },
  'multiverse-whatif': {
    id: 'multiverse-whatif',
    name: '多重宇宙分支 (Multiverse)',
    category: 'experimental',
    maturity: 'demo',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: false,
    description: '设定分支推演与蝴蝶效应剧情实验',
  },

  // ── Core Domain Modules (from TAB_DEFINITIONS) ──
  // 开书定位
  positioning: {
    id: 'positioning',
    name: '作品定位',
    category: 'core',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '开书商业档案：赛道、平台、读者、卖点及差异化定位',
  },
  worldbase: {
    id: 'worldbase',
    name: '世界设定',
    category: 'worldbuilding',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '世界总览、底层法则、社会文明与成长地图顶层档案',
  },
  power: {
    id: 'power',
    name: '力量体系',
    category: 'worldbuilding',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '力量来源、境界阶梯、能力门槛、克制关系与金手指接口',
  },

  // 大纲规划
  master: {
    id: 'master',
    name: '全书总纲',
    category: 'plot',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '主线内核、反派序列、大结局及各卷境界规划母表',
  },
  'volume-outline': {
    id: 'volume-outline',
    name: '分卷大纲',
    category: 'plot',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '百万字各卷起承转合、核心矛盾与高潮规划',
  },
  'chapter-outline': {
    id: 'chapter-outline',
    name: '章节细纲',
    category: 'plot',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '单章细纲事件、出场人物、伏笔埋设与节奏卡点',
  },
  'chapter-master': {
    id: 'chapter-master',
    name: '章节总表',
    category: 'plot',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '全书章节序列、字数状态与发布节奏总览',
  },

  // 角色管理
  'char-main': {
    id: 'char-main',
    name: '主要角色',
    category: 'worldbuilding',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'drawer', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '主角团、主线对手与关键角色的核心性格、动机与弧光',
  },
  'char-secondary': {
    id: 'char-secondary',
    name: '次要角色',
    category: 'worldbuilding',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'drawer', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '阶段性对手、导师与重要配角档案',
  },
  'char-npc': {
    id: 'char-npc',
    name: 'NPC角色',
    category: 'worldbuilding',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'drawer', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '功能型与过客角色档案',
  },
  relations: {
    id: 'relations',
    name: '人物关系',
    category: 'worldbuilding',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '网状人物好感度、血缘、宗门及利益羁绊网络',
  },

  // 世界构建
  nations: {
    id: 'nations',
    name: '国家势力',
    category: 'worldbuilding',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '诸侯皇朝、宗门圣地与隐世派系设定',
  },
  'faction-rels': {
    id: 'faction-rels',
    name: '势力关系',
    category: 'worldbuilding',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '势力间外交、同盟、世仇与利益博弈格局',
  },
  geography: {
    id: 'geography',
    name: '地理风物',
    category: 'worldbuilding',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '洲域、名山大川、城邑秘境与气候风貌',
  },
  'geography-map': {
    id: 'geography-map',
    name: '地图编辑',
    category: 'worldbuilding',
    maturity: 'beta',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '可视化大陆网格地图与行军路线',
  },
  races: {
    id: 'races',
    name: '种族生物',
    category: 'worldbuilding',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '原生神族、妖兽妖灵、荒古异种谱系',
  },
  items: {
    id: 'items',
    name: '物品资源',
    category: 'worldbuilding',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '天材地宝、灵丹妙药、神兵法宝体系',
  },
  history: {
    id: 'history',
    name: '历史事件',
    category: 'worldbuilding',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '纪元兴衰、上古大战与开宗立派重大年表',
  },
  terms: {
    id: 'terms',
    name: '名词术语',
    category: 'worldbuilding',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '专有名词、功法秘术词汇表与释义',
  },

  // 创作管理
  foreshadow: {
    id: 'foreshadow',
    name: '伏笔追踪',
    category: 'plot',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '长线伏笔埋设与回收状态点检',
  },
  timeline: {
    id: 'timeline',
    name: '时间脉络',
    category: 'plot',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '故事发展线性时间线与事件节点',
  },
  'plot-canvas': {
    id: 'plot-canvas',
    name: '情节推演',
    category: 'plot',
    maturity: 'beta',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '白板化自由推演高潮情节与剧情支线',
  },
  hookpoints: {
    id: 'hookpoints',
    name: '爽点节奏',
    category: 'plot',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '先抑后扬节奏、打脸期待感与释放排布',
  },
  progress: {
    id: 'progress',
    name: '写作进度',
    category: 'core',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: false,
    description: '日更字数、月度进度与存稿余量看板',
  },
  subplots: {
    id: 'subplots',
    name: '支线剧情',
    category: 'plot',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '穿插支线、独立副本与合流节点规划',
  },
  secrets: {
    id: 'secrets',
    name: '知情权限',
    category: 'plot',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: true,
    description: '双盲信息差、角色视野与真相揭示时序',
  },

  // 运营维护
  style: {
    id: 'style',
    name: '写作规范',
    category: 'format',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: false,
    description: '人称视角、标点格式、文风禁忌与自检准则',
  },
  changelog: {
    id: 'changelog',
    name: '设定变更',
    category: 'core',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: false,
    description: '长篇创作设定修订日志与版本差异记录',
  },
  ideas: {
    id: 'ideas',
    name: '灵感素材',
    category: 'core',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: false,
    description: '随手灵感火花、好词金句与备忘素材箱',
  },
  feedback: {
    id: 'feedback',
    name: '读者反馈',
    category: 'core',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: false,
    description: '段评章评热度、毒点吐槽与反馈备忘',
  },
  about: {
    id: 'about',
    name: '关于打赏',
    category: 'core',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: false,
    description: '平台粉丝互动、打赏感谢与周边记录',
  },

  // 工作面板与工具
  dashboard: {
    id: 'dashboard',
    name: '写作面板',
    category: 'core',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: false,
    description: '全书字数、最近章节与核心数据综合看板',
  },
  guide: {
    id: 'guide',
    name: '使用指南',
    category: 'core',
    maturity: 'production',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: false,
    description: '网文创作方法论与各模块详细使用指南',
  },
  'inspire-tools': {
    id: 'inspire-tools',
    name: '灵感启发',
    category: 'core',
    maturity: 'beta',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: false,
    description: '卡文破局工具箱与剧情发散生成器',
  },
  'check-tools': {
    id: 'check-tools',
    name: '检查工具',
    category: 'core',
    maturity: 'beta',
    surfaces: ['navigation', 'canvas', 'command'],
    mutatesDocument: false,
    mutatesCanonicalState: false,
    description: '错别字、敏感词与违规点检工具集',
  },
} as const satisfies Record<string, CapabilityDescriptor>

export function getCapability(id: string): CapabilityDescriptor | undefined {
  return CAPABILITY_REGISTRY[id as keyof typeof CAPABILITY_REGISTRY]
}
