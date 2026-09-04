import { useEffect, useMemo, type FC } from 'react'
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  CalendarDays,
  PenLine,
  Table2,
  Zap,
  Sparkles,
  Stethoscope,
} from 'lucide-react'
import { useDashboardModel } from '../../hooks/useDashboardModel'
import type { DashboardModel } from '../../domain/dashboard'

interface DashboardViewProps {
  projectId: string
  /** 跳转到指定主视口（editor / form / table / 插件 id） */
  onOpenView: (view: string) => void
  /** 向 Engine 上报统计，驱动右侧信息栏 */
  onStats?: (stats: { title?: string; wordCount: number; updatedAt?: number }) => void
  /** 打开 AI 副驾驶 */
  onOpenAssistant?: () => void
  /** 直接进入「沉浸写作」：打开编辑器并开启聚焦模式 */
  onStartFocus?: () => void
}

// 模型为空时的占位（加载阶段），保证渲染不崩
const EMPTY_MODEL: DashboardModel = {
  volumes: [],
  chapters: [],
  totalWords: 0,
  published: 0,
  drafted: 0,
  reviewed: 0,
  weekWords: 0,
  weekChapters: 0,
  todayWords: 0,
  todayChapters: 0,
  lastUpdated: 0,
  dailyWords: {},
  volumeProgress: [],
  streakDays: 0,
  idleDays: 0,
}

const DAY_MS = 24 * 60 * 60 * 1000

const fmtWords = (n: number): string =>
  n >= 10000 ? `${(n / 10000).toFixed(2)} 万字` : `${n} 字`

