import { useState, useEffect, useMemo, type FC } from 'react'
import {
  TrendingUp,
  Scroll,
  History,
  Smile,
  Compass,
  FileEdit,
  Flame,
  ArrowRight,
} from 'lucide-react'
import { useDashboardModel } from '../../hooks/useDashboardModel'
import { indexedDbSettingsKVRepository } from '../../adapters/indexedDbSettingsKVRepository'
import { clock } from '../../adapters/clock'
import { HelpTooltip } from '../../ui/molecules/HelpTooltip'
import type { DashboardModel, WritingGoalPlan } from '../../domain/dashboard'

interface DashboardViewProps {
  projectId: string
  /** 跳转到指定主视口或页签（editor / foreshadow / timeline 等） */
  onOpenView: (view: string) => void
  /** 向 Engine 上报统计，驱动右侧信息栏 */
  onStats?: (stats: { title?: string; wordCount: number; updatedAt?: number }) => void
  /** 打开 AI 助手 */
  onOpenAssistant?: () => void
  /** 发送真实指令给 AI 助手（健康诊断 / 审读建议 / 深度分析等） */
  onAiPrompt?: (text: string, chapterId?: string) => void
  /** 直接进入「沉浸写作」 */
  onStartFocus?: () => void
}

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
  unresolvedForeshadowsCount: 0,
  unusedIdeasCount: 0,
  progressWeekSum: 0,
  progressDailyList: [],
  dailyStatsMap: {},
  characterHeatmap: [],
}

const fmtWords = (n: number): string => (n >= 10000 ? `${(n / 10000).toFixed(2)} 万` : `${n}`)

