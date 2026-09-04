import { useState, useEffect, useCallback, useMemo, type FC, type ReactNode } from 'react'
import {
  Settings as Gear,
  Palette,
  Sparkles,
  Wifi,
  Info,
  Type,
  Eye,
  EyeOff,
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
  Download,
  Loader2,
  Plus,
  Edit3,
  Copy,
  Search,
  Check,
} from 'lucide-react'
import { PluginSettingsView } from '../plugins/PluginSettingsView'
import { PluginProvider } from '../../core/pluginRegistry'
import { clock } from '../../adapters/clock'
import {
  useSettings,
  PROVIDER_META,
  type AppSettings,
  type ModelConfig,
  type ProviderType,
  type ThemeMode,
  type FontKind,
  type ParagraphIndent,
  type ThemeSkin,
} from '../../core/settings'

type TabKey = 'appearance' | 'editor' | 'plugins' | 'ai' | 'connection' | 'about'

const TABS: { key: TabKey; label: string; desc: string; icon: FC<{ className?: string }> }[] = [
  { key: 'appearance', label: '外观', desc: '主题配色、皮肤与界面缩放', icon: Palette },
  { key: 'editor', label: '编辑器', desc: '正文字体、字号与排版规范', icon: Type },
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
    label: '默认',
    subtitle: '石墨灰',
    icon: Palette,
    primaryCol: '#2383e2',
    accentCol: '#1a6fc4',
    canvasCol: '#ffffff',
    textCol: '#37352f',
    dots: ['#2383e2', '#787774', '#e9e9e7', '#37352f'],
  },
  {
    v: 'youth',
    label: '青春绿',
    subtitle: '春苔绿',
    icon: Leaf,
    primaryCol: '#10b981',
    accentCol: '#059669',
    canvasCol: '#f4f8f5',
    textCol: '#1a2e22',
    dots: ['#10b981', '#059669', '#d1fae5', '#064e3b'],
  },
  {
    v: 'ink',
    label: '水墨',
    subtitle: '宣纸白',
    icon: Feather,
    primaryCol: '#c4544a',
    accentCol: '#9e3b33',
    canvasCol: '#faf7f2',
    textCol: '#2c2a29',
    dots: ['#c4544a', '#8c7b75', '#f5efe6', '#2c2a29'],
  },
  {
    v: 'forest',
    label: '森夜',
    subtitle: '松柏青',
    icon: Trees,
    primaryCol: '#d97706',
    accentCol: '#b45309',
    canvasCol: '#131a16',
    textCol: '#e2eae5',
    dots: ['#d97706', '#15803d', '#1a2e26', '#fef3c7'],
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
const fieldLabel = 'text-[11.5px] font-medium text-[var(--ink-text-faint)] mb-1.5'
const inputCls =
  'w-full px-3 py-2 rounded-lg text-[13px] bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none focus:border-[var(--ink-accent)]'
const segBase = 'px-3 py-1.5 rounded-lg text-[12.5px] transition-colors duration-150'
const segActive = 'bg-[var(--ink-accent)] text-white shadow-2xs font-medium'
const segIdle = 'bg-transparent text-[var(--ink-text-muted)] hover:text-[var(--ink-text)]'

const Section: FC<{ title: string; desc?: string; children: ReactNode }> = ({
  title,
  desc,
  children,
}) => (
  <section className="space-y-2.5">
    <div className="px-1">
      <h3 className="text-[14px] font-semibold text-[var(--ink-text)]">{title}</h3>
      {desc && (
        <p className="text-[12px] text-[var(--ink-text-faint)] mt-0.5 leading-relaxed">{desc}</p>
      )}
    </div>
    <div className="rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] divide-y divide-[var(--ink-border)] overflow-hidden shadow-2xs">
      {children}
    </div>
  </section>
)

const Row: FC<{ label: string; hint?: string; children: ReactNode }> = ({
  label,
  hint,
  children,
}) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-3.5">
    <div className="min-w-0 flex-1 sm:pr-4">
      <div className="text-[13px] text-[var(--ink-text)] font-medium">{label}</div>
      {hint && (
        <div className="text-[11.5px] text-[var(--ink-text-faint)] mt-0.5 leading-relaxed">
          {hint}
        </div>
      )}
    </div>
    <div className="shrink-0 flex items-center sm:justify-end w-full sm:w-auto">{children}</div>
  </div>
)

