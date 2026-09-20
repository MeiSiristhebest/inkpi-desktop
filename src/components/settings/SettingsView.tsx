import { useState, useEffect, useCallback, useMemo, type FC } from 'react'
import {
  Settings as Gear,
  Palette,
  Sparkles,
  Wifi,
  Info,
  Type,
  Trash2,
  X,
  Puzzle,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Sun,
  Moon,
  Laptop,
  Leaf,
  Feather,
  Trees,
  Zap,
  Plus,
  Edit3,
  Keyboard,
  ChevronDown,
  RotateCcw,
} from 'lucide-react'
import { PluginSettingsView } from '../plugins/PluginSettingsView'
import { WritingHabitsTab } from './WritingHabitsTab'
import { ShortcutsTab } from './ShortcutsTab'
import { clock } from '../../adapters/clock'
import { fetchModelIds, probeModelEndpoint } from '../../adapters/modelProviderProbe'
import {
  useSettings,
  PROVIDER_META,
  type AppSettings,
  type ModelConfig,
  type ThemeMode,
  type FontKind,
  type ParagraphIndent,
  type ThemeSkin,
} from '../../core/settings'
import { MODEL_CATALOG, catalogUpdatedAtLabel, type CatalogMeta } from '../../core/modelCatalog'
import { readCatalogMeta, writeCatalogMeta } from '../../adapters/localStorageCatalogMetaStore'
import { ProviderDetailView } from './ProviderDetailView'
import {
  Section,
  Row,
  Segmented,
  Slider,
  Switch,
  PrimaryButton,
  fieldLabel,
  inputCls,
} from './SettingsShared'

type TabKey =
  'appearance' | 'editor' | 'writing' | 'shortcuts' | 'plugins' | 'ai' | 'connection' | 'about'

const TABS: { key: TabKey; label: string; desc: string; icon: FC<{ className?: string }> }[] = [
  { key: 'appearance', label: '外观', desc: '主题配色、皮肤与界面缩放', icon: Palette },
  { key: 'editor', label: '编辑器', desc: '正文字体、字号与排版规范', icon: Type },
  {
    key: 'writing',
    label: '写作与习惯',
    desc: '自动滚屏、实体高亮、久坐与分章提醒',
    icon: Feather,
  },
  { key: 'shortcuts', label: '快捷键', desc: '键盘键位映射与盲操快捷键', icon: Keyboard },
  { key: 'plugins', label: '插件管理', desc: '小说工作台扩展与实验能力', icon: Puzzle },
  { key: 'ai', label: '自定义 AI 模型', desc: '大模型提供商、密钥与参数', icon: Sparkles },
  { key: 'connection', label: '连接', desc: '本地 Daemon 与服务通信', icon: Wifi },
  { key: 'about', label: '关于', desc: '系统架构、版本与开源致谢', icon: Info },
]

interface ThemeCardItem {
  v: ThemeMode
  label: string
  desc: string
  icon: FC<{ className?: string }>
  bg: string
  sidebar: string
  editor: string
  accent: string
  textCol: string
}

const THEME_CARDS: ThemeCardItem[] = [
  {
    v: 'light',
    label: '浅色',
    desc: '日间高亮模式',
    icon: Sun,
    bg: '#ffffff',
    sidebar: '#f7f7f5',
    editor: '#ffffff',
    accent: '#2383e2',
    textCol: '#37352f',
  },
  {
    v: 'dark',
    label: '深色',
    desc: '暗夜沉浸模式',
    icon: Moon,
    bg: '#181818',
    sidebar: '#222220',
    editor: '#181818',
    accent: '#3894f0',
    textCol: '#e6e6e6',
  },
  {
    v: 'system',
    label: '跟随系统',
    desc: '系统外观同步',
    icon: Laptop,
    bg: 'linear-gradient(135deg, #ffffff 50%, #1e1e1e 50%)',
    sidebar: '#f0f0ed',
    editor: '#ffffff',
    accent: '#2383e2',
    textCol: '#37352f',
  },
]

interface SkinCardItem {
  v: ThemeSkin
  label: string
  subtitle: string
  icon: FC<{ className?: string }>
  primaryCol: string
  accentCol: string
  canvasCol: string
  textCol: string
  dots: [string, string, string, string]
}

const SKIN_CARDS: SkinCardItem[] = [
  {
    v: 'default',
    label: '石墨白',
    subtitle: '浅色 · Notion 极简',
    icon: Palette,
    primaryCol: '#2383e2',
    accentCol: '#1a6fc4',
    canvasCol: '#ffffff',
    textCol: '#37352f',
    dots: ['#2383e2', '#787774', '#e9e9e7', '#37352f'],
  },
  {
    v: 'sepia',
    label: '羊皮纸',
    subtitle: '浅色 · 暖纸护眼',
    icon: Feather,
    primaryCol: '#b45309',
    accentCol: '#92400e',
    canvasCol: '#f9f5eb',
    textCol: '#342e28',
    dots: ['#b45309', '#ded4c1', '#f4e8d3', '#342e28'],
  },
  {
    v: 'sage',
    label: '春苔绿',
    subtitle: '浅色 · 520nm 抗疲劳',
    icon: Leaf,
    primaryCol: '#2e7d32',
    accentCol: '#226126',
    canvasCol: '#eef3eb',
    textCol: '#2d3748',
    dots: ['#2e7d32', '#cbd5c5', '#dceeda', '#2d3748'],
  },
  {
    v: 'dark',
    label: '黑曜石',
    subtitle: '深色 · 碳素沉浸',
    icon: Palette,
    primaryCol: '#529cca',
    accentCol: '#6bb0da',
    canvasCol: '#191919',
    textCol: '#e9e9e7',
    dots: ['#529cca', '#2f2f2f', '#1e3444', '#e9e9e7'],
  },
  {
    v: 'midnight',
    label: '夜读深渊',
    subtitle: '深色 · 经典冷夜蓝',
    icon: Moon,
    primaryCol: '#3b82f6',
    accentCol: '#60a5fa',
    canvasCol: '#11141a',
    textCol: '#e2e8f0',
    dots: ['#3b82f6', '#242c3b', '#1e293b', '#e2e8f0'],
  },
  {
    v: 'forest',
    label: '松柏森夜',
    subtitle: '深色 · 哑光护眼绿',
    icon: Trees,
    primaryCol: '#e5a93b',
    accentCol: '#f59e0b',
    canvasCol: '#141a16',
    textCol: '#e2ede5',
    dots: ['#e5a93b', '#28342c', '#2d261a', '#e2ede5'],
  },
]