const lastNDateStr = (n: number): string[] => {
  const arr: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY_MS)
    arr.push(`${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }
  return arr
}

const lastNFullDate = (n: number): string[] => {
  const arr: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY_MS)
    arr.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    )
  }
  return arr
}

export const DashboardView: FC<DashboardViewProps> = ({
  projectId,
  onOpenView,
  onStats,
  onOpenAssistant,
  onStartFocus,
}) => {
  // 数据聚合已下沉到纯函数 computeDashboardModel + useDashboardModel hook：
  // 本组件只负责声明式渲染与事件委托，不再接触存储或做派生计算（被动视图）。
  const model = useDashboardModel(projectId)
  const loading = model === null
  const data = model ?? EMPTY_MODEL

  useEffect(() => {
    if (!model) return
    onStats?.({
      title: model.project?.name,
      wordCount: model.totalWords,
      updatedAt: model.lastUpdated,
    })
  }, [model, onStats])

  const statCards = [
    {
      label: '累计字数',
      value: fmtWords(data.totalWords),
      sub: `${data.volumes.length} 卷 · ${data.chapters.length} 章`,
      icon: BookOpen,
      accent: false,
    },
    {
      label: '完稿章节',
      value: `${data.published}`,
      sub: `已发布 ${data.published} · 草稿中 ${data.drafted}${data.reviewed ? ` · 审阅中 ${data.reviewed}` : ''}`,
      icon: CheckCircle2,
      accent: false,
    },
    {
      label: '今日产出',
      value: fmtWords(data.todayWords),
      sub: data.todayChapters > 0 ? `今日更新 ${data.todayChapters} 章` : '今日尚未动笔',
      icon: PenLine,
      accent: true,
    },
    {
      label: '近7日产量',
      value: fmtWords(data.weekWords),
      sub: data.weekChapters > 0 ? `日均 ${Math.round(data.weekWords / 7)} 字 · ${data.weekChapters} 章有更新` : '暂无更新',
      icon: TrendingUp,
      accent: false,
    },
  ]

  // 快捷入口：全部直达真实功能
  const quickJumps = [
    { label: '正文写作', icon: PenLine, view: 'editor', accent: true, ready: true },
    { label: '沉浸专注', icon: Zap, view: '__focus__', accent: false, ready: true },
    { label: '大纲与资料', icon: Table2, view: 'chapter-master', accent: false, ready: true },
  ]


  const handleJump = (entry: { view: string; ready: boolean }) => {
    if (!entry.ready) return
    if (entry.view === '__focus__') {
      onStartFocus?.()
    } else {
      onOpenView(entry.view)
    }
  }

  const weekDates = useMemo(() => lastNFullDate(7), [])
  const weekLabels = useMemo(() => lastNDateStr(7), [])
  const maxWeek = useMemo(
    () => Math.max(...weekDates.map((d) => data.dailyWords[d] || 0), 1),
    [data.dailyWords, weekDates],
  )

  const calendarDates = useMemo(() => lastNFullDate(30), [])
  const maxCalendar = useMemo(
    () => Math.max(...calendarDates.map((d) => data.dailyWords[d] || 0), 1),
    [data.dailyWords, calendarDates],
  )

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[var(--ink-bg)] text-[var(--ink-text)]">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 py-8">
        {/* 页头 */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">写作面板</h1>
            <p className="text-[13px] text-[var(--ink-text-faint)] mt-1">
              创作全景一览 · 数据实时同步自各页签
            </p>
          </div>
          {onOpenAssistant && (
            <button
              onClick={onOpenAssistant}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-[var(--ink-accent-soft)] text-[var(--ink-accent)] text-[12px] font-medium flex items-center gap-1.5 hover:bg-[var(--ink-bg-active)] transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              灵感助手
            </button>
          )}
        </div>

        {/* 4 张统计卡 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6">
          {statCards.map((c) => {
            const Icon = c.icon
            return (
              <div
                key={c.label}
                className="p-4 rounded-2xl bg-[var(--ink-bg-panel)] border border-[var(--ink-border)] shadow-sm transition-all duration-200 ease-[var(--ink-ease)] hover:shadow-md hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between text-[12px] text-[var(--ink-text-faint)]">
                  <span>{c.label}</span>
                  <Icon className={`w-4 h-4 ${c.accent ? 'text-amber-500' : 'text-[var(--ink-accent)]'}`} />
                </div>
                <div className="text-2xl font-bold mt-2 tracking-tight">{c.value}</div>
                <div className="text-[11px] text-[var(--ink-text-faint)] mt-1">{c.sub}</div>
              </div>
            )
          })}
        </div>

        {/* 中间两栏：码字日历 + 近7日产量 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
          {/* 码字日历 */}
          <div className="p-4 rounded-2xl bg-[var(--ink-bg-panel)] border border-[var(--ink-border)] shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-[var(--ink-accent)]" />
                <h3 className="text-[13px] font-semibold">码字日历</h3>
              </div>
              <div className="text-right">
                <div className="text-[15px] font-bold">{fmtWords(data.todayWords)}</div>
                <div className="text-[10px] text-[var(--ink-text-faint)]">今日 · {data.todayChapters} 章有更新</div>
              </div>
            </div>
            <div className="flex items-end gap-1 h-24">
              {calendarDates.map((d) => {
                const words = data.dailyWords[d] || 0
                const ratio = maxCalendar ? words / maxCalendar : 0
                const level =
                  ratio > 0.75
                    ? 'bg-[var(--ink-accent)]'
                    : ratio > 0.5
                      ? 'bg-[var(--ink-accent)]/70'
                      : ratio > 0.25
                        ? 'bg-[var(--ink-accent)]/45'
                        : ratio > 0
                          ? 'bg-[var(--ink-accent)]/20'
                          : 'bg-[var(--ink-bg-hover)]'
                return (
                  <div key={d} className="flex-1 flex flex-col items-center gap-1 group" title={`${d}: ${words} 字`}>
                    <div
                      className={`w-full rounded-t-sm transition-all ${level}`}
                      style={{ height: `${Math.max(4, ratio * 100)}%` }}
                    />
                  </div>
                )
              })}
            </div>
            <div className="flex items-center justify-between mt-2 text-[10px] text-[var(--ink-text-faint)]">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-sm bg-[var(--ink-bg-hover)]" />
                <span>少</span>
                <span className="inline-block w-2 h-2 rounded-sm bg-[var(--ink-accent)]/30" />
                <span>中</span>
                <span className="inline-block w-2 h-2 rounded-sm bg-[var(--ink-accent)]" />
                <span>多</span>
              </div>
              <span>{data.streakDays > 0 ? `${data.streakDays} 天连续码字` : '今日未打卡'}</span>
            </div>
          </div>

          {/* 近7日写作字数 */}
          <div className="p-4 rounded-2xl bg-[var(--ink-bg-panel)] border border-[var(--ink-border)] shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[var(--ink-accent)]" />
                <h3 className="text-[13px] font-semibold">近 7 日写作字数</h3>
              </div>
              <div className="text-[11px] text-[var(--ink-text-faint)]">{data.weekChapters} 章更新</div>
            </div>
            <div className="flex items-end gap-2 h-32 px-1">
              {weekDates.map((d, i) => {
                const words = data.dailyWords[d] || 0
                const ratio = maxWeek ? words / maxWeek : 0
                return (
                  <div key={d} className="flex-1 flex flex-col items-center gap-1.5 group">
                    <div className="text-[10px] text-[var(--ink-text-faint)] opacity-0 group-hover:opacity-100 transition-opacity">
                      {words > 0 ? `${(words / 1000).toFixed(1)}k` : '0'}
                    </div>
                    <div
                      className="w-full max-w-[36px] rounded-lg bg-[var(--ink-accent)]/80 group-hover:bg-[var(--ink-accent)] transition-all"
                      style={{ height: `${Math.max(8, ratio * 100)}%` }}
                      title={`${d}: ${words} 字`}
                    />
                    <div className="text-[10px] text-[var(--ink-text-faint)]">{weekLabels[i]}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* 快捷入口 + 分卷进度 + 健康提醒 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
          {/* 快捷入口 3x2 */}
          <div>
            <h3 className="text-[12px] font-semibold text-[var(--ink-text-faint)] mb-3 px-1">快捷入口</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {quickJumps.map((q) => {
                const Icon = q.icon
                return (
                  <button
                    key={q.label}
                    disabled={!q.ready}
                    onClick={() => handleJump(q)}
                    title={q.ready ? q.label : `${q.label}（建设中）`}
                    className={`p-3 rounded-xl border text-left flex flex-col items-center justify-center gap-2 transition-all duration-200 ease-[var(--ink-ease)] ${
                      !q.ready
                        ? 'bg-[var(--ink-bg-panel)] border-[var(--ink-border)] text-[var(--ink-text-faint)] cursor-not-allowed opacity-60'
                        : q.accent
                          ? 'bg-[var(--ink-accent)] text-white border-[var(--ink-accent)] hover:bg-[var(--ink-accent-hover)] shadow-sm'
                          : 'bg-[var(--ink-bg-panel)] border-[var(--ink-border)] text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] hover:border-[var(--ink-border-strong)]'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[12px] font-medium">{q.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 分卷进度 */}
          <div className="p-4 rounded-2xl bg-[var(--ink-bg-panel)] border border-[var(--ink-border)] shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-semibold">分卷进度</h3>
              <span className="text-[11px] text-[var(--ink-text-faint)]">
                {data.chapters.length > 0 ? `${Math.round((data.published / data.chapters.length) * 100)}% 已发布` : '—'}
              </span>
            </div>
            {loading ? (
              <div className="text-[12px] text-[var(--ink-text-faint)]">加载中…</div>
            ) : data.volumeProgress.length === 0 ? (
              <div className="text-[12px] text-[var(--ink-text-faint)]">暂无分卷</div>
            ) : (
              <div className="space-y-3">
                {data.volumeProgress.map((v) => {
                  const pct = v.total > 0 ? Math.round((v.current / v.total) * 100) : 0
                  return (
                    <div key={v.title}>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-[var(--ink-text)] truncate">{v.title}</span>
                        <span className="text-[var(--ink-text-faint)] shrink-0">{v.current}/{v.total} 章 · {pct}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[var(--ink-bg-hover)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--ink-accent)] transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 创作健康提醒 */}
          <div className="p-4 rounded-2xl bg-[var(--ink-bg-panel)] border border-[var(--ink-border)] shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-semibold">创作健康提醒</h3>
              {onOpenAssistant && (
                <button
                  onClick={onOpenAssistant}
                  className="text-[11px] px-2 py-0.5 rounded-md border border-[var(--ink-border)] text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] flex items-center gap-1 transition-colors"
                >
                  <Stethoscope className="w-3 h-3" />
                  AI 诊断
                </button>
              )}
            </div>
            <ul className="space-y-2 text-[12px]">
              <li className="flex items-start gap-2 text-[var(--ink-text)]">
                <span className="mt-0.5 w-1 h-1 rounded-full bg-[var(--ink-accent)] shrink-0" />
                <span>全书篇幅进度：当前已完成 {data.chapters.length} 章节，总计 {fmtWords(data.totalWords)}</span>
              </li>
              <li className="flex items-start gap-2 text-[var(--ink-text)]">
                <span className="mt-0.5 w-1 h-1 rounded-full bg-[var(--ink-accent)] shrink-0" />
                <span>草稿待修状态：共 {data.drafted} 章草稿正在打磨中</span>
              </li>
              {data.idleDays > 0 && (
                <li className="flex items-start gap-2 text-amber-600">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>已连续 {data.idleDays} 天未更新，建议开启小黑屋保持手感</span>
                </li>
              )}
              {data.streakDays > 0 && data.idleDays === 0 && (
                <li className="flex items-start gap-2 text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>已连续 {data.streakDays} 天坚持码字，手感正佳</span>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
