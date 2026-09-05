import { lazy, type ComponentType } from 'react'
import type { DesktopPlugin, DesktopPluginCategory } from '../types/plugin'
import {
  Layers,
  BookOpen,
  Clock,
  ShieldCheck,
  Heart,
  Palette,
  Sparkles,
  Award,
  Gauge,
  Flame,
  Anchor,
  GitBranch,
  Droplet,
  BookMarked,
  MessageSquare,
  Users,
  DollarSign,
  Castle,
  Printer,
  TrendingUp,
  GitMerge,
  Lightbulb,
  UserCheck,
  Crosshair,
  Music,
  MapPin,
  Swords,
  Calendar,
  Eye,
  AlertCircle,
  GitCompare,
  Lock,
  Headphones,
  Recycle,
  RefreshCw,
  EyeOff,
  Radio,
  Activity,
  Star,
  UserX,
  Cpu,
  Split,
  Mic,
  Film,
} from 'lucide-react'

export interface PluginStaticDefinition {
  id: string
  name: string
  description: string
  version: string
  author?: string
  category: DesktopPluginCategory
  icon: ComponentType<{ className?: string }>
  tags?: string[]
  enabledByDefault?: boolean
  loadMainView: () => Promise<{ default: ComponentType<any> }>
  loadDrawerSnippetView?: () => Promise<{ default: ComponentType<any> }>
  aiCapabilities?: DesktopPlugin['aiCapabilities']
}