interface FontCardItem {
  v: FontKind
  label: string
  specimen: string
  sub: string
  fontFamilyCss: string
}

const FONT_CARDS: FontCardItem[] = [
  {
    v: 'wenkai',
    label: '文楷',
    specimen: '落霞与孤鹜齐飞，秋水共长天一色',
    sub: '霞鹜文楷 · 开源阅读之光',
    fontFamilyCss: 'var(--ink-font-wenkai)',
  },
  {
    v: 'serif',
    label: '宋体',
    specimen: '博观而约取，厚积而薄发',
    sub: '思源宋体 · 严肃文学纸书感',
    fontFamilyCss: 'var(--ink-font-serif)',
  },
  {
    v: 'sans',
    label: '黑体',
    specimen: '沉浸创作，极简专注',
    sub: '思源黑体 · 现代屏幕高清干练',
    fontFamilyCss: 'var(--ink-font-sans)',
  },
  {
    v: 'kaiti',
    label: '楷体',
    specimen: '笔落惊风雨，诗成泣鬼神',
    sub: '传统楷书 · 修仙武侠江湖风骨',
    fontFamilyCss: 'var(--ink-font-kaiti)',
  },
  {
    v: 'fangsong',
    label: '仿宋',
    specimen: '山高月小，水落石出',
    sub: '典雅仿宋 · 文人风骨端庄清秀',
    fontFamilyCss: 'var(--ink-font-fangsong)',
  },
  {
    v: 'mono',
    label: '等宽',
    specimen: 'const story = new Chapter()',
    sub: '等宽代码 · 极客排版标点对齐',
    fontFamilyCss: 'var(--ink-font-mono)',
  },
]
const LINE_HEIGHTS = ['1.0', '1.2', '1.5', '1.6', '1.8', '2.0', '2.4']
const INDENT_OPTIONS: { v: ParagraphIndent; label: string }[] = [
  { v: 'none', label: '不缩进' },
  { v: 'full', label: '全角空格' },
  { v: 'space2', label: '两半角空格' },
]
const FONT_MIN = 12
const FONT_MAX = 36

// ── 统一视觉原子 ──────────────────────────────────────────
// ── 通用设置组件已统一抽取至 SettingsShared 供各 Tab 严格复用 ──

interface SettingsViewProps {
  open: boolean
  onClose: () => void
}