export const DashboardView: FC<DashboardViewProps> = ({
  projectId,
  onOpenView,
  onStats,
  onOpenAssistant: _onOpenAssistant,
  onAiPrompt: _onAiPrompt,
  onStartFocus,
}) => {
  const { model } = useDashboardModel(projectId)
  const loading = model === null
  const data = model ?? EMPTY_MODEL

  // 1. 目标与截止日设置持久化
  const [goalPlan, setGoalPlan] = useState<WritingGoalPlan>({
    daily: 2000,
    total: 0,
    deadline: '',
  })

  useEffect(() => {
    let alive = true
    Promise.all([
      indexedDbSettingsKVRepository.get(projectId, 'goalDaily', 2000),
      indexedDbSettingsKVRepository.get(projectId, 'goalTotal', 0),
      indexedDbSettingsKVRepository.get(projectId, 'goalDeadline', ''),
    ]).then(([daily, total, deadline]) => {
      if (!alive) return
      setGoalPlan({ daily, total, deadline })
    })
    return () => {
      alive = false
    }
  }, [projectId])

  const updateGoal = async (patch: Partial<WritingGoalPlan>) => {
    const next = { ...goalPlan, ...patch }
    setGoalPlan(next)
    if (patch.daily !== undefined) {
      await indexedDbSettingsKVRepository.set(projectId, 'goalDaily', patch.daily)
    }
    if (patch.total !== undefined) {
      await indexedDbSettingsKVRepository.set(projectId, 'goalTotal', patch.total)
    }
    if (patch.deadline !== undefined) {
      await indexedDbSettingsKVRepository.set(projectId, 'goalDeadline', patch.deadline)
    }
  }

  useEffect(() => {
    if (!model) return
    onStats?.({
      title: model.project?.name,
      wordCount: model.totalWords,
      updatedAt: model.lastUpdated,
    })
  }, [model, onStats])

  // 3. 页面顶部项目名
  const projectAuthorName = data.project?.name || '作品概览'

  // 4. 五列极简指标栏（对齐参考图一顶部的 Stat Row 布局：累计字数 / 完稿章节 / 最长连更 / 当前连续 / 未回收伏笔）
  const topStats = [
    {
      val: fmtWords(data.totalWords),
      unit: data.totalWords >= 10000 ? '' : ' 字',
      label: '累计字数',
      sub: `${data.chapters.length} 章 · ${data.volumes.length} 卷`,
      tip: '全书正文编辑器里全部章节的字数之和，自动保存并实时汇总。',
    },
    {
      val: `${data.published}`,
      unit: ' 章',
      label: '完稿章节',
      sub: `已发布 ${data.published} · 草稿 ${data.drafted}`,
      tip: '统计状态为「完稿」与「已发布」的章节总数。',
    },
    {
      val: fmtWords(data.progressWeekSum),
      unit: data.progressWeekSum >= 10000 ? '' : ' 字',
      label: '近 7 日产量',
      sub: `日均 ${Math.round(data.progressWeekSum / 7)} 字`,
      tip: '近 7 天累计创作产出（来自写作进度表或自动记录）。',
    },
    {
      val: `${data.streakDays}`,
      unit: ' 天',
      label: '当前连续码字',
      sub: data.todayWords > 0 ? '今日已打卡 ✓' : '今天尚未动笔',
      subHighlight: data.todayWords > 0,
      tip: '连续每日有码字产出的天数，断更一天则重置归零。',
    },
    {
      val: `${data.unresolvedForeshadowsCount}`,
      unit: ' 条',
      label: '未回收伏笔',
      sub: data.unresolvedForeshadowsCount > 5 ? '注意防烂尾' : '健康范围',
      subWarn: data.unresolvedForeshadowsCount > 5,
      tip: '来自《伏笔追踪》中状态为「未回收」的条目。超过 5 条红色预警。',
    },
  ]

  // 5. 码字活动热力图（对齐参考图一：支持 每日/每周 视图，占满容器宽度，带月份标注，圆角胶囊方块）
  const [heatmapRange, setHeatmapRange] = useState<'daily' | 'weekly' | 'all'>('daily')

  // 计算 52 周完整点阵数据（横向填满容器宽度，杜绝两侧大片留白）
  const heatmapWeeksCount = 52
  const fullYearData = useMemo(() => {
    const list: { date: string; month: number; words: number }[] = []
    const now = new Date()
    const totalDays = heatmapWeeksCount * 7
    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      list.push({
        date: dateStr,
        month: d.getMonth() + 1,
        words: data.dailyStatsMap[dateStr] || 0,
      })
    }
    return list
  }, [data.dailyStatsMap])

  // 计算每个月起始所在的 weekIndex，用于在底部精确标出 "10月"、"11月"、"12月"
  const monthLabels = useMemo(() => {
    const labels: { weekIdx: number; name: string }[] = []
    let lastMonth = -1
    for (let w = 0; w < heatmapWeeksCount; w++) {
      const dayItem = fullYearData[w * 7]
      if (dayItem && dayItem.month !== lastMonth) {
        lastMonth = dayItem.month
        labels.push({ weekIdx: w, name: `${dayItem.month}月` })
      }
    }
    return labels
  }, [fullYearData])

  // 6. 快捷入口：6 大常用页签直达
  const quickJumps = [
    { label: '正文编辑', icon: FileEdit, view: 'editor' },
    { label: '章节总表', icon: Scroll, view: 'chapter-master' },
    { label: '伏笔追踪', icon: Compass, view: 'foreshadow' },
    { label: '时间脉络', icon: History, view: 'timeline' },
    { label: '爽点节奏', icon: Flame, view: 'hookpoints' },
    { label: '灵感素材', icon: Smile, view: 'ideas' },
  ]

  // 8. 燃尽图计算（近 14 天）
  const burndownData = useMemo(() => {
    const points: { label: string; actualCum: number; targetCum: number }[] = []
    const now = new Date()
    let actualCum = 0
    let targetCum = 0
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const dayWords = data.dailyStatsMap[dateStr] || 0
      actualCum += dayWords
      targetCum += goalPlan.daily
      points.push({
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        actualCum,
        targetCum,
      })
    }
    return points
  }, [data.dailyStatsMap, goalPlan.daily])

  const maxBurndown = Math.max(1, ...burndownData.map((p) => Math.max(p.actualCum, p.targetCum)))
  const remainingWords = Math.max(0, goalPlan.total - data.totalWords)
  const avgDayWords = Math.round(data.progressWeekSum / 7)
  const daysNeeded =
    avgDayWords > 0 && goalPlan.total > 0 ? Math.ceil(remainingWords / avgDayWords) : 0
  const estimatedDate = daysNeeded > 0 ? new Date(clock.now() + daysNeeded * 86400000) : null
  const progressPercent =
    goalPlan.total > 0 ? Math.min(100, Math.round((data.totalWords / goalPlan.total) * 100)) : 0

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[var(--ink-bg)] text-[var(--ink-text)] font-sans select-none transition-colors duration-200">
      <div className="max-w-4xl mx-auto px-6 sm:px-8 py-8 space-y-7">
        {/* 顶部标题区（对齐 Notion 经典页面头部：极简、通透、零浮夸装饰） */}
        <div className="space-y-1 pb-2 border-b border-[var(--ink-border)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-[var(--ink-text)]">写作面板</h1>
              <span className="text-xs font-normal text-[var(--ink-text-faint)]">/</span>
              <span className="text-sm font-normal text-[var(--ink-text-muted)]">
                {projectAuthorName}
              </span>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] text-[var(--ink-text-muted)]">
              连载中
            </span>
          </div>
          <p className="text-[12px] text-[var(--ink-text-faint)]">
            实时汇总章节进度、创作产出与全书核心设定数据
          </p>
        </div>

        {/* 1. 核心指标通栏（对齐 SettingsView 的 Section 规范） */}
        <div className="rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] divide-y sm:divide-y-0 sm:divide-x divide-[var(--ink-border)] grid grid-cols-2 sm:grid-cols-5 shadow-2xs overflow-hidden">
          {topStats.map((item) => (
            <div
              key={item.label}
              className="p-4 flex flex-col items-center justify-center text-center gap-1 group transition-colors hover:bg-[var(--ink-bg-hover)]/30"
            >
              <div className="flex items-center gap-1">
                <span className="text-2xl font-bold text-[var(--ink-text)] tracking-tight tabular-nums">
                  {item.val}
                </span>
                {item.unit && (
                  <span className="text-[11.5px] text-[var(--ink-text-muted)] font-normal">
                    {item.unit}
                  </span>
                )}
                <HelpTooltip title={item.label} width="16rem" size={11}>
                  {item.tip}
                </HelpTooltip>
              </div>
              <div className="text-[11.5px] text-[var(--ink-text-muted)] font-medium">
                {item.label}
              </div>
              <div
                className={`text-[10.5px] truncate max-w-full ${
                  item.subWarn
                    ? 'text-red-500 font-medium'
                    : item.subHighlight
                      ? 'text-[var(--ink-accent)] font-medium'
                      : 'text-[var(--ink-text-faint)]'
                }`}
              >
                {item.sub}
              </div>
            </div>
          ))}
        </div>

        {/* 2. 码字活动点阵图（SettingsView 同款 Section 规范） */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <div>
              <h3 className="text-[14px] font-semibold text-[var(--ink-text)]">码字活动</h3>
              <p className="text-[12px] text-[var(--ink-text-faint)] mt-0.5">
                今日产出 {data.todayWords.toLocaleString()} 字 · 全自动实时统计
              </p>
            </div>
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)]">
              {(['daily', 'weekly', 'all'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setHeatmapRange(mode)}
                  className={`px-2.5 py-1 rounded-md text-[11.5px] transition-colors cursor-pointer ${
                    heatmapRange === mode
                      ? 'bg-[var(--ink-accent)] text-white shadow-2xs font-medium'
                      : 'text-[var(--ink-text-muted)] hover:text-[var(--ink-text)]'
                  }`}
                >
                  {mode === 'daily' ? '每日' : mode === 'weekly' ? '每周' : '累计'}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-5 shadow-2xs space-y-3.5 overflow-hidden">
            {/* 真正自适应充满容器的 SVG 热力点阵：通过 viewBox 矢量坐标缩放，从根本上彻底杜绝右侧被截断或文字折行问题 */}
            <div className="w-full">
              <svg
                viewBox="0 0 780 102"
                className="w-full h-auto block select-none"
                preserveAspectRatio="xMidYMid meet"
              >
                {/* 52 周点阵矩阵 */}
                {Array.from({ length: 52 }, (_, weekIdx) => {
                  const colX = weekIdx * 15
                  return (
                    <g key={weekIdx}>
                      {Array.from({ length: 7 }, (__, dayIdx) => {
                        const item = fullYearData[weekIdx * 7 + dayIdx]
                        const words = item?.words || 0
                        const rowY = dayIdx * 12
                        const fillColor =
                          words === 0
                            ? 'var(--ink-bg-hover)'
                            : words < 500
                              ? 'color-mix(in srgb, var(--ink-accent) 25%, transparent)'
                              : words < 1500
                                ? 'color-mix(in srgb, var(--ink-accent) 50%, transparent)'
                                : words < 3000
                                  ? 'color-mix(in srgb, var(--ink-accent) 75%, transparent)'
                                  : 'var(--ink-accent)'

                        return (
                          <rect
                            key={dayIdx}
                            x={colX}
                            y={rowY}
                            width={10}
                            height={9}
                            rx={2}
                            fill={fillColor}
                            className="transition-colors hover:stroke hover:stroke-[var(--ink-accent)]"
                          >
                            <title>
                              {item ? `${item.date}：${words.toLocaleString()} 字` : ''}
                            </title>
                          </rect>
                        )
                      })}
                    </g>
                  )
                })}

                {/* 底部月份标签（完全锁定在 SVG 坐标系中，两端自带 padding，永远不会被裁切或折行） */}
                {monthLabels.map((m) => {
                  const posX = Math.min(765, Math.max(14, m.weekIdx * 15 + 5))
                  return (
                    <text
                      key={m.name + m.weekIdx}
                      x={posX}
                      y={98}
                      textAnchor="middle"
                      fill="var(--ink-text-faint)"
                      fontSize={9.5}
                      fontFamily="inherit"
                    >
                      {m.name}
                    </text>
                  )
                })}
              </svg>
            </div>

            <div className="flex items-center justify-between pt-2 text-[11.5px] text-[var(--ink-text-faint)] border-t border-[var(--ink-border)]">
              <div className="flex items-center gap-1.5">
                <span>产出等级：少</span>
                <span className="w-2 h-2 rounded-[2px] bg-[var(--ink-bg-hover)] inline-block" />
                <span className="w-2 h-2 rounded-[2px] bg-[var(--ink-accent)]/25 inline-block" />
                <span className="w-2 h-2 rounded-[2px] bg-[var(--ink-accent)]/50 inline-block" />
                <span className="w-2 h-2 rounded-[2px] bg-[var(--ink-accent)]/75 inline-block" />
                <span className="w-2 h-2 rounded-[2px] bg-[var(--ink-accent)] inline-block" />
                <span>多</span>
              </div>
              <span>
                连续码字{' '}
                <strong className="text-[var(--ink-text)] font-semibold">{data.streakDays}</strong>{' '}
                天
              </span>
            </div>
          </div>
        </section>

        {/* 3. 创作洞察与高频工作台（并排 Section 风格） */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 左侧：活动洞察 */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[14px] font-semibold text-[var(--ink-text)]">活动洞察</h3>
              <button
                type="button"
                onClick={() => onOpenView('progress')}
                className="text-[11.5px] text-[var(--ink-accent)] hover:underline flex items-center gap-1 cursor-pointer font-medium"
              >
                写作进度表
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4 shadow-2xs divide-y divide-[var(--ink-border)]">
              <div className="py-2.5 flex items-center justify-between text-[12.5px]">
                <span className="text-[var(--ink-text-muted)]">正文总字数</span>
                <span className="text-[var(--ink-text)] font-medium tabular-nums">
                  {data.totalWords.toLocaleString()} 字
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between text-[12.5px]">
                <span className="text-[var(--ink-text-muted)]">近 7 日日均产出</span>
                <span className="text-[var(--ink-accent)] font-medium tabular-nums">
                  {avgDayWords.toLocaleString()} 字
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between text-[12.5px]">
                <span className="text-[var(--ink-text-muted)]">草稿打磨状态</span>
                <span className="text-[var(--ink-text)]">
                  {data.drafted > 0 ? `${data.drafted} 章草稿正在推进` : '全部已完稿'}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between text-[12.5px]">
                <span className="text-[var(--ink-text-muted)]">未回收伏笔</span>
                <span
                  className={`font-medium tabular-nums ${
                    data.unresolvedForeshadowsCount > 5 ? 'text-red-500' : 'text-[var(--ink-text)]'
                  }`}
                >
                  {data.unresolvedForeshadowsCount} 条
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between text-[12.5px]">
                <span className="text-[var(--ink-text-muted)]">闲置灵感素材</span>
                <span className="text-[var(--ink-text)] tabular-nums">
                  {data.unusedIdeasCount} 条未用
                </span>
              </div>
            </div>
          </section>

          {/* 右侧：快捷入口 */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[14px] font-semibold text-[var(--ink-text)]">快捷入口</h3>
              <span className="text-[12px] text-[var(--ink-text-faint)]">连载高频直达</span>
            </div>

            <div className="rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4 shadow-2xs flex flex-col justify-between h-[calc(100%-28px)]">
              <div className="grid grid-cols-3 gap-2">
                {quickJumps.map((q) => {
                  const Icon = q.icon
                  return (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => onOpenView(q.view)}
                      className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-lg bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] text-[var(--ink-text)] hover:border-[var(--ink-accent)] hover:text-[var(--ink-accent)] transition-colors cursor-pointer"
                    >
                      <Icon className="w-4 h-4 text-[var(--ink-text-muted)]" />
                      <span className="text-[11.5px] font-medium">{q.label}</span>
                    </button>
                  )
                })}
              </div>

              {onStartFocus && (
                <div className="pt-3 mt-3 border-t border-[var(--ink-border)]">
                  <button
                    type="button"
                    onClick={onStartFocus}
                    className="w-full py-2 px-3 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] hover:bg-[var(--ink-bg-hover)] text-[var(--ink-text)] text-[12px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>进入小黑屋 / 沉浸专注写作</span>
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* 4. 分卷进度与作品状态检视 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 分卷进度 */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[14px] font-semibold text-[var(--ink-text)]">分卷进度</h3>
              <span className="text-[12px] text-[var(--ink-text-faint)]">
                {data.chapters.length > 0
                  ? `${Math.round((data.published / data.chapters.length) * 100)}% 已完稿`
                  : '—'}
              </span>
            </div>

            <div className="rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4 shadow-2xs space-y-3.5">
              {loading ? (
                <div className="text-[12px] text-[var(--ink-text-faint)] py-4 text-center">
                  加载中…
                </div>
              ) : data.volumeProgress.length === 0 ? (
                <div className="text-[12px] text-[var(--ink-text-faint)] py-6 text-center">
                  暂无分卷，可在正文编辑器新建分卷
                </div>
              ) : (
                <div className="space-y-3">
                  {data.volumeProgress.map((v) => {
                    const pct = v.total > 0 ? Math.round((v.current / v.total) * 100) : 0
                    return (
                      <div key={v.title} className="space-y-1">
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="font-medium text-[var(--ink-text)] truncate max-w-[70%]">
                            {v.title}
                          </span>
                          <span className="text-[var(--ink-text-faint)] tabular-nums">
                            {v.current}/{v.total} 章 · {pct}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-[var(--ink-bg-hover)] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[var(--ink-accent)] transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>

          {/* 创作健康提醒（彻底移除花哨的听诊器与AI假诊断，改为客观连载指标排查） */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[14px] font-semibold text-[var(--ink-text)]">创作健康提醒</h3>
              <span className="text-[12px] text-[var(--ink-text-faint)]">客观连载指标排查</span>
            </div>

            <div className="rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4 shadow-2xs divide-y divide-[var(--ink-border)] text-[12px]">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[var(--ink-text-muted)]">未回收伏笔</span>
                <span
                  className={
                    data.unresolvedForeshadowsCount > 5
                      ? 'text-red-500 font-medium'
                      : 'text-[var(--ink-text)]'
                  }
                >
                  {data.unresolvedForeshadowsCount > 5
                    ? `未回收 ${data.unresolvedForeshadowsCount} 条（建议点检）`
                    : `未回收 ${data.unresolvedForeshadowsCount} 条（节奏平稳）`}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[var(--ink-text-muted)]">更新连贯度</span>
                <span
                  className={
                    data.idleDays > 3 ? 'text-amber-500 font-medium' : 'text-[var(--ink-text)]'
                  }
                >
                  {data.idleDays > 0 ? `已停更 ${data.idleDays} 天` : '今日已更新'}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[var(--ink-text-muted)]">灵感库储备</span>
                <span className="text-[var(--ink-text)]">
                  {data.unusedIdeasCount > 0 ? `${data.unusedIdeasCount} 条未用素材` : '储备充足'}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[var(--ink-text-muted)]">近 7 天日均写作</span>
                <span className="text-[var(--ink-accent)] font-medium tabular-nums">
                  {avgDayWords.toLocaleString()} 字/天
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* 5. 写作目标与完稿预估（燃尽图扩展模块） */}
        <div className="rounded-2xl bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--ink-border)] pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--ink-accent)]" />
              <h2 className="text-base font-bold text-[var(--ink-text)]">写作目标与完稿预估</h2>
            </div>
            <span className="text-xs text-[var(--ink-text-faint)]">自动持久化保存在本地配置库</span>
          </div>

          {/* 表单输入 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="block">
              <span className="text-xs text-[var(--ink-text-muted)] font-medium mb-1.5 block">
                每日目标字数
              </span>
              <input
                type="number"
                min={0}
                value={goalPlan.daily}
                onChange={(e) =>
                  updateGoal({ daily: Math.max(0, parseInt(e.target.value || '0', 10)) })
                }
                className="w-full bg-[var(--ink-bg-panel)] border border-[var(--ink-border)] rounded-xl px-3 py-2 text-xs text-[var(--ink-text)] outline-none focus:border-[var(--ink-accent)]"
              />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--ink-text-muted)] font-medium mb-1.5 block">
                全书目标字数
              </span>
              <input
                type="number"
                min={0}
                value={goalPlan.total}
                onChange={(e) =>
                  updateGoal({ total: Math.max(0, parseInt(e.target.value || '0', 10)) })
                }
                placeholder="例：1000000"
                className="w-full bg-[var(--ink-bg-panel)] border border-[var(--ink-border)] rounded-xl px-3 py-2 text-xs text-[var(--ink-text)] outline-none focus:border-[var(--ink-accent)]"
              />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--ink-text-muted)] font-medium mb-1.5 block">
                完稿截止日
              </span>
              <input
                type="date"
                value={goalPlan.deadline}
                onChange={(e) => updateGoal({ deadline: e.target.value })}
                className="w-full bg-[var(--ink-bg-panel)] border border-[var(--ink-border)] rounded-xl px-3 py-2 text-xs text-[var(--ink-text)] outline-none focus:border-[var(--ink-accent)]"
              />
            </label>
          </div>

          {/* 4 格数据块 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="bg-[var(--ink-bg-panel)] rounded-xl p-3 border border-[var(--ink-border)]">
              <div className="text-[10px] text-[var(--ink-text-faint)]">当前总字数</div>
              <div className="text-base font-bold text-[var(--ink-text)] mt-0.5">
                {data.totalWords.toLocaleString()}
              </div>
            </div>
            <div className="bg-[var(--ink-bg-panel)] rounded-xl p-3 border border-[var(--ink-border)]">
              <div className="text-[10px] text-[var(--ink-text-faint)]">近 7 日日均</div>
              <div className="text-base font-bold text-[var(--ink-accent)] mt-0.5">
                {avgDayWords.toLocaleString()}
              </div>
            </div>
            <div className="bg-[var(--ink-bg-panel)] rounded-xl p-3 border border-[var(--ink-border)]">
              <div className="text-[10px] text-[var(--ink-text-faint)]">距目标还差</div>
              <div className="text-base font-bold text-[var(--ink-text)] mt-0.5">
                {remainingWords.toLocaleString()}
              </div>
            </div>
            <div className="bg-[var(--ink-bg-panel)] rounded-xl p-3 border border-[var(--ink-border)]">
              <div className="text-[10px] text-[var(--ink-text-faint)]">预估完稿</div>
              <div className="text-base font-bold text-emerald-600 mt-0.5">
                {goalPlan.total > 0
                  ? estimatedDate
                    ? estimatedDate.toLocaleDateString()
                    : '—'
                  : '未设目标'}
              </div>
            </div>
          </div>

          {/* 全书目标完成度进度条 */}
          {goalPlan.total > 0 && (
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--ink-text-muted)]">全书完成度</span>
                <span className="text-[var(--ink-text)] font-semibold">{progressPercent}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-[var(--ink-bg-hover)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--ink-accent)] transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* 近 14 天燃尽图 (SVG) */}
          {goalPlan.daily > 0 && burndownData.length > 0 && (
            <div className="rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--ink-text)]">近 14 天燃尽图</span>
                <div className="flex items-center gap-3 text-[11px] text-[var(--ink-text-faint)]">
                  <span className="flex items-center gap-1">
                    <span className="w-3.5 h-0.5 bg-amber-500 inline-block rounded" />
                    目标累计
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3.5 h-0.5 bg-emerald-500 inline-block rounded" />
                    实际累计
                  </span>
                </div>
              </div>

              <div className="w-full h-36 pt-2">
                <svg
                  viewBox="0 0 560 140"
                  className="w-full h-full"
                  role="img"
                  aria-label="近14天码字燃尽图"
                >
                  {[0, 0.5, 1].map((r) => {
                    const y = 120 - r * 100
                    return (
                      <g key={r}>
                        <line
                          x1="44"
                          x2="540"
                          y1={y}
                          y2={y}
                          stroke="currentColor"
                          strokeDasharray="3 3"
                          className="text-[var(--ink-border)]"
                          strokeWidth="0.8"
                        />
                        <text
                          x="38"
                          y={y + 3}
                          textAnchor="end"
                          fontSize="9"
                          className="fill-[var(--ink-text-faint)]"
                        >
                          {Math.round(maxBurndown * r).toLocaleString()}
                        </text>
                      </g>
                    )
                  })}

                  <path
                    d={burndownData
                      .map((p, i) => {
                        const x = 44 + (i / 13) * 496
                        const y = 120 - (p.targetCum / maxBurndown) * 100
                        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
                      })
                      .join(' ')}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="1.8"
                    strokeDasharray="5 4"
                  />

                  <path
                    d={burndownData
                      .map((p, i) => {
                        const x = 44 + (i / 13) * 496
                        const y = 120 - (p.actualCum / maxBurndown) * 100
                        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
                      })
                      .join(' ')}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2.2"
                  />

                  <circle
                    cx={540}
                    cy={120 - (burndownData[13].actualCum / maxBurndown) * 100}
                    r="3.5"
                    fill="#10b981"
                  />
                </svg>
              </div>

              <div className="text-[11px] text-[var(--ink-text-faint)] mt-1">
                今日累计 {burndownData[13].actualCum.toLocaleString()} / 目标{' '}
                {burndownData[13].targetCum.toLocaleString()} 字
                {burndownData[13].actualCum >= burndownData[13].targetCum ? (
                  <span className="text-emerald-600 font-medium ml-1.5">
                    · 超出目标{' '}
                    {(burndownData[13].actualCum - burndownData[13].targetCum).toLocaleString()}{' '}
                    字，手感极佳
                  </span>
                ) : (
                  <span className="text-red-500 font-medium ml-1.5">
                    · 落后目标{' '}
                    {(burndownData[13].targetCum - burndownData[13].actualCum).toLocaleString()}{' '}
                    字，继续加油
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 6. 角色出场分布（热力矩阵扩展模块） */}
        <div className="rounded-2xl bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] p-6 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-[var(--ink-border)] pb-3">
            <div className="flex items-center gap-2">
              <Smile className="w-4 h-4 text-[var(--ink-accent)]" />
              <h2 className="text-base font-bold text-[var(--ink-text)]">角色出场分布</h2>
            </div>
            <span className="text-xs text-[var(--ink-text-faint)]">
              正文扫描统计 · 点击单元格直达对应章节
            </span>
          </div>

          {data.characterHeatmap.length === 0 ? (
            <div className="rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] px-4 py-8 text-center text-xs text-[var(--ink-text-faint)]">
              还没有可统计的出场数据——在角色档案录入角色，并在正文中写下他们的故事，系统会自动扫描统计各章出场频次。
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4 overflow-hidden">
              <div className="max-h-64 overflow-auto">
                <table className="border-collapse text-[10.5px] w-full">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-[var(--ink-bg-panel)] text-left text-[var(--ink-text-faint)] font-medium px-2 py-1.5 whitespace-nowrap">
                        角色 \ 章节
                      </th>
                      {data.chapters.map((ch) => (
                        <th
                          key={ch.id}
                          className="text-[var(--ink-text-faint)] font-normal px-1 py-1.5 align-bottom"
                          style={{ width: 24 }}
                        >
                          <div
                            className="whitespace-nowrap cursor-pointer hover:text-[var(--ink-accent)]"
                            style={{ writingMode: 'vertical-rl' }}
                            title={`${ch.title}（点击直达正文）`}
                            onClick={() => onOpenView('editor')}
                          >
                            {ch.title.length > 8 ? ch.title.slice(0, 8) + '…' : ch.title}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.characterHeatmap.map((item) => (
                      <tr key={item.name} className="border-t border-[var(--ink-border)]">
                        <td className="sticky left-0 z-10 bg-[var(--ink-bg-panel)] text-[var(--ink-text)] font-medium px-2 py-1.5 whitespace-nowrap">
                          {item.name}
                        </td>
                        {data.chapters.map((ch) => {
                          const count = item.counts[ch.id] || 0
                          const heatCls =
                            count === 0
                              ? 'bg-[var(--ink-bg-hover)]'
                              : count < 3
                                ? 'bg-[var(--ink-accent)]/25'
                                : count < 6
                                  ? 'bg-[var(--ink-accent)]/55'
                                  : 'bg-[var(--ink-accent)] text-white'
                          return (
                            <td key={ch.id} className="p-0.5 text-center">
                              <button
                                type="button"
                                onClick={() => onOpenView('editor')}
                                title={`${item.name} 在《${ch.title}》中出场 ${count} 次 · 点击直达编辑`}
                                className={`w-5 h-5 rounded-[3px] flex items-center justify-center text-[9px] ${heatCls} hover:ring-1 hover:ring-[var(--ink-accent)] transition-all cursor-pointer`}
                              >
                                {count > 0 ? count : ''}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-1.5 mt-3 text-[10px] text-[var(--ink-text-faint)]">
                <span>少</span>
                <span className="w-3.5 h-3.5 rounded-[3px] bg-[var(--ink-bg-hover)] inline-block" />
                <span className="w-3.5 h-3.5 rounded-[3px] bg-[var(--ink-accent)]/25 inline-block" />
                <span className="w-3.5 h-3.5 rounded-[3px] bg-[var(--ink-accent)]/55 inline-block" />
                <span className="w-3.5 h-3.5 rounded-[3px] bg-[var(--ink-accent)] inline-block" />
                <span>多</span>
                <span className="ml-3">颜色越深 = 该章出场次数越多 · 点击单元格直达对应章节</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