const Segmented = <T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { v: T; label: string }[]
  onChange: (v: T) => void
}) => (
  <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] max-w-full">
    {options.map((o) => (
      <button
        key={String(o.v)}
        type="button"
        onClick={() => onChange(o.v)}
        className={`${segBase} ${value === o.v ? segActive : segIdle} cursor-pointer`}
      >
        {o.label}
      </button>
    ))}
  </div>
)

const Slider: FC<{
  min: number
  max: number
  step?: number
  value: number
  onChange: (v: number) => void
}> = ({ min, max, step = 1, value, onChange }) => (
  <input
    type="range"
    min={min}
    max={max}
    step={step}
    value={value}
    onChange={(e) => onChange(Number(e.target.value))}
    className="w-48 sm:w-56 accent-[var(--ink-accent)] cursor-pointer"
  />
)

const Switch: FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({
  checked,
  onChange,
}) => (
  <button
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative w-10 h-5.5 rounded-full transition-colors duration-150 cursor-pointer ${
      checked ? 'bg-[var(--ink-accent)]' : 'bg-[var(--ink-border-strong)]'
    }`}
  >
    <span
      className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white transition-transform duration-150 shadow-xs ${
        checked ? 'translate-x-4.5' : ''
      }`}
    />
  </button>
)

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
              {tab === 'plugins' && (
                <PluginProvider>
                  <PluginSettingsView />
                </PluginProvider>
              )}
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
}> = ({ settings, update }) => (
  <>
    <Section title="配色模式" desc="控制整体明暗氛围：支持浅色、深色或跟随系统自适应。">
      <div className="p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {THEME_CARDS.map((tc) => {
          const isSelected = settings.themeMode === tc.v
          return (
            <button
              key={tc.v}
              type="button"
              onClick={() => update({ themeMode: tc.v })}
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
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tc.accent }} />
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
                  <div className="text-[10.5px] text-[var(--ink-text-faint)] mt-0.5">{tc.desc}</div>
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

    <Section title="界面皮肤风格" desc="沉浸氛围换肤：底色、纸张质感与强调色全套切换。">
      <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {SKIN_CARDS.map((sc) => {
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
        />
      </Row>
    </Section>

    <Section title="自动存盘与持久化" desc="正文输入后防抖自动写入本地存储，无需手动按键。">
      <Row label="自动保存">
        <Switch checked={settings.autoSave} onChange={(v) => update({ autoSave: v })} />
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
        />
      </Row>
      <Row label="底部状态栏" hint="显示字数、编码、存储位置与最后更新时间。">
        <Switch checked={settings.showStatsBar} onChange={(v) => update({ showStatsBar: v })} />
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

const emptyModel = (): ModelConfig => ({
  id: '',
  name: '',
  provider: 'openai',
})

const NumField: FC<{
  label: string
  value?: number
  min?: number
  max?: number
  step?: number
  placeholder?: string
  hint?: string
  onChange: (v?: number) => void
}> = ({ label, value, min, max, step, placeholder, hint, onChange }) => (
  <div>
    <div className={fieldLabel}>{label}</div>
    <input
      type="number"
      className={inputCls}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value.trim()
        onChange(v === '' ? undefined : Number(v))
      }}
    />
    {hint && <div className="text-[10px] text-[var(--ink-text-faint)] mt-1">{hint}</div>}
  </div>
)

const Toggle: FC<{
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}> = ({ label, checked, onChange }) => (
  <label className="flex items-center gap-2 cursor-pointer text-[12px] text-[var(--ink-text-muted)] select-none">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="rounded text-[var(--ink-accent)]"
    />
    <span>{label}</span>
  </label>
)

const AiTab: FC<{
  settings: AppSettings
  update: (p: Partial<AppSettings>) => void
}> = ({ settings, update }) => {
  // 当前已保存的所有供应商列表（多供应商架构，对齐 cc-switch）
  const savedList = useMemo<ModelConfig[]>(() => {
    if (settings.savedAiModels && settings.savedAiModels.length > 0) {
      return settings.savedAiModels
    }
    return settings.aiModel ? [settings.aiModel] : []
  }, [settings.savedAiModels, settings.aiModel])

  // 当前编辑的草稿（正在新建或编辑某一个供应商）
  const [draft, setDraft] = useState<ModelConfig | null>(settings.aiModel)
  const [isEditing, setIsEditing] = useState<boolean>(!settings.aiModel)
  const [showKey, setShowKey] = useState(false)
  const [, setIsSaved] = useState(false)

  // 端点测速状态
  const [speedTesting, setSpeedTesting] = useState(false)
  const [speedResult, setSpeedResult] = useState<{
    status: 'ok' | 'err'
    latency?: number
    msg: string
  } | null>(null)

  // 模型拉取状态 (对齐 cc-switch 的 ModelInputWithFetch)
  const [fetchingModels, setFetchingModels] = useState(false)
  const [fetchedModels, setFetchedModels] = useState<{ id: string }[]>([])
  const [modelSearch, setModelSearch] = useState('')
  const [showModelDropdown, setShowModelDropdown] = useState(false)

  // 单独针对各卡片的测速结果缓存 { [modelId]: { latency: number, status: 'ok' | 'err' } }
  const [cardSpeedResults, setCardSpeedResults] = useState<
    Record<string, { latency?: number; status: 'ok' | 'err'; msg: string }>
  >({})

  useEffect(() => {
    if (!draft && settings.aiModel) {
      setDraft(settings.aiModel)
    }
  }, [settings.aiModel, draft])

  const provider = draft?.provider
  const meta = provider ? PROVIDER_META[provider] : undefined

  const patchDraft = (patch: Partial<ModelConfig>) =>
    setDraft((d) => ({ ...(d || emptyModel()), ...patch }))

  const onProviderChange = (p: ProviderType) => {
    const m = PROVIDER_META[p]
    setDraft((d) => {
      const next = { ...(d || emptyModel()), provider: p }
      // 切换厂商时，自动同步更新为该厂商的官方默认 Base URL；若为自定义厂商则清空供自由输入
      next.baseUrl = m?.defaultBaseUrl ?? ''
      return next
    })
    setSpeedResult(null)
    setFetchedModels([])
  }

  // 1. 实时端点测速 (对齐 cc-switch EndpointSpeedTest)
  const handleTestSpeed = async (
    urlOverride?: string,
    apiKeyOverride?: string,
    resultTargetId?: string,
  ) => {
    const targetUrl = urlOverride || draft?.baseUrl || meta?.defaultBaseUrl
    const targetKey = apiKeyOverride ?? draft?.apiKey
    if (!targetUrl) {
      if (resultTargetId) {
        setCardSpeedResults((prev) => ({
          ...prev,
          [resultTargetId]: { status: 'err', msg: '未配置 Base URL' },
        }))
      } else {
        setSpeedResult({ status: 'err', msg: '请先填写 Base URL' })
      }
      return
    }

    if (!resultTargetId) {
      setSpeedTesting(true)
      setSpeedResult(null)
    }

    const start = clock.now()
    try {
      const cleanUrl = targetUrl.replace(/\/+$/, '')
      const testEp = cleanUrl.endsWith('/v1') ? `${cleanUrl}/models` : `${cleanUrl}/v1/models`
      const res = await fetch(testEp, {
        method: 'GET',
        headers: targetKey ? { Authorization: `Bearer ${targetKey}` } : {},
        signal: AbortSignal.timeout(6000),
      })
      const latency = clock.now() - start
      if (res.ok) {
        const payload = {
          status: 'ok' as const,
          latency,
          msg: `${latency}ms 正常 (HTTP ${res.status})`,
        }
        if (resultTargetId) setCardSpeedResults((prev) => ({ ...prev, [resultTargetId]: payload }))
        else setSpeedResult(payload)
      } else if (res.status === 401 || res.status === 403) {
        const payload = {
          status: 'err' as const,
          latency,
          msg: `${latency}ms 端点可达，密钥未通过 (HTTP ${res.status})`,
        }
        if (resultTargetId) setCardSpeedResults((prev) => ({ ...prev, [resultTargetId]: payload }))
        else setSpeedResult(payload)
      } else {
        const payload = {
          status: 'ok' as const,
          latency,
          msg: `${latency}ms 端点可达 (HTTP ${res.status})`,
        }
        if (resultTargetId) setCardSpeedResults((prev) => ({ ...prev, [resultTargetId]: payload }))
        else setSpeedResult(payload)
      }
    } catch (err: any) {
      const payload = { status: 'err' as const, msg: err?.message || '连接超时或网络不可达' }
      if (resultTargetId) setCardSpeedResults((prev) => ({ ...prev, [resultTargetId]: payload }))
      else setSpeedResult(payload)
    } finally {
      if (!resultTargetId) setSpeedTesting(false)
    }
  }

  // 2. 实时拉取模型列表 (对齐 cc-switch ModelInputWithFetch)
  const handleFetchModels = async () => {
    const targetUrl = draft?.baseUrl || meta?.defaultBaseUrl
    if (!targetUrl) {
      setSpeedResult({ status: 'err', msg: '获取模型失败：请先填写 Base URL' })
      return
    }
    setFetchingModels(true)
    try {
      const cleanUrl = targetUrl.replace(/\/+$/, '')
      const candidates = [`${cleanUrl}/models`, `${cleanUrl}/v1/models`, cleanUrl]
      let found: { id: string }[] = []
      for (const ep of candidates) {
        try {
          const res = await fetch(ep, {
            method: 'GET',
            headers: draft?.apiKey ? { Authorization: `Bearer ${draft.apiKey}` } : {},
            signal: AbortSignal.timeout(6000),
          })
          if (!res.ok) continue
          const data = await res.json()
          if (Array.isArray(data?.data)) {
            found = data.data.map((m: any) => ({ id: m.id || m.name })).filter((m: any) => !!m.id)
            if (found.length > 0) break
          }
          if (Array.isArray(data?.models)) {
            found = data.models
              .map((m: any) => ({ id: m.name || m.model || m.id }))
              .filter((m: any) => !!m.id)
            if (found.length > 0) break
          }
        } catch {
          /* try next candidate */
        }
      }
      if (found.length > 0) {
        setFetchedModels(found)
        setShowModelDropdown(true)
        setSpeedResult({ status: 'ok', msg: `成功获取 ${found.length} 个可用模型，请点击下拉选择` })
      } else {
        setSpeedResult({ status: 'err', msg: '未在该端点发现模型列表，请手动输入模型 ID' })
      }
    } catch (err: any) {
      setSpeedResult({ status: 'err', msg: err?.message || '获取模型列表超时' })
    } finally {
      setFetchingModels(false)
    }
  }

  // 3. 保存当前表单供应商（更新/新增到 savedList 并持久化）
  const handleSave = () => {
    if (!draft || !draft.provider || !draft.id) return
    const currentList = [...savedList]
    const existingIndex = currentList.findIndex(
      (m) =>
        (m.id === draft.id && m.provider === draft.provider) || (m.name && m.name === draft.name),
    )

    let updatedList: ModelConfig[]
    if (existingIndex >= 0) {
      updatedList = currentList.map((m, idx) => (idx === existingIndex ? draft : m))
    } else {
      updatedList = [...currentList, draft]
    }

    update({
      aiModel: draft,
      savedAiModels: updatedList,
    })
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2500)
    setIsEditing(false)
  }

  // 4. 一键切换当前激活的供应商 (对齐 cc-switch ProviderCard onSwitch)
  const handleSwitchProvider = (target: ModelConfig) => {
    update({ aiModel: target })
    setDraft(target)
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2000)
  }

  // 5. 删除某个已保存供应商
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
    if (draft?.id === target.id) {
      setDraft(updatedList[0] || null)
    }
  }

  // 6. 复制克隆供应商
  const handleDuplicateProvider = (target: ModelConfig) => {
    const copy: ModelConfig = {
      ...target,
      name: `${target.name || target.id} (副本)`,
    }
    const updatedList = [...savedList, copy]
    update({ savedAiModels: updatedList })
  }

  // 过滤模型下拉项
  const filteredFetchedModels = useMemo(() => {
    if (!modelSearch.trim()) return fetchedModels
    const q = modelSearch.toLowerCase()
    return fetchedModels.filter((m) => m.id.toLowerCase().includes(q))
  }, [fetchedModels, modelSearch])

  return (
    <div className="space-y-6">
      {/* ── 模块 1：当前已配置的供应商卡片列表（多供应商管理与一键热切换）── */}
      <Section
        title="已配置供应商列表"
        desc="多服务商独立配置：可保存多个服务商端点与密钥，随时一键热切换为当前写作模型。"
      >
        <div className="p-4 space-y-3">
          {savedList.length === 0 ? (
            <div className="text-center py-8 px-4 rounded-xl border border-dashed border-[var(--ink-border)] bg-[var(--ink-bg-elevated)]/40">
              <div className="w-10 h-10 rounded-xl bg-[var(--ink-accent)]/10 text-[var(--ink-accent)] flex items-center justify-center mx-auto mb-2.5">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="text-[13px] font-semibold text-[var(--ink-text)]">
                暂无已保存的 AI 供应商
              </div>
              <div className="text-[11.5px] text-[var(--ink-text-faint)] mt-1 max-w-sm mx-auto">
                点击下方表单添加你的首个模型服务商（如 DeepSeek、OpenAI、Ollama
                本地等），即可开启全书正文辅助创作。
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {savedList.map((m, idx) => {
                const isActive =
                  settings.aiModel?.id === m.id && settings.aiModel?.provider === m.provider
                const pMeta = PROVIDER_META[m.provider]
                const cardKey = `${m.provider}_${m.id}_${idx}`
                const sp = cardSpeedResults[cardKey]

                return (
                  <div
                    key={cardKey}
                    className={`p-3.5 rounded-xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isActive
                        ? 'border-[var(--ink-accent)] bg-[var(--ink-accent)]/5 ring-1 ring-[var(--ink-accent)]/30 shadow-xs'
                        : 'border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] hover:border-[var(--ink-border-strong)]'
                    }`}
                  >
                    {/* 供应商基本信息 */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-[var(--ink-text)] truncate">
                          {m.name || m.id}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)] border border-[var(--ink-border)]">
                          {pMeta?.label || m.provider}
                        </span>
                        {isActive && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            当前使用中
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
                      <div className="flex items-center gap-3 text-[11px] text-[var(--ink-text-faint)] mt-1 truncate">
                        <span className="font-mono text-[var(--ink-text-muted)] truncate">
                          模型: {m.id}
                        </span>
                        <span className="truncate">
                          端点: {m.baseUrl || pMeta?.defaultBaseUrl || '默认端点'}
                        </span>
                      </div>
                    </div>

                    {/* 卡片快速动作条（对齐 cc-switch ProviderActions） */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          handleTestSpeed(m.baseUrl || pMeta?.defaultBaseUrl, m.apiKey, cardKey)
                        }
                        className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-[var(--ink-border)] bg-[var(--ink-bg)] hover:bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] transition-colors flex items-center gap-1 cursor-pointer"
                        title="对该供应商端点快速测速"
                      >
                        <Zap className="w-3 h-3 text-amber-500" />
                        <span>测速</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDraft(m)
                          setIsEditing(true)
                          setSpeedResult(null)
                        }}
                        className="p-1.5 rounded-md text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer"
                        title="编辑此供应商参数"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicateProvider(m)}
                        className="p-1.5 rounded-md text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer"
                        title="复制克隆此配置"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteProvider(m)}
                        className="p-1.5 rounded-md text-[var(--ink-text-muted)] hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="删除此供应商"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => handleSwitchProvider(m)}
                          className="px-3 py-1 rounded-md text-[11px] font-medium bg-[var(--ink-accent)] text-white hover:bg-[var(--ink-accent-hover)] transition-colors cursor-pointer ml-1"
                        >
                          启用为当前
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setDraft(emptyModel())
                setIsEditing(true)
                setSpeedResult(null)
                setFetchedModels([])
              }}
              className="px-3.5 py-1.5 rounded-lg text-[12px] font-medium bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] hover:border-[var(--ink-accent)] hover:text-[var(--ink-accent)] transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 text-[var(--ink-accent)]" />
              <span>添加新供应商…</span>
            </button>
          </div>
        </div>
      </Section>

      {/* ── 模块 2：添加 / 编辑供应商详细表单（具备模型一键获取与端点测速能力）── */}
      {isEditing && (
        <Section
          title={
            draft?.id && savedList.some((s) => s.id === draft.id)
              ? '编辑供应商'
              : '添加新供应商配置'
          }
          desc="配置模型 API 端点、密钥、模型 ID。可点击端点旁「测速」检验可用性，点击模型旁「获取」自动拉取可用模型。"
        >
          <div className="p-5 space-y-4">
            {/* 测速 / 连通性提示条 */}
            {speedResult && (
              <div
                className={`text-[11.5px] px-3.5 py-2 rounded-xl border flex items-center gap-2 transition-all ${
                  speedResult.status === 'ok'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-600'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                <span className="font-medium">{speedResult.msg}</span>
              </div>
            )}

            {/* 快速选择厂商胶囊药丸群 */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className={fieldLabel}>选择服务商 / 协议类型</div>
                {provider && (
                  <span className="text-[11px] text-[var(--ink-accent)] font-medium">
                    当前选择: {PROVIDER_META[provider]?.label || provider}
                  </span>
                )}
              </div>

              {/* 顶尖厂商药丸列表 + 自定义厂商按钮 */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  // 1. 全球前沿旗舰厂商
                  { id: 'deepseek', label: 'DeepSeek' },
                  { id: 'openai', label: 'OpenAI' },
                  { id: 'claude', label: 'Anthropic' },
                  { id: 'gemini', label: 'Google' },
                  { id: 'xai', label: 'xAI' },

                  // 2. 国内主流前沿文学与长文本厂商（纯厂商名，不绑死具体模型代号）
                  { id: 'moonshot', label: '月之暗面' },
                  { id: 'zhipu', label: '智谱 AI' },
                  { id: 'minimax', label: 'MiniMax' },
                  { id: 'qwen', label: '通义千问' },
                  { id: 'doubao', label: '字节豆包' },
                  { id: 'siliconflow', label: '硅基流动' },

                  // 3. 聚合服务与本地离线
                  { id: 'ollama', label: 'Ollama (本地)' },
                  { id: 'openrouter', label: 'OpenRouter' },
                  { id: 'groq', label: 'Groq' },
                  { id: 'mistral', label: 'Mistral' },
                  { id: 'azure', label: 'Azure OpenAI' },
                  { id: 'bedrock', label: 'AWS Bedrock' },

                  // 4. 自定义厂商（核心功能）
                  { id: 'custom', label: '+ 自定义厂商 (兼容反代)', isCustom: true },
                ].map((p) => {
                  const isSelected = provider === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onProviderChange(p.id as ProviderType)}
                      className={`px-3 py-1 rounded-full text-[11.5px] border transition-all duration-150 cursor-pointer flex items-center gap-1 ${
                        isSelected
                          ? 'bg-[var(--ink-accent)] text-white border-transparent shadow-2xs font-medium ring-1 ring-[var(--ink-accent)]'
                          : p.isCustom
                            ? 'bg-[var(--ink-accent)]/5 border-[var(--ink-accent)]/30 text-[var(--ink-accent)] hover:bg-[var(--ink-accent)]/10 font-medium'
                            : 'bg-[var(--ink-bg-elevated)] border-[var(--ink-border)] text-[var(--ink-text-muted)] hover:border-[var(--ink-border-strong)] hover:text-[var(--ink-text)]'
                      }`}
                    >
                      <span>{p.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <div className={fieldLabel}>供应商名称 (用于区分管理)</div>
              <input
                className={inputCls}
                value={draft?.name ?? ''}
                placeholder="界面展示名"
                onChange={(e) => patchDraft({ name: e.target.value })}
              />
            </div>

            {/* API Base URL 与 测速按钮 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className={fieldLabel}>
                  API Base URL 端点
                  {meta?.defaultBaseUrl && (
                    <span className="text-[var(--ink-text-faint)] font-normal ml-1">
                      （官方默认: {meta.defaultBaseUrl}）
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  className={`${inputCls} flex-1`}
                  value={draft?.baseUrl ?? ''}
                  placeholder={meta?.defaultBaseUrl ?? 'https://...'}
                  onChange={(e) => patchDraft({ baseUrl: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => handleTestSpeed()}
                  disabled={speedTesting}
                  className="px-3 py-2 rounded-lg text-[12px] font-medium border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] hover:border-[var(--ink-border-strong)] text-[var(--ink-text)] hover:text-[var(--ink-accent)] transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="测试此端点网络连通性与响应时间"
                >
                  {speedTesting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--ink-accent)]" />
                  ) : (
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                  )}
                  <span>{speedTesting ? '测速中…' : '端点测速'}</span>
                </button>
              </div>
            </div>

            {/* API Key */}
            <div>
              <div className={fieldLabel}>
                API Key 接口密钥
                {meta?.apiKeyEnv && (
                  <span className="text-[var(--ink-text-faint)] font-normal ml-1">
                    （对应系统环境变量 {meta.apiKeyEnv}，留空则自动读取）
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  className={`${inputCls} pr-10`}
                  type={showKey ? 'text' : 'password'}
                  value={draft?.apiKey ?? ''}
                  placeholder="sk-... / 留空则使用环境变量"
                  onChange={(e) => patchDraft({ apiKey: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-text-faint)] hover:text-[var(--ink-text)] cursor-pointer"
                  title={showKey ? '隐藏' : '显示'}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* 模型 ID 输入 与 一键获取模型列表 (对齐 cc-switch ModelInputWithFetch) */}
            <div className="relative">
              <div className="flex items-center justify-between mb-1.5">
                <div className={fieldLabel}>模型标识 (Model ID)</div>
                <span className="text-[10.5px] text-[var(--ink-text-faint)]">
                  支持手动填写或点击右侧一键获取云端可用模型
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  className={`${inputCls} flex-1`}
                  value={draft?.id ?? ''}
                  placeholder="输入模型 ID 或点击右侧获取"
                  onChange={(e) => patchDraft({ id: e.target.value })}
                />
                <button
                  type="button"
                  onClick={handleFetchModels}
                  disabled={fetchingModels}
                  className="px-3 py-2 rounded-lg text-[12px] font-medium border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] hover:border-[var(--ink-border-strong)] text-[var(--ink-text)] hover:text-[var(--ink-accent)] transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="调用 /models 端点实时拉取该服务商支持的真实模型列表"
                >
                  {fetchingModels ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--ink-accent)]" />
                  ) : (
                    <Download className="w-3.5 h-3.5 text-[var(--ink-accent)]" />
                  )}
                  <span>{fetchingModels ? '拉取中…' : '获取模型列表'}</span>
                </button>
              </div>

              {/* 获取成功的模型列表下拉抽屉 */}
              {showModelDropdown && fetchedModels.length > 0 && (
                <div className="mt-2 p-2 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] shadow-lg max-h-60 overflow-y-auto space-y-1 z-30">
                  <div className="relative mb-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--ink-text-faint)]" />
                    <input
                      type="text"
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      placeholder="在拉取的模型中搜索筛选…"
                      className="w-full pl-7 pr-3 py-1 text-[11.5px] rounded-md bg-[var(--ink-bg)] border border-[var(--ink-border)] focus:outline-none"
                    />
                  </div>
                  <div className="text-[10px] text-[var(--ink-text-faint)] px-1">
                    共发现 {fetchedModels.length} 个模型（点击直接载入）：
                  </div>
                  <div className="grid grid-cols-1 gap-0.5">
                    {filteredFetchedModels.slice(0, 50).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          patchDraft({ id: m.id, name: m.id })
                          setShowModelDropdown(false)
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[12px] font-mono transition-colors flex items-center justify-between cursor-pointer ${
                          draft?.id === m.id
                            ? 'bg-[var(--ink-accent)] text-white font-medium'
                            : 'hover:bg-[var(--ink-bg-hover)] text-[var(--ink-text)]'
                        }`}
                      >
                        <span className="truncate">{m.id}</span>
                        {draft?.id === m.id && <Check className="w-3 h-3 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 高级模型参数 */}
            <details className="group border-t border-[var(--ink-border)] pt-3">
              <summary className="cursor-pointer text-[12.5px] text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] select-none font-medium">
                高级模型参数（生成上限 / 温度 / 惩罚项 / 思维预算）
              </summary>
              <div className="pt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <NumField
                  label="单次最大输出 (maxTokens)"
                  value={draft?.maxTokens}
                  min={1}
                  max={128000}
                  step={256}
                  placeholder="留空即由模型全权自适应"
                  hint="各模型差异极大（如 Claude 为 8k、DeepSeek 为 16k、o3-mini 为 100k）。若未配置或不熟悉上限，留空让底层自适应最稳妥。"
                  onChange={(v) => patchDraft({ maxTokens: v })}
                />
                <NumField
                  label="发散温度 (temperature)"
                  step={0.05}
                  min={0}
                  max={2.0}
                  value={draft?.temperature}
                  placeholder="默认 (通常 0.7)"
                  hint="0.1~0.3 严谨逻辑定稿；0.7 均衡写作；1.0+ 发散脑洞创作。"
                  onChange={(v) => patchDraft({ temperature: v })}
                />
                <NumField
                  label="核采样 (topP)"
                  step={0.05}
                  min={0}
                  max={1.0}
                  value={draft?.topP}
                  hint="通常保持默认或 0.95。"
                  onChange={(v) => patchDraft({ topP: v })}
                />
                <NumField
                  label="存在惩罚 (presencePenalty)"
                  step={0.1}
                  min={-2.0}
                  max={2.0}
                  value={draft?.presencePenalty}
                  hint="高于 0 鼓励模型引入新话题与新角色词汇。"
                  onChange={(v) => patchDraft({ presencePenalty: v })}
                />
                <NumField
                  label="频率惩罚 (frequencyPenalty)"
                  step={0.1}
                  min={-2.0}
                  max={2.0}
                  value={draft?.frequencyPenalty}
                  hint="高于 0 抑制词汇重复与口癖。"
                  onChange={(v) => patchDraft({ frequencyPenalty: v })}
                />
                <NumField
                  label="思考预算 (thinkingBudget)"
                  step={1024}
                  min={0}
                  max={64000}
                  value={draft?.thinkingBudget}
                  placeholder="默认思考深度"
                  hint="用于 R1 / Claude 思考模型设定专属推理预算。"
                  onChange={(v) => patchDraft({ thinkingBudget: v })}
                />
              </div>
              <div className="pt-3 flex gap-4">
                <Toggle
                  label="supportsThinking"
                  checked={!!draft?.supportsThinking}
                  onChange={(v) => patchDraft({ supportsThinking: v })}
                />
                <Toggle
                  label="supportsPromptCache"
                  checked={!!draft?.supportsPromptCache}
                  onChange={(v) => patchDraft({ supportsPromptCache: v })}
                />
              </div>
            </details>

            <div className="flex items-center gap-2 pt-2 border-t border-[var(--ink-border)]">
              <button
                type="button"
                onClick={handleSave}
                disabled={!provider || !draft?.id}
                className="px-4 py-2 rounded-lg text-[12.5px] bg-[var(--ink-accent)] text-white hover:bg-[var(--ink-accent-hover)] disabled:opacity-40 transition-colors duration-150 cursor-pointer shadow-2xs font-medium"
              >
                保存配置
              </button>
              {savedList.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3.5 py-2 rounded-lg text-[12.5px] border border-[var(--ink-border)] hover:bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] transition-colors cursor-pointer"
                >
                  收起表单
                </button>
              )}
            </div>
          </div>
        </Section>
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
            <div className="text-[var(--ink-text)] font-medium mt-0.5">InkPi Daemon (streamAi)</div>
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