export const SettingsView: FC<SettingsViewProps> = ({ open, onClose }) => {
  const [settings, update] = useSettings()
  const [tab, setTab] = useState<TabKey>('appearance')
  const [isExpanded, setIsExpanded] = useState<boolean>(false)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, handleKeyDown])

  if (!open) return null

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${
        isExpanded ? 'p-0 bg-[var(--ink-bg)]' : 'bg-black/40 backdrop-blur-sm p-4 sm:p-6'
      }`}
      onClick={(e) => {
        if (!isExpanded && e.currentTarget === e.target) onClose()
      }}
    >
      <div
        className={`${
          isExpanded
            ? 'w-full h-full rounded-none border-0 shadow-none'
            : 'w-[960px] h-[700px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] rounded-2xl shadow-2xl border border-[var(--ink-border)]'
        } flex flex-col overflow-hidden bg-[var(--ink-bg)] text-[var(--ink-text)] transition-all duration-150`}
        role="dialog"
        aria-modal="true"
        aria-label="设置"
      >
        {/* 顶部主标题栏（参考 VSCode / Notion 全景控制条） */}
        <header className="h-13 shrink-0 flex items-center justify-between px-5 border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)] select-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[var(--ink-accent)]/10 text-[var(--ink-accent)] flex items-center justify-center">
              <Gear className="w-4 h-4" />
            </div>
            <h2 className="text-[14px] font-semibold text-[var(--ink-text)] tracking-tight">
              设置中心
              <span className="text-[12px] font-normal text-[var(--ink-text-faint)] ml-2.5">
                · {TABS.find((t) => t.key === tab)?.label}
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? '还原为窗口' : '展开为全景整页'}
              className="p-1.5 rounded-lg text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)] transition-colors cursor-pointer"
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              title="关闭 (Esc)"
              className="p-1.5 rounded-lg text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* 左侧分区导航栏（支持 VSCode 式分类） */}
          <aside
            className={`${
              isExpanded ? 'w-64' : 'w-56'
            } shrink-0 border-r border-[var(--ink-border)] bg-[var(--ink-bg-sidebar)] p-3 space-y-1 overflow-y-auto select-none transition-all flex flex-col justify-between`}
          >
            <div className="space-y-1">
              <div className="px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-text-faint)] uppercase tracking-wider">
                功能偏好
              </div>
              {TABS.map((t) => {
                const Icon = t.icon
                const active = tab === t.key
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={`w-full text-left p-2 rounded-xl transition-all duration-150 cursor-pointer flex items-center gap-2.5 ${
                      active
                        ? 'bg-[var(--ink-bg-elevated)] border border-[var(--ink-border-strong)] shadow-xs text-[var(--ink-text)]'
                        : 'hover:bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)] border border-transparent'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        active
                          ? 'bg-[var(--ink-accent)] text-white shadow-2xs'
                          : 'bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-[12.5px] leading-tight ${
                          active ? 'font-semibold text-[var(--ink-text)]' : 'font-medium'
                        }`}
                      >
                        {t.label}
                      </div>
                      <div className="text-[10px] text-[var(--ink-text-faint)] truncate mt-0.5">
                        {t.desc}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </aside>

          {/* 右侧设置主体区：按整页与卡片自适应拉宽，彻底告别 640px 窄缝 */}
          <main className="flex-1 min-w-0 overflow-y-auto p-6 lg:p-10">
            <div
              className={
                tab === 'plugins'
                  ? 'h-full'
                  : isExpanded
                    ? 'w-full max-w-5xl mx-auto space-y-8'
                    : 'w-full max-w-[720px] mx-auto space-y-6'
              }
            >
              {tab === 'appearance' && <AppearanceTab settings={settings} update={update} />}
              {tab === 'editor' && <EditorTab settings={settings} update={update} />}
              {tab === 'writing' && <WritingHabitsTab settings={settings} update={update} />}
              {tab === 'shortcuts' && <ShortcutsTab />}
              {tab === 'plugins' && <PluginSettingsView />}
              {tab === 'ai' && <AiTab settings={settings} update={update} />}
              {tab === 'connection' && <ConnectionTab settings={settings} update={update} />}
              {tab === 'about' && <AboutTab />}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

// ── 外观（专注软件界面 UI 表现：主题、皮肤、整体界面字号与缩放）────────
const AppearanceTab: FC<{
  settings: AppSettings
  update: (p: Partial<AppSettings>) => void
}> = ({ settings, update }) => {
  // 当前环境是否为深色
  const isDark =
    settings.themeMode === 'dark' ||
    (settings.themeMode === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches)

  // 浅色主题卡片
  const lightSkins = SKIN_CARDS.filter((s) => ['default', 'sepia', 'sage'].includes(s.v))
  // 深色主题卡片
  const darkSkins = SKIN_CARDS.filter((s) => ['dark', 'midnight', 'forest'].includes(s.v))

  return (
    <>
      <Section title="配色模式" desc="控制整体明暗氛围：支持浅色、深色或跟随系统自适应。">
        <div className="p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {THEME_CARDS.map((tc) => {
            const isSelected = settings.themeMode === tc.v
            return (
              <button
                key={tc.v}
                type="button"
                onClick={() => {
                  if (tc.v === 'dark') {
                    // 切换深色模式时，自动联动匹配深色沉浸主题
                    const currentIsDark = ['dark', 'midnight', 'forest'].includes(
                      settings.themeSkin,
                    )
                    update({
                      themeMode: tc.v,
                      themeSkin: currentIsDark ? settings.themeSkin : 'dark',
                    })
                  } else if (tc.v === 'light') {
                    // 切换浅色模式时，自动联动匹配浅色护眼主题
                    const currentIsLight = ['default', 'sepia', 'sage'].includes(settings.themeSkin)
                    update({
                      themeMode: tc.v,
                      themeSkin: currentIsLight ? settings.themeSkin : 'default',
                    })
                  } else {
                    update({ themeMode: tc.v })
                  }
                }}
                className={`text-left rounded-xl p-3 border transition-all duration-200 cursor-pointer group flex flex-col justify-between ${
                  isSelected
                    ? 'border-[var(--ink-accent)] ring-2 ring-[var(--ink-accent)]/20 bg-[var(--ink-bg-elevated)] shadow-sm'
                    : 'border-[var(--ink-border)] bg-[var(--ink-bg-elevated)]/60 hover:border-[var(--ink-border-strong)] hover:bg-[var(--ink-bg-elevated)]'
                }`}
              >
                {/* 微缩窗口展示 */}
                <div
                  className="h-20 w-full rounded-lg border border-[var(--ink-border)] overflow-hidden flex shadow-2xs mb-2.5"
                  style={{ background: tc.bg }}
                >
                  <div
                    className="w-1/3 border-r border-[var(--ink-border)] p-1.5 flex flex-col justify-between"
                    style={{ background: tc.sidebar }}
                  >
                    <div className="space-y-1">
                      <div className="w-5 h-1.5 rounded-full bg-[var(--ink-border-strong)]" />
                      <div className="w-8 h-1.5 rounded-full bg-[var(--ink-border-strong)]/70" />
                      <div className="w-6 h-1.5 rounded-full bg-[var(--ink-border-strong)]/50" />
                    </div>
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: tc.accent }}
                    />
                  </div>
                  <div className="flex-1 p-2 flex flex-col justify-between">
                    <div className="space-y-1">
                      <div
                        className="w-12 h-2 rounded font-bold text-[8px] flex items-center font-serif"
                        style={{ color: tc.textCol }}
                      >
                        Aa
                      </div>
                      <div className="w-full h-1 rounded bg-[var(--ink-border-strong)]/60" />
                      <div className="w-3/4 h-1 rounded bg-[var(--ink-border-strong)]/40" />
                    </div>
                    <div className="flex gap-1">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: tc.accent }}
                      />
                      <div className="w-2 h-2 rounded-full bg-[var(--ink-border-strong)]" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-semibold text-[var(--ink-text)] flex items-center gap-1.5">
                      <tc.icon className="w-3.5 h-3.5 text-[var(--ink-accent)]" />
                      <span>{tc.label}</span>
                    </div>
                    <div className="text-[10.5px] text-[var(--ink-text-faint)] mt-0.5">
                      {tc.desc}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-4 h-4 rounded-full bg-[var(--ink-accent)] text-white flex items-center justify-center text-[9px] shrink-0 font-bold shadow-2xs">
                      ✓
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </Section>

      <Section
        title={isDark ? '深色夜读主题（当前生效）' : '浅色护眼主题（当前生效）'}
        desc={
          isDark
            ? '为夜间暗室创作定制的 3 款亚光护眼夜读色系（无纯黑眩光与视网膜晕影）。'
            : '为日间长篇写作定制的 3 款柔光色系（滤除刺眼蓝光，舒缓睫状肌疲劳）。'
        }
      >
        <div className="p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(isDark ? darkSkins : lightSkins).map((sc) => {
            const isSelected = settings.themeSkin === sc.v
            return (
              <button
                key={sc.v}
                type="button"
                onClick={() => update({ themeSkin: sc.v as ThemeSkin })}
                className={`text-left rounded-xl p-3 border transition-all duration-200 cursor-pointer group flex flex-col justify-between ${
                  isSelected
                    ? 'border-[var(--ink-accent)] ring-2 ring-[var(--ink-accent)]/20 bg-[var(--ink-bg-elevated)] shadow-sm'
                    : 'border-[var(--ink-border)] bg-[var(--ink-bg-elevated)]/60 hover:border-[var(--ink-border-strong)] hover:bg-[var(--ink-bg-elevated)]'
                }`}
              >
                {/* 微缩配色窗口（带 4 个调色板色点） */}
                <div
                  className="h-20 w-full rounded-lg border border-[var(--ink-border)] overflow-hidden flex shadow-2xs mb-2.5 p-2 flex-col justify-between"
                  style={{ backgroundColor: sc.canvasCol }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[11px] font-bold font-serif leading-none"
                      style={{ color: sc.textCol }}
                    >
                      Aa
                    </span>
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: sc.primaryCol }}
                    />
                  </div>
                  <div className="space-y-1">
                    <div
                      className="h-1 rounded-full w-4/5"
                      style={{ backgroundColor: sc.textCol, opacity: 0.35 }}
                    />
                    <div
                      className="h-1 rounded-full w-3/5"
                      style={{ backgroundColor: sc.textCol, opacity: 0.2 }}
                    />
                  </div>
                  {/* 4 个调色板颜色圆点 */}
                  <div className="flex items-center gap-1 pt-1">
                    {sc.dots.map((dot, idx) => (
                      <span
                        key={idx}
                        className="w-2 h-2 rounded-full shadow-2xs"
                        style={{ backgroundColor: dot }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <sc.icon className="w-3.5 h-3.5 shrink-0 text-[var(--ink-accent)]" />
                    <span className="text-[12.5px] font-semibold text-[var(--ink-text)] truncate">
                      {sc.label}
                    </span>
                    <span className="text-[10px] text-[var(--ink-text-faint)] truncate">
                      · {sc.subtitle}
                    </span>
                  </div>
                  {isSelected && (
                    <div className="w-4 h-4 rounded-full bg-[var(--ink-accent)] text-white flex items-center justify-center text-[9px] shrink-0 font-bold shadow-2xs">
                      ✓
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </Section>

      <Section
        title={isDark ? '备选浅色主题' : '备选深色主题'}
        desc={
          isDark
            ? '点击即可一键切换到浅色日间模式并应用该主题。'
            : '点击即可一键切换到深色夜读模式并应用该主题。'
        }
      >
        <div className="p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3 opacity-80 hover:opacity-100 transition-opacity">
          {(isDark ? lightSkins : darkSkins).map((sc) => (
            <button
              key={sc.v}
              type="button"
              onClick={() => {
                // 点击对向主题时，自动切换对应的明暗模式
                update({
                  themeMode: isDark ? 'light' : 'dark',
                  themeSkin: sc.v as ThemeSkin,
                })
              }}
              className="text-left rounded-xl p-3 border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)]/60 hover:border-[var(--ink-accent)] hover:bg-[var(--ink-bg-elevated)] transition-all duration-200 cursor-pointer group flex flex-col justify-between"
            >
              {/* 微缩配色窗口 */}
              <div
                className="h-20 w-full rounded-lg border border-[var(--ink-border)] overflow-hidden flex shadow-2xs mb-2.5 p-2 flex-col justify-between"
                style={{ backgroundColor: sc.canvasCol }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-[11px] font-bold font-serif leading-none"
                    style={{ color: sc.textCol }}
                  >
                    Aa
                  </span>
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: sc.primaryCol }}
                  />
                </div>
                <div className="space-y-1">
                  <div
                    className="h-1 rounded-full w-4/5"
                    style={{ backgroundColor: sc.textCol, opacity: 0.35 }}
                  />
                  <div
                    className="h-1 rounded-full w-3/5"
                    style={{ backgroundColor: sc.textCol, opacity: 0.2 }}
                  />
                </div>
                <div className="flex items-center gap-1 pt-1">
                  {sc.dots.map((dot, idx) => (
                    <span
                      key={idx}
                      className="w-2 h-2 rounded-full shadow-2xs"
                      style={{ backgroundColor: dot }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <sc.icon className="w-3.5 h-3.5 shrink-0 text-[var(--ink-accent)]" />
                  <span className="text-[12.5px] font-semibold text-[var(--ink-text)] truncate">
                    {sc.label}
                  </span>
                  <span className="text-[10px] text-[var(--ink-text-faint)] truncate">
                    · {sc.subtitle}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </Section>

      <Section
        title="软件界面字号与缩放"
        desc="调整整个软件界面（侧栏、顶栏、按钮与面板）的基础字号，便于不同屏幕尺寸舒适浏览。"
      >
        <Row
          label={`界面字号 · ${settings.uiFontSize || 13}px`}
          hint="拖动滑块即可等比缩放应用视口内所有侧栏与按钮尺寸（11px ~ 17px）。"
        >
          <div className="flex items-center gap-3 w-full sm:w-64">
            <Slider
              min={11}
              max={17}
              step={1}
              value={settings.uiFontSize || 13}
              onChange={(v) => update({ uiFontSize: v })}
            />
            <span className="text-[13px] font-mono text-[var(--ink-accent)] font-semibold w-12 text-right shrink-0">
              {settings.uiFontSize || 13}px
            </span>
          </div>
        </Row>
      </Section>
    </>
  )
}

// ── 编辑器（核心写作排版、正文字号、行距、存盘与视口）────────────────────
const EditorTab: FC<{
  settings: AppSettings
  update: (p: Partial<AppSettings>) => void
}> = ({ settings, update }) => (
  <>
    <Section
      title="正文字体族"
      desc="专属写作排版：正文字体根据文学题材随心切换，保留纸质书卷质感。"
    >
      <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {FONT_CARDS.map((fc) => {
          const isSelected = settings.fontFamily === fc.v
          return (
            <button
              key={fc.v}
              type="button"
              onClick={() => update({ fontFamily: fc.v })}
              className={`text-left rounded-xl p-3 border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'border-[var(--ink-accent)] ring-2 ring-[var(--ink-accent)]/20 bg-[var(--ink-bg-elevated)] shadow-sm'
                  : 'border-[var(--ink-border)] bg-[var(--ink-bg-elevated)]/60 hover:border-[var(--ink-border-strong)] hover:bg-[var(--ink-bg-elevated)]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13px] font-bold text-[var(--ink-text)]">{fc.label}</span>
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-[var(--ink-accent)] text-white flex items-center justify-center text-[9px] font-bold">
                      ✓
                    </span>
                  )}
                </div>
                <div
                  className="text-[12.5px] text-[var(--ink-text)] leading-snug py-2 px-2.5 rounded-lg bg-[var(--ink-bg-panel)] border border-[var(--ink-border)]/50 mb-2 truncate"
                  style={{ fontFamily: fc.fontFamilyCss }}
                >
                  {fc.specimen}
                </div>
              </div>
              <div className="text-[10px] text-[var(--ink-text-faint)] truncate">{fc.sub}</div>
            </button>
          )
        })}
      </div>
    </Section>

    <Section
      title="正文字号、行距与间距"
      desc="精确微调阅读比例：字号大小、行距倍数与段落垂直间距。"
    >
      <Row label={`正文字号 · ${settings.fontSize}px`}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => update({ fontSize: Math.max(FONT_MIN, settings.fontSize - 1) })}
            className="px-3 py-1.5 rounded-lg text-[12px] bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)] cursor-pointer font-medium"
          >
            A−
          </button>
          <Slider
            min={FONT_MIN}
            max={FONT_MAX}
            value={settings.fontSize}
            onChange={(v) => update({ fontSize: v })}
          />
          <button
            type="button"
            onClick={() => update({ fontSize: Math.min(FONT_MAX, settings.fontSize + 1) })}
            className="px-3 py-1.5 rounded-lg text-[12px] bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)] cursor-pointer font-medium"
          >
            A+
          </button>
          <span className="text-[13px] font-mono text-[var(--ink-accent)] font-semibold w-12 text-right">
            {settings.fontSize}px
          </span>
        </div>
      </Row>

      <Row label={`正文行距 · ${settings.lineHeight}x`}>
        <div className="space-y-2.5 flex-1 max-w-[380px]">
          <div className="flex items-center gap-3">
            <Slider
              min={1.0}
              max={3.0}
              step={0.05}
              value={Number.parseFloat(settings.lineHeight) || 1.8}
              onChange={(v) => update({ lineHeight: String(Math.round(v * 100) / 100) })}
            />
            <span className="text-[12px] font-mono w-10 text-right text-[var(--ink-text-faint)]">
              {settings.lineHeight}
            </span>
          </div>
          <Segmented
            value={settings.lineHeight}
            options={LINE_HEIGHTS.map((v) => ({ v, label: v }))}
            onChange={(v) => update({ lineHeight: v })}
          />
        </div>
      </Row>

      <Row
        label={`段落间距 · ${settings.paragraphSpacing ?? 0.25}em`}
        hint="段落之间的垂直间隙留白，0 为紧凑相连，0.5+ 带来网文清爽呼吸感。"
      >
        <div className="flex items-center gap-3">
          <Slider
            min={0}
            max={1.0}
            step={0.05}
            value={settings.paragraphSpacing ?? 0.25}
            onChange={(v) => update({ paragraphSpacing: Math.round(v * 100) / 100 })}
          />
          <span className="text-[13px] font-mono text-[var(--ink-accent)] font-semibold w-14 text-right">
            {settings.paragraphSpacing ?? 0.25}em
          </span>
        </div>
      </Row>
    </Section>

    <Section
      title="段落排版规范"
      desc="「一键排版」按钮据此规则重排当前章节：清理空行、按需首行缩进。"
    >
      <Row label="首行缩进方式">
        <Segmented
          value={settings.paragraphIndent}
          options={INDENT_OPTIONS}
          onChange={(v) => update({ paragraphIndent: v })}
        />
      </Row>
      <Row label="一键排版时顺带标点中文化" hint="英文标点自动转换为中文全角规范标点。">
        <Switch
          checked={settings.normalizePunctuationOnFormat}
          onChange={(v) => update({ normalizePunctuationOnFormat: v })}
          ariaLabel="一键排版时顺带标点中文化"
        />
      </Row>
    </Section>

    <Section title="自动存盘与持久化" desc="正文输入后防抖自动写入本地存储，无需手动按键。">
      <Row label="自动保存">
        <Switch
          checked={settings.autoSave}
          onChange={(v) => update({ autoSave: v })}
          ariaLabel="自动保存"
        />
      </Row>
      {settings.autoSave && (
        <Row label={`保存间隔 · ${settings.autoSaveDelay}ms`}>
          <div className="flex items-center gap-3">
            <Slider
              min={200}
              max={5000}
              step={100}
              value={settings.autoSaveDelay}
              onChange={(v) => update({ autoSaveDelay: v })}
            />
            <span className="text-[13px] font-mono text-[var(--ink-accent)] font-semibold w-16 text-right">
              {settings.autoSaveDelay}ms
            </span>
          </div>
        </Row>
      )}
    </Section>

    <Section title="写作视口与目标反馈">
      <Row label="默认打字机模式" hint="开启后光标始终垂直居中，适合长篇沉浸码字。">
        <Switch
          checked={settings.defaultTypewriter}
          onChange={(v) => update({ defaultTypewriter: v })}
          ariaLabel="默认打字机模式"
        />
      </Row>
      <Row label="底部状态栏" hint="显示本章与全书字数、连接状态、编辑器控制和保存状态。">
        <Switch
          checked={settings.showStatsBar}
          onChange={(v) => update({ showStatsBar: v })}
          ariaLabel="底部状态栏"
        />
      </Row>
      <Row
        label={`每章字数目标 · ${settings.wordTarget.toLocaleString()} 字`}
        hint="达到目标后状态栏变绿提示，用于作者每日节奏把控。"
      >
        <div className="flex items-center gap-3">
          <Slider
            min={500}
            max={30000}
            step={500}
            value={settings.wordTarget}
            onChange={(v) => update({ wordTarget: v })}
          />
          <span className="text-[13px] font-mono text-[var(--ink-accent)] font-semibold w-20 text-right">
            {settings.wordTarget}字
          </span>
        </div>
      </Row>
    </Section>
  </>
)