export const ALL_PLUGIN_DEFINITIONS: PluginStaticDefinition[] = [
  {
    id: 'living-codex',
    name: '活体世界观',
    description: '8大世界观实体图谱管理与 Aho-Corasick 正文实时扫描感知',
    version: '1.0.0',
    author: 'InkPi Core Team',
    category: 'lore',
    tags: ['世界书', '实体图谱', 'AC扫描', '智能提示'],
    enabledByDefault: true,
    icon: Layers,
    loadMainView: () =>
      import('../plugins/living-codex').then((m) => ({ default: m.CodexMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/living-codex').then((m) => ({ default: m.CodexWriterDrawer })),
  },
  {
    id: 'promise-ledger',
    name: '伏笔账本',
    description: '3P 伏笔追踪、读者记忆衰减模型与叙事债务监控',
    version: '1.0.0',
    category: 'plot',
    tags: ['伏笔', '债务', '记忆衰减', '契诃夫之枪'],
    enabledByDefault: true,
    icon: BookOpen,
    loadMainView: () =>
      import('../plugins/promise-ledger').then((m) => ({ default: m.LedgerMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/promise-ledger').then((m) => ({ default: m.LedgerWriterDrawer })),
  },
  {
    id: 'timeline-grid',
    name: '因果时空网',
    description: '时空因果大纲、Kahn 拓扑排序死循环检测与章节冲突预警',
    version: '1.0.0',
    category: 'plot',
    tags: ['时间线', '因果律', '拓扑排序', '冲突预警'],
    enabledByDefault: true,
    icon: Clock,
    loadMainView: () =>
      import('../plugins/timeline-grid').then((m) => ({ default: m.TimelineGridView })),
  },
  {
    id: 'safe-gate',
    name: '安全门禁',
    description: '三级网规敏感词雷达与文学风味智能平替系统',
    version: '1.0.0',
    category: 'review',
    tags: ['合规', '敏感词', '文学平替', 'AC自动机'],
    enabledByDefault: true,
    icon: ShieldCheck,
    loadMainView: () => import('../plugins/safe-gate').then((m) => ({ default: m.SafeGateView })),
    loadDrawerSnippetView: () =>
      import('../plugins/safe-gate').then((m) => ({ default: m.SafeGateDrawer })),
  },
  {
    id: 'scene-beats',
    name: '场景节拍',
    description: '正负情感极性反转与 5 级戏剧张力节奏编排',
    version: '1.0.0',
    category: 'plot',
    tags: ['节拍', '张力', '情绪反转', '戏剧弧'],
    enabledByDefault: true,
    icon: Heart,
    loadMainView: () =>
      import('../plugins/scene-beats').then((m) => ({ default: m.SceneBeatsMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/scene-beats').then((m) => ({ default: m.SceneBeatsDrawer })),
  },
  {
    id: 'describe-palette',
    name: '描写调色盘',
    description: '五感微观修辞调色盘与通感金句库',
    version: '1.0.0',
    category: 'craft',
    tags: ['五感', '修辞', '词库', '通感'],
    enabledByDefault: true,
    icon: Palette,
    loadMainView: () =>
      import('../plugins/describe-palette').then((m) => ({ default: m.DescribePaletteView })),
    loadDrawerSnippetView: () =>
      import('../plugins/describe-palette').then((m) => ({ default: m.DescribePaletteDrawer })),
  },
  {
    id: 'name-forge',
    name: '起名姬',
    description: 'CFG 与平仄声韵采样的东方仙侠与西幻命名工坊',
    version: '1.0.0',
    category: 'craft',
    tags: ['起名', '音律', '平仄', '宗门'],
    enabledByDefault: true,
    icon: Sparkles,
    loadMainView: () => import('../plugins/name-forge').then((m) => ({ default: m.NameForgeView })),
    loadDrawerSnippetView: () =>
      import('../plugins/name-forge').then((m) => ({ default: m.NameForgeDrawer })),
  },
  {
    id: 'expectation-engine',
    name: '期待感引擎',
    description: '读者期待势能契约与抑扬释放曲线',
    version: '1.0.0',
    category: 'rhythm',
    tags: ['期待感', '情绪释放', '爽点', '先抑后扬'],
    enabledByDefault: true,
    icon: Award,
    loadMainView: () =>
      import('../plugins/expectation-engine').then((m) => ({ default: m.ExpectationMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/expectation-engine').then((m) => ({ default: m.ExpectationDrawer })),
  },
  {
    id: 'consistency-sentinel',
    name: '一致性哨兵',
    description: '严格境界体系偏序传递闭包与角色生死状态冲突审计',
    version: '1.0.0',
    category: 'review',
    tags: ['境界体系', '一致性', '偏序闭包', '战力崩坏'],
    enabledByDefault: true,
    icon: Gauge,
    loadMainView: () =>
      import('../plugins/consistency-sentinel').then((m) => ({ default: m.ConsistencyMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/consistency-sentinel').then((m) => ({ default: m.ConsistencyDrawer })),
  },
  {
    id: 'sprint-arena',
    name: '心流竞技场',
    description: '实时打字速度 WPM 测速、心流连击与打字竞技场',
    version: '1.0.0',
    category: 'flow',
    tags: ['WPM', '码字速度', '心流', '专注模式'],
    enabledByDefault: true,
    icon: Flame,
    loadMainView: () =>
      import('../plugins/sprint-arena').then((m) => ({ default: m.SprintArenaMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/sprint-arena').then((m) => ({ default: m.SprintArenaDrawer })),
  },
  {
    id: 'reader-hook',
    name: '黄金三章与钩子',
    description: '章末倒计时、认知颠覆与断章钩子审计',
    version: '1.0.0',
    category: 'rhythm',
    tags: ['断章', '钩子', '黄金三章', '留存转化'],
    enabledByDefault: true,
    icon: Anchor,
    loadMainView: () =>
      import('../plugins/reader-hook').then((m) => ({ default: m.ReaderHookMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/reader-hook').then((m) => ({ default: m.ReaderHookDrawer })),
  },
  {
    id: 'clue-weaver',
    name: '线索织机',
    description: '多主线交织推理、双盲信息差与红鲱鱼假线索网',
    version: '1.0.0',
    category: 'plot',
    tags: ['悬疑', '红鲱鱼', '信息差', '线索链'],
    enabledByDefault: true,
    icon: GitBranch,
    loadMainView: () =>
      import('../plugins/clue-weaver').then((m) => ({ default: m.ClueWeaverMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/clue-weaver').then((m) => ({ default: m.ClueWeaverDrawer })),
  },
  {
    id: 'water-meter',
    name: '字数水分表',
    description: '香农信息熵测算、套话水词定位与脱水脱脂建议',
    version: '1.0.0',
    category: 'review',
    tags: ['信息熵', '水文分析', '精简', '动词密度'],
    enabledByDefault: true,
    icon: Droplet,
    loadMainView: () =>
      import('../plugins/water-meter').then((m) => ({ default: m.WaterMeterMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/water-meter').then((m) => ({ default: m.WaterMeterDrawer })),
  },
  {
    id: 'volume-master',
    name: '分卷架构师',
    description: '百万字长篇分卷规划、OLS多项式戏剧弧回归与燃尽率审计',
    version: '1.0.0',
    category: 'plot',
    tags: ['分卷', '戏剧弧', '燃尽率', '三幕剧'],
    enabledByDefault: true,
    icon: BookMarked,
    loadMainView: () =>
      import('../plugins/volume-master').then((m) => ({ default: m.VolumeMasterMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/volume-master').then((m) => ({ default: m.VolumeMasterDrawer })),
  },
  {
    id: 'dialogue-distiller',
    name: '对话精炼器',
    description: '对白声纹特征、废话率审计与口吻个性化提纯',
    version: '1.0.0',
    category: 'craft',
    tags: ['对白', '声纹', '废话率', '人物口癖'],
    enabledByDefault: true,
    icon: MessageSquare,
    loadMainView: () =>
      import('../plugins/dialogue-distiller').then((m) => ({
        default: m.DialogueDistillerMasterView,
      })),
    loadDrawerSnippetView: () =>
      import('../plugins/dialogue-distiller').then((m) => ({ default: m.DialogueDistillerDrawer })),
  },
  {
    id: 'faction-matrix',
    name: '势力外交盘',
    description: '门派好感度五段演化、势力声望与结盟反目动态网',
    version: '1.0.0',
    category: 'lore',
    tags: ['门派', '好感度', '外交', '天下大势'],
    enabledByDefault: true,
    icon: Users,
    loadMainView: () =>
      import('../plugins/faction-matrix').then((m) => ({ default: m.FactionMatrixMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/faction-matrix').then((m) => ({ default: m.FactionMatrixDrawer })),
  },
  {
    id: 'paywall-sentry',
    name: '上架卡点哨兵',
    description: 'PPI 付费卡点势能指数评估与毒点弃书风险预警',
    version: '1.0.0',
    category: 'rhythm',
    tags: ['首订', '上架卡点', '悬念留白', '防流失'],
    enabledByDefault: true,
    icon: DollarSign,
    loadMainView: () =>
      import('../plugins/paywall-sentry').then((m) => ({ default: m.PaywallSentryMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/paywall-sentry').then((m) => ({ default: m.PaywallSentryDrawer })),
  },
  {
    id: 'memory-palace',
    name: '记忆宫殿',
    description: '三层空间层次卡片、暗格秘密与多机位场景速览',
    version: '1.0.0',
    category: 'lore',
    tags: ['空间', '场景', '地图', '空间层次'],
    enabledByDefault: true,
    icon: Castle,
    loadMainView: () =>
      import('../plugins/memory-palace').then((m) => ({ default: m.MemoryPalaceMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/memory-palace').then((m) => ({ default: m.MemoryPalaceDrawer })),
  },
  {
    id: 'press-forge',
    name: '出版铸造厂',
    description: '专业实体书排版规范、出版元数据校验与版权归档',
    version: '1.0.0',
    category: 'tools',
    tags: ['出版', '排版', '开本', '版权页'],
    enabledByDefault: true,
    icon: Printer,
    loadMainView: () =>
      import('../plugins/press-forge').then((m) => ({ default: m.PressForgeMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/press-forge').then((m) => ({ default: m.PressForgeDrawer })),
  },
  {
    id: 'emotion-curve',
    name: '情绪张力曲线',
    description: '全书章节情绪正负极性流动与过山车心跳图谱',
    version: '1.0.0',
    category: 'rhythm',
    tags: ['情绪流', '心跳线', '起伏', '折线图'],
    enabledByDefault: true,
    icon: TrendingUp,
    loadMainView: () =>
      import('../plugins/emotion-curve').then((m) => ({ default: m.EmotionCurveMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/emotion-curve').then((m) => ({ default: m.EmotionCurveDrawer })),
  },
  {
    id: 'sub-plot-braid',
    name: '副线编织器',
    description: '主线与多支线交错拓扑编织、主仆伴生与副线闭环监控',
    version: '1.0.0',
    category: 'plot',
    tags: ['支线', '多线交错', '编织', '群像'],
    enabledByDefault: true,
    icon: GitMerge,
    loadMainView: () =>
      import('../plugins/sub-plot-braid').then((m) => ({ default: m.SubPlotBraidMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/sub-plot-braid').then((m) => ({ default: m.SubPlotBraidDrawer })),
  },
  {
    id: 'brainstorm-spark',
    name: '破局灵感火花',
    description: 'SCAMPER 卡死破局策略与反常理思维碰撞',
    version: '1.0.0',
    category: 'craft',
    tags: ['灵感', '卡文破局', 'SCAMPER', '脑洞'],
    enabledByDefault: true,
    icon: Lightbulb,
    loadMainView: () =>
      import('../plugins/brainstorm-spark').then((m) => ({ default: m.BrainstormSparkMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/brainstorm-spark').then((m) => ({ default: m.BrainstormSparkDrawer })),
  },
  {
    id: 'reader-simulator',
    name: '虚拟读者群',
    description: '5 类挑剔网文受众群画像、阅读耐受度与吐槽预演',
    version: '1.0.0',
    category: 'review',
    tags: ['读者视角', '吐槽', '毒点排查', '用户画像'],
    enabledByDefault: true,
    icon: UserCheck,
    loadMainView: () =>
      import('../plugins/reader-simulator').then((m) => ({ default: m.ReaderSimulatorMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/reader-simulator').then((m) => ({ default: m.ReaderSimulatorDrawer })),
  },
  {
    id: 'chekhov-radar',
    name: '契诃夫之枪',
    description: '伏笔半衰期监测、30章锈蚀警报与闭环回响雷达',
    version: '1.0.0',
    category: 'plot',
    tags: ['契诃夫之枪', '伏笔预警', '锈蚀率', '闭环率'],
    enabledByDefault: true,
    icon: Crosshair,
    loadMainView: () =>
      import('../plugins/chekhov-radar').then((m) => ({ default: m.ChekhovRadarMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/chekhov-radar').then((m) => ({ default: m.ChekhovRadarDrawer })),
  },
  {
    id: 'rhythm-metronome',
    name: '节奏节拍器',
    description: '长短句交错音律波长、声韵平仄律动与行文呼吸感',
    version: '1.0.0',
    category: 'craft',
    tags: ['句式长短', '韵律', '节奏感', '波长'],
    enabledByDefault: true,
    icon: Music,
    loadMainView: () =>
      import('../plugins/rhythm-metronome').then((m) => ({ default: m.RhythmMetronomeMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/rhythm-metronome').then((m) => ({ default: m.RhythmMetronomeDrawer })),
  },
  {
    id: 'geography-map',
    name: '山川地理图',
    description: '大千世界多层网格坐标、行军里程天数与传送阵网络',
    version: '1.0.0',
    category: 'lore',
    tags: ['地图', '坐标', '行军日程', '地理空间'],
    enabledByDefault: true,
    icon: MapPin,
    loadMainView: () =>
      import('../plugins/geography-map').then((m) => ({ default: m.GeographyMapMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/geography-map').then((m) => ({ default: m.GeographyMapDrawer })),
  },
  {
    id: 'combat-sandbox',
    name: '战力推演沙盘',
    description: '境界压制战力计算器、越级胜率与爆种崩坏预警',
    version: '1.0.0',
    category: 'review',
    tags: ['战力', '越级战斗', '数值平衡', '胜率推演'],
    enabledByDefault: true,
    icon: Swords,
    loadMainView: () =>
      import('../plugins/combat-sandbox').then((m) => ({ default: m.CombatSandboxMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/combat-sandbox').then((m) => ({ default: m.CombatSandboxDrawer })),
  },
  {
    id: 'multi-calendar',
    name: '多重纪元历法',
    description: '上古灵历与帝国历法并行、绝对天数对齐与时间悖论审计',
    version: '1.0.0',
    category: 'lore',
    tags: ['历法', '纪元', '时间线', '换算'],
    enabledByDefault: true,
    icon: Calendar,
    loadMainView: () =>
      import('../plugins/multi-calendar').then((m) => ({ default: m.MultiCalendarMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/multi-calendar').then((m) => ({ default: m.MultiCalendarDrawer })),
  },
  {
    id: 'pov-guard',
    name: '视角守门人',
    description: '第一/第三人称越权感知与全知盲点视角混乱报警',
    version: '1.0.0',
    category: 'review',
    tags: ['视角', 'POV', '乱视角', '人称'],
    enabledByDefault: true,
    icon: Eye,
    loadMainView: () =>
      import('../plugins/pov-guard').then((m) => ({ default: m.PovGuardMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/pov-guard').then((m) => ({ default: m.PovGuardDrawer })),
  },
  {
    id: 'narrative-linter',
    name: '叙事质检仪',
    description: '被动语态滥用、说教口播、无主句与机械翻译腔规则审查',
    version: '1.0.0',
    category: 'review',
    tags: ['语病', 'Linter', '修辞瑕疵', '质检'],
    enabledByDefault: true,
    icon: AlertCircle,
    loadMainView: () =>
      import('../plugins/narrative-linter').then((m) => ({ default: m.NarrativeLinterMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/narrative-linter').then((m) => ({ default: m.NarrativeLinterDrawer })),
  },
  {
    id: 'diff-reviewer',
    name: '双栏审校合稿',
    description: 'Myers 算法行内词级对比、独立 Hunk 采纳与无损合并',
    version: '1.0.0',
    category: 'tools',
    tags: ['Diff', '版本对比', '合稿', '审校'],
    enabledByDefault: true,
    icon: GitCompare,
    loadMainView: () =>
      import('../plugins/diff-reviewer').then((m) => ({ default: m.DiffReviewerMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/diff-reviewer').then((m) => ({ default: m.DiffReviewerDrawer })),
  },
  {
    id: 'iron-chamber',
    name: '铁牢逻辑自洽',
    description: '世界观公理设定不可侵犯性与降智光环逻辑闭环测试',
    version: '1.0.0',
    category: 'review',
    tags: ['公理', '降智排查', '逻辑自洽', '反噬'],
    enabledByDefault: true,
    icon: Lock,
    loadMainView: () =>
      import('../plugins/iron-chamber').then((m) => ({ default: m.IronChamberMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/iron-chamber').then((m) => ({ default: m.IronChamberDrawer })),
  },
  {
    id: 'soundscape',
    name: '白噪音音效',
    description: '纯 Web Audio 物理声学建模机械键盘音与沉浸白噪音',
    version: '1.0.0',
    category: 'flow',
    tags: ['机械键盘', '白噪音', '沉浸音效', '心流'],
    enabledByDefault: true,
    icon: Headphones,
    loadMainView: () =>
      import('../plugins/soundscape').then((m) => ({ default: m.SoundscapeMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/soundscape').then((m) => ({ default: m.SoundscapeDrawer })),
  },
  {
    id: 'scrapbook-recycler',
    name: '废稿回收站',
    description: '未采纳支线段落分类冷藏与跨章节再提取利用',
    version: '1.0.0',
    category: 'tools',
    tags: ['废稿', '碎屑回收', '草稿箱', '资产复用'],
    enabledByDefault: true,
    icon: Recycle,
    loadMainView: () =>
      import('../plugins/scrapbook-recycler').then((m) => ({ default: m.ScrapbookMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/scrapbook-recycler').then((m) => ({ default: m.ScrapbookDrawer })),
  },
  {
    id: 'aftermath-sync',
    name: '战后状态同步',
    description: '大战后角色伤残消耗、法宝损毁与宗门死伤级联打补丁',
    version: '1.0.0',
    category: 'lore',
    tags: ['战后清点', '伤残同步', '底蕴损耗', '级联更新'],
    enabledByDefault: true,
    icon: RefreshCw,
    loadMainView: () =>
      import('../plugins/aftermath-sync').then((m) => ({ default: m.AftermathMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/aftermath-sync').then((m) => ({ default: m.AftermathDrawer })),
  },
  {
    id: 'subtext-compiler',
    name: '微表情与潜台词',
    description: '口是心非表里不一剧作法、微表情反差与潜台词编译器',
    version: '1.0.0',
    category: 'craft',
    tags: ['潜台词', '微表情', '心理对白', '戏剧反差'],
    enabledByDefault: true,
    icon: EyeOff,
    loadMainView: () =>
      import('../plugins/subtext-compiler').then((m) => ({ default: m.SubtextMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/subtext-compiler').then((m) => ({ default: m.SubtextDrawer })),
  },
  {
    id: 'archetype-cards',
    name: '原型人物卡',
    description: '荣格 12 原型投射、三维角色动机与人物关系雷达',
    version: '1.0.0',
    category: 'lore',
    tags: ['人物卡', '原型', '动机', '立体人物'],
    enabledByDefault: true,
    icon: Radio,
    loadMainView: () =>
      import('../plugins/archetype-cards').then((m) => ({ default: m.ArchetypeMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/archetype-cards').then((m) => ({ default: m.ArchetypeDrawer })),
  },
  {
    id: 'rhythm-radar',
    name: '断章雷达',
    description: '单章张力指数 T(c) 分析与 4 大黄金断章切口推荐',
    version: '1.0.0',
    category: 'rhythm',
    tags: ['断章', '张力指数', '生死反转', '追更率'],
    enabledByDefault: true,
    icon: Activity,
    loadMainView: () =>
      import('../plugins/rhythm-radar').then((m) => ({ default: m.RhythmRadarMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/rhythm-radar').then((m) => ({ default: m.RhythmRadarDrawer })),
  },
  {
    id: 'gold-chapters-eval',
    name: '黄金前三章评估',
    description: '前 3 章节奏、留存力与网文签约门槛全方位打分评估',
    version: '1.0.0',
    category: 'rhythm',
    tags: ['黄金三章', '签约评估', '留存测试', '前瞻诊断'],
    enabledByDefault: true,
    icon: Star,
    loadMainView: () =>
      import('../plugins/gold-chapters-eval').then((m) => ({ default: m.GoldChaptersMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/gold-chapters-eval').then((m) => ({ default: m.GoldChaptersDrawer })),
  },
  {
    id: 'shadow-reader',
    name: '读者影子视角',
    description: '零上帝视角正文盲审、情报获取时序重构与误读排查',
    version: '1.0.0',
    category: 'review',
    tags: ['信息差', '读者视角', '盲审', '伏笔接收度'],
    enabledByDefault: true,
    icon: UserX,
    loadMainView: () =>
      import('../plugins/shadow-reader').then((m) => ({ default: m.ShadowReaderMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/shadow-reader').then((m) => ({ default: m.ShadowReaderDrawer })),
  },
  {
    id: 'author-ops',
    name: '作者看板',
    description: '全书连载日历、日均更新字数统计与码字战报输出',
    version: '1.0.0',
    category: 'flow',
    tags: ['看板', '战报', '连载日历', '写作效率'],
    enabledByDefault: true,
    icon: Cpu,
    loadMainView: () =>
      import('../plugins/author-ops').then((m) => ({ default: m.AuthorOpsMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/author-ops').then((m) => ({ default: m.AuthorOpsDrawer })),
  },
  {
    id: 'multiverse-whatif',
    name: '平行推演 What-If',
    description: '关键抉择分叉点推演、平行命运线与剧情走向多分支',
    version: '1.0.0',
    category: 'plot',
    tags: ['What-If', '分叉推演', '命运线', '蝴蝶效应'],
    enabledByDefault: true,
    icon: Split,
    loadMainView: () =>
      import('../plugins/multiverse-whatif').then((m) => ({ default: m.MultiverseMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/multiverse-whatif').then((m) => ({ default: m.MultiverseDrawer })),
  },
  {
    id: 'voice-preview',
    name: '台词试音室',
    description: '角色台词多角色分配与 Web Speech 语音实时朗读预览',
    version: '1.0.0',
    category: 'craft',
    tags: ['TTS', '语音试听', '角色对白', '有声预览'],
    enabledByDefault: true,
    icon: Mic,
    loadMainView: () =>
      import('../plugins/voice-preview').then((m) => ({ default: m.VoicePreviewMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/voice-preview').then((m) => ({ default: m.VoicePreviewDrawer })),
  },
  {
    id: 'storyboard-gen',
    name: '动漫分镜工坊',
    description: '高潮场景 9 宫格动漫分镜生成与景别机位编排',
    version: '1.0.0',
    category: 'craft',
    tags: ['分镜', '画面感', '九宫格', '景别机位'],
    enabledByDefault: true,
    icon: Film,
    loadMainView: () =>
      import('../plugins/storyboard-gen').then((m) => ({ default: m.StoryboardMasterView })),
    loadDrawerSnippetView: () =>
      import('../plugins/storyboard-gen').then((m) => ({ default: m.StoryboardDrawer })),
  },
]

/**
 * 将轻量静态定义转化为支持懒加载的实际 DesktopPlugin 实例
 */
export function materializeLazyPlugin(def: PluginStaticDefinition): DesktopPlugin {
  const LazyMainView = lazy(def.loadMainView)
  const LazyDrawer = def.loadDrawerSnippetView ? lazy(def.loadDrawerSnippetView) : undefined

  return {
    id: def.id,
    name: def.name,
    description: def.description,
    version: def.version,
    author: def.author,
    category: def.category,
    icon: def.icon,
    tags: def.tags,
    enabledByDefault: def.enabledByDefault,
    mainView: LazyMainView,
    drawerSnippetView: LazyDrawer,
    aiCapabilities: def.aiCapabilities,
  }
}

/**
 * 生成全量懒加载的插件列表（按需进行 Chunk 加载）
 */
export const ALL_LAZY_PLUGINS: DesktopPlugin[] = ALL_PLUGIN_DEFINITIONS.map(materializeLazyPlugin)
