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
} as const satisfies Record<string, CapabilityDescriptor>

export function getCapability(id: string): CapabilityDescriptor | undefined {
  return CAPABILITY_REGISTRY[id as keyof typeof CAPABILITY_REGISTRY]
}