const AiTab: FC<{
  settings: AppSettings
  update: (p: Partial<AppSettings>) => void
}> = ({ settings, update }) => {
  // 当前已保存的所有供应商列表
  const savedList = useMemo<ModelConfig[]>(() => {
    if (settings.savedAiModels && settings.savedAiModels.length > 0) {
      return settings.savedAiModels
    }
    return settings.aiModel ? [settings.aiModel] : []
  }, [settings.savedAiModels, settings.aiModel])

  // 控制独立弹窗（ProviderSetupDialog）开关及传入的目标配置
  const [editingTarget, setEditingTarget] = useState<ModelConfig | null | undefined>(undefined)
  const isDialogOpen = editingTarget !== undefined

  // 默认项更改下拉面板
  const [showDefaultPicker, setShowDefaultPicker] = useState(false)

  // 模型目录状态
  const [catalogMeta, setCatalogMeta] = useState<CatalogMeta>(() => readCatalogMeta())
  const [catalogBusy, setCatalogBusy] = useState(false)
  const [catalogMsg, setCatalogMsg] = useState<string | null>(null)

  // 测速结果缓存
  const [cardSpeedResults, setCardSpeedResults] = useState<
    Record<string, { latency?: number; status: 'ok' | 'err'; msg: string }>
  >({})

  // 测试连接处理
  const handleTestConnection = async (targetUrl: string, targetKey?: string) => {
    try {
      const probe = await probeModelEndpoint(targetUrl, targetKey, { now: () => clock.now() })
      if (probe.status >= 200 && probe.status < 300) {
        return { ok: true, msg: `${probe.latency}ms 连接正常 (HTTP ${probe.status})` }
      }
      if (probe.status === 401 || probe.status === 403) {
        return { ok: false, msg: `${probe.latency}ms 端点可达，密钥无效 (HTTP ${probe.status})` }
      }
      return { ok: true, msg: `${probe.latency}ms 端点可达 (HTTP ${probe.status})` }
    } catch (err: any) {
      return { ok: false, msg: err?.message || '连接超时或网络不可达' }
    }
  }

  // 快速测速按钮
  const handleQuickSpeedTest = async (url?: string, key?: string, targetId?: string) => {
    if (!url) return
    const res = await handleTestConnection(url, key)
    if (targetId) {
      setCardSpeedResults((prev) => ({
        ...prev,
        [targetId]: { latency: undefined, status: res.ok ? 'ok' : 'err', msg: res.msg },
      }))
    }
  }

  // 设为默认供应商
  const handleSwitchProvider = (target: ModelConfig) => {
    update({ aiModel: target })
  }

  // 删除供应商
  const handleDeleteProvider = (target: ModelConfig) => {
    const updatedList = savedList.filter(
      (m) => !(m.id === target.id && m.provider === target.provider && m.name === target.name),
    )
    const isCurrentActive =
      settings.aiModel?.id === target.id && settings.aiModel?.provider === target.provider
    update({
      savedAiModels: updatedList,
      aiModel: isCurrentActive ? updatedList[0] || null : settings.aiModel,
    })
  }

  // 启用/停用供应商
  const handleToggleEnabled = (target: ModelConfig) => {
    const nowEnabled = target.enabled === false
    const updatedList = savedList.map((m) =>
      m.id === target.id && m.provider === target.provider ? { ...m, enabled: nowEnabled } : m,
    )
    const isActive =
      settings.aiModel?.id === target.id && settings.aiModel?.provider === target.provider
    let nextActive = settings.aiModel
    if (isActive && !nowEnabled) {
      nextActive =
        updatedList.find(
          (m) => m.enabled !== false && !(m.id === target.id && m.provider === target.provider),
        ) || null
    }
    update({ savedAiModels: updatedList, aiModel: nextActive })
  }

  // 更新模型目录
  const handleRefreshCatalog = async () => {
    const targets = savedList.filter(
      (m) => m.enabled !== false && (m.baseUrl || PROVIDER_META[m.provider]?.defaultBaseUrl),
    )
    if (targets.length === 0) {
      setCatalogMsg('暂无已保存的供应商端点可更新')
      return
    }
    setCatalogBusy(true)
    setCatalogMsg(null)
    let okCount = 0
    let failedCount = 0
    const nextList = [...savedList]
    for (let i = 0; i < nextList.length; i++) {
      const m = nextList[i]
      const url = m.baseUrl || PROVIDER_META[m.provider]?.defaultBaseUrl
      if (m.enabled === false || !url) continue
      try {
        const ids = await fetchModelIds(url, m.apiKey)
        nextList[i] = { ...m, availableModelIds: ids }
        okCount += 1
      } catch {
        failedCount += 1
      }
    }
    const meta: CatalogMeta = {
      fetchedAt: new Date().toISOString(),
      fetchedCount: okCount,
      failedCount,
    }
    writeCatalogMeta(meta)
    setCatalogMeta(meta)
    update({ savedAiModels: nextList })
    setCatalogMsg(
      failedCount > 0
        ? `已更新 ${okCount} 个供应商端点的模型列表，${failedCount} 个暂不可达`
        : `已更新 ${okCount} 个供应商端点的模型列表`,
    )
    setCatalogBusy(false)
  }

  // 弹窗保存成功回调
  const handleDialogSave = (saved: ModelConfig) => {
    const currentList = [...savedList]
    const existingIndex = currentList.findIndex(
      (m) =>
        (editingTarget && m.id === editingTarget.id && m.provider === editingTarget.provider) ||
        (m.id === saved.id && m.provider === saved.provider) ||
        (m.name && m.name === saved.name),
    )

    let updatedList: ModelConfig[]
    if (existingIndex >= 0) {
      updatedList = currentList.map((m, idx) => (idx === existingIndex ? saved : m))
    } else {
      updatedList = [...currentList, saved]
    }

    const isCurrentActive =
      !settings.aiModel ||
      (editingTarget &&
        settings.aiModel.id === editingTarget.id &&
        settings.aiModel.provider === editingTarget.provider)

    update({
      aiModel: isCurrentActive ? saved : settings.aiModel,
      savedAiModels: updatedList,
    })
    setEditingTarget(undefined)
  }

  // 如果处于编辑/添加子页面，直接在当前主视口平滑切换渲染 ProviderDetailView（符合 Apple / Notion 风格，不在设置弹窗里套弹窗）
  if (isDialogOpen) {
    return (
      <ProviderDetailView
        initialConfig={editingTarget}
        onBack={() => setEditingTarget(undefined)}
        onSave={handleDialogSave}
        onTest={handleTestConnection}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* ── 模块 0：默认项卡片（与图一 100% 对齐）── */}
      <section className="space-y-2.5">
        <div className="px-1">
          <h3 className="text-[14px] font-semibold text-[var(--ink-text)]">默认项</h3>
        </div>
        <div className="rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4 shadow-2xs">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11.5px] font-medium text-[var(--ink-text-faint)] mb-1">
                默认模型
              </div>
              {settings.aiModel ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[13.5px] font-semibold text-[var(--ink-text)]">
                    {PROVIDER_META[settings.aiModel.provider]?.label || settings.aiModel.provider}
                  </span>
                  <span className="text-[var(--ink-text-faint)]">·</span>
                  <span className="font-mono text-[13px] text-[var(--ink-text-muted)] truncate">
                    {settings.aiModel.id}
                  </span>
                </div>
              ) : (
                <div className="text-[13px] text-[var(--ink-text-muted)]">尚未设置默认模型</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowDefaultPicker((s) => !s)}
              disabled={savedList.every((m) => m.enabled === false)}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] hover:border-[var(--ink-accent)] hover:text-[var(--ink-accent)] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40 shrink-0"
            >
              <span>更改</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${showDefaultPicker ? 'rotate-180' : ''}`}
              />
            </button>
          </div>

          {/* 默认模型切换下拉菜单 */}
          {showDefaultPicker && (
            <div
              data-testid="default-model-picker"
              className="mt-3 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] p-2 max-h-56 overflow-y-auto space-y-1"
            >
              {savedList
                .filter((m) => m.enabled !== false)
                .map((m, idx) => {
                  const isActive =
                    settings.aiModel?.id === m.id && settings.aiModel?.provider === m.provider
                  const pMeta = PROVIDER_META[m.provider]
                  return (
                    <button
                      key={`${m.provider}_${m.id}_${idx}`}
                      type="button"
                      onClick={() => {
                        handleSwitchProvider(m)
                        setShowDefaultPicker(false)
                      }}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                        isActive ? 'bg-[var(--ink-accent)]/10' : 'hover:bg-[var(--ink-bg-hover)]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-medium text-[var(--ink-text)] truncate">
                          {m.name || m.id}
                        </div>
                        <div className="font-mono text-[11px] text-[var(--ink-text-faint)] truncate">
                          {pMeta?.label || m.provider} · {m.id}
                        </div>
                      </div>
                      {isActive ? (
                        <span className="text-[10.5px] font-medium text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5 shrink-0">
                          使用中
                        </span>
                      ) : (
                        <span className="text-[10.5px] text-[var(--ink-text-faint)] shrink-0">
                          设为默认
                        </span>
                      )}
                    </button>
                  )
                })}
            </div>
          )}
        </div>
      </section>

      {/* ── 模块 1：AI 服务列表（与图一 100% 对齐）── */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] font-semibold text-[var(--ink-text)]">AI 服务</h3>
            <span className="px-1.5 py-0.2 rounded-full text-[10.5px] bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)] font-medium">
              {savedList.length}
            </span>
          </div>
          <PrimaryButton onClick={() => setEditingTarget(null)}>
            <Plus className="w-3.5 h-3.5" />
            <span>添加服务</span>
          </PrimaryButton>
        </div>

        <div className="rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] divide-y divide-[var(--ink-border)] overflow-hidden shadow-2xs">
          {savedList.length === 0 ? (
            <div className="text-center py-8 px-4">
              <div className="w-10 h-10 rounded-xl bg-[var(--ink-accent)]/10 text-[var(--ink-accent)] flex items-center justify-center mx-auto mb-2.5">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="text-[13px] font-semibold text-[var(--ink-text)]">
                暂无已配置的 AI 服务
              </div>
              <div className="text-[11.5px] text-[var(--ink-text-faint)] mt-1 max-w-sm mx-auto">
                点击右上角「添加服务」配置你的端点（支持任意 OpenAI 兼容反代与大模型网关）。
              </div>
            </div>
          ) : (
            savedList.map((m, idx) => {
              const isActive =
                settings.aiModel?.id === m.id && settings.aiModel?.provider === m.provider
              const isEnabled = m.enabled !== false
              const pMeta = PROVIDER_META[m.provider]
              const cardKey = `${m.provider}_${m.id}_${idx}`
              const sp = cardSpeedResults[cardKey]
              const host = (m.baseUrl || pMeta?.defaultBaseUrl || '')
                .replace(/^https?:\/\//, '')
                .split('/')[0]
              const modelCount = m.availableModelIds?.length ?? 1

              return (
                <div
                  key={cardKey}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    !isEnabled ? 'opacity-55' : 'hover:bg-[var(--ink-bg-hover)]/30'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13.5px] font-semibold text-[var(--ink-text)] truncate">
                        {m.name || m.id}
                      </span>
                      {isActive && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0">
                          默认
                        </span>
                      )}
                      {!isEnabled && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--ink-bg-hover)] text-[var(--ink-text-faint)] border border-[var(--ink-border)] shrink-0">
                          已禁用
                        </span>
                      )}
                      {sp && (
                        <span
                          className={`text-[10.5px] px-1.5 py-0.5 rounded tabular-nums ${
                            sp.status === 'ok'
                              ? 'text-emerald-600 bg-emerald-500/10'
                              : 'text-rose-600 bg-rose-500/10'
                          }`}
                        >
                          {sp.msg}
                        </span>
                      )}
                    </div>
                    <div className="text-[11.5px] text-[var(--ink-text-faint)] mt-1 truncate">
                      <span className="font-mono">{host || '默认端点'}</span>
                      <span className="mx-1.5">·</span>
                      <span>{modelCount} 个模型</span>
                    </div>
                  </div>

                  {/* 图标操作组（对齐图一：设为默认/铅笔编辑/测速/删除/开关） */}
                  <div className="flex items-center gap-2 shrink-0">
                    {!isActive && isEnabled && (
                      <button
                        type="button"
                        onClick={() => handleSwitchProvider(m)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-medium text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer"
                      >
                        设为默认
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditingTarget(m)}
                      className="p-1.5 rounded-lg text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] active:scale-95 transition-all duration-150 cursor-pointer"
                      title="编辑此服务"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleQuickSpeedTest(m.baseUrl || pMeta?.defaultBaseUrl, m.apiKey, cardKey)
                      }
                      className="p-1.5 rounded-lg text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] active:scale-95 transition-all duration-150 cursor-pointer"
                      title="测试连通性"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProvider(m)}
                      className="p-1.5 rounded-lg text-[var(--ink-text-muted)] hover:text-rose-500 hover:bg-rose-500/10 active:scale-95 transition-all duration-150 cursor-pointer"
                      title="删除此服务"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <Switch
                      checked={isEnabled}
                      onChange={() => handleToggleEnabled(m)}
                      ariaLabel={`${m.name || m.id} 服务开关`}
                    />
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* ── 模块 3：模型目录状态条（对齐图一底栏）── */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] flex-wrap">
        <div className="text-[11.5px] text-[var(--ink-text-muted)]">
          目录：内置快照 ·{' '}
          <span className="font-medium text-[var(--ink-text)]">{MODEL_CATALOG.length}</span> 个模型
          · 更新于{' '}
          <span className="text-[var(--ink-text)]">{catalogUpdatedAtLabel(catalogMeta)}</span>
        </div>
        <button
          type="button"
          onClick={handleRefreshCatalog}
          disabled={catalogBusy || savedList.length === 0}
          className="px-3 py-1.5 rounded-lg text-[11.5px] font-medium border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] hover:border-[var(--ink-accent)] hover:text-[var(--ink-accent)] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${catalogBusy ? 'animate-spin' : ''}`} />
          <span>{catalogBusy ? '更新中…' : '更新模型目录'}</span>
        </button>
      </div>
      {catalogMsg && (
        <div className="text-[11px] text-[var(--ink-text-faint)] px-1">{catalogMsg}</div>
      )}
    </div>
  )
}

const ConnectionTab: FC<{
  settings: AppSettings
  update: (p: Partial<AppSettings>) => void
}> = ({ settings, update }) => (
  <Section
    title="系统运行状态"
    desc="检查本地写作沙盒与数据通道。正常使用无需任何配置，核心服务开箱即用。"
  >
    <div className="px-5 py-4 space-y-4">
      {/* 消费级安全状态展示卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3.5 rounded-xl bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] flex items-start gap-3">
          <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 mt-0.5 shrink-0" />
          <div className="text-xs">
            <div className="font-semibold text-[var(--ink-text)] text-[12.5px]">本地写作引擎</div>
            <div className="text-[11.5px] text-[var(--ink-text-faint)] mt-0.5">
              内置轻量沙盒环境已就绪
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] flex items-start gap-3">
          <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 mt-0.5 shrink-0" />
          <div className="text-xs">
            <div className="font-semibold text-[var(--ink-text)] text-[12.5px]">本地数据存储</div>
            <div className="text-[11.5px] text-[var(--ink-text-faint)] mt-0.5">
              IndexedDB 离线优先，不离开设备
            </div>
          </div>
        </div>
      </div>

      {/* 高级开发者网络设置（折叠收拢，不骚扰普通用户） */}
      <details className="group border-t border-[var(--ink-border)] pt-3.5">
        <summary className="cursor-pointer text-[12px] text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] select-none font-medium">
          高级开发者选项（自建远端 Daemon 守护进程地址）
        </summary>
        <div className="pt-3 space-y-2">
          <div className={fieldLabel}>Daemon WebSocket 地址</div>
          <input
            className={inputCls}
            value={settings.daemonWsUrl}
            onChange={(e) => update({ daemonWsUrl: e.target.value })}
            placeholder="ws://127.0.0.1:8849"
          />
          <p className="text-[11.5px] leading-relaxed text-[var(--ink-text-faint)]">
            默认{' '}
            <code className="px-1.5 py-0.5 rounded bg-[var(--ink-bg-elevated)]">
              ws://127.0.0.1:8849
            </code>{' '}
            与桌面端内置进程对齐。
          </p>
        </div>
      </details>
    </div>
  </Section>
)

// ── 关于 ──────────────────────────────────────────────────
const ABOUT_FEATURES: { title: string; desc: string }[] = [
  {
    title: '富文本写作台',
    desc: 'TipTap 内核：加粗/斜体/标题/引用/代码，800ms 防抖自动存盘。',
  },
  {
    title: '多样化排版方案',
    desc: '传统出版（空两格）、现代网文呼吸感（段间分行）、剧本对话体自由切换。',
  },
  {
    title: '统一搜索中枢',
    desc: '集成文档内即时查找替换与全书跨章节深度检索。',
  },
  {
    title: '真 1:1 双栏对等分屏',
    desc: '左右两栏镜像排版、无干扰底栏，支持伏笔核验与历史章节对照。',
  },
  {
    title: '版本时光机',
    desc: '自动检查点与里程碑定稿双层管理，清晰差异比对与一键回滚。',
  },
  {
    title: '统一设置中心',
    desc: '外观 / 编辑器 / 自定义 AI 模型 / 连接，全部本地优先持久化。',
  },
]

const AboutTab: FC = () => (
  <>
    <Section title="InkPi Desktop">
      <div className="px-5 py-4 space-y-3.5">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[var(--ink-accent)] text-white flex items-center justify-center text-[19px] font-medium shrink-0 shadow-xs">
            墨
          </div>
          <div>
            <div className="text-[14.5px] font-semibold text-[var(--ink-text)]">InkPi Desktop</div>
            <div className="text-[11.5px] text-[var(--ink-text-faint)] mt-0.5">
              基于 Tauri 2 + React 19 的专业小说创作工作台
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 text-[11.5px]">
          <div className="rounded-xl bg-[var(--ink-bg-elevated)] px-3.5 py-2.5 border border-[var(--ink-border)]">
            <div className="text-[var(--ink-text-faint)]">版本</div>
            <div className="text-[var(--ink-text)] font-medium mt-0.5">0.1.0</div>
          </div>
          <div className="rounded-xl bg-[var(--ink-bg-elevated)] px-3.5 py-2.5 border border-[var(--ink-border)]">
            <div className="text-[var(--ink-text-faint)]">数据存储</div>
            <div className="text-[var(--ink-text)] font-medium mt-0.5">本地 IndexedDB</div>
          </div>
          <div className="rounded-xl bg-[var(--ink-bg-elevated)] px-3.5 py-2.5 border border-[var(--ink-border)]">
            <div className="text-[var(--ink-text-faint)]">技术栈</div>
            <div className="text-[var(--ink-text)] font-medium mt-0.5">
              Tauri 2 · React 19 · TipTap
            </div>
          </div>
          <div className="rounded-xl bg-[var(--ink-bg-elevated)] px-3.5 py-2.5 border border-[var(--ink-border)]">
            <div className="text-[var(--ink-text-faint)]">AI 引擎</div>
            <div className="text-[var(--ink-text)] font-medium mt-0.5">
              InkPi Daemon Task Runtime
            </div>
          </div>
        </div>
        <p className="text-[11.5px] leading-relaxed text-[var(--ink-text-faint)]">
          数据本地优先，绝不离开你的设备；AI 仅在显式配置模型并运行 Daemon 时联网。
        </p>
      </div>
    </Section>

    <Section title="内置功能一览">
      <div className="divide-y divide-[var(--ink-border)]">
        {ABOUT_FEATURES.map((f) => (
          <div key={f.title} className="px-5 py-3">
            <div className="text-[12.5px] font-semibold text-[var(--ink-text)]">{f.title}</div>
            <div className="text-[11.5px] text-[var(--ink-text-faint)] mt-0.5 leading-snug">
              {f.desc}
            </div>
          </div>
        ))}
      </div>
    </Section>
  </>
)
