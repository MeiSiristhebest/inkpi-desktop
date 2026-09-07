import React, { useState } from 'react'
import { X, Feather, SlidersHorizontal } from 'lucide-react'
import type { WritingSessionStats } from '../hooks/useWritingSessionStats'
import type { RandomSource } from '../../../ports/randomSource'
import { randomSource } from '../../../adapters/randomSource'
import { MascotFigure } from '../organisms/MascotFigure'
import { BookCover } from '../../../ui/atoms/BookCover'

export type HeaderType = 'mascot' | 'cover' | 'plan' | 'none'
export type LayoutType = 'layout1' | 'layout2' | 'layout3'

export interface WordCountPanelProps {
  onClose: () => void
  bookTitle?: string
  bookCover?: string
  todayTarget?: number
  stats: WritingSessionStats
  randomPort?: RandomSource
  onPinAsWidget?: () => void
  onOpenGoalModal?: () => void
}

// 格式化秒数为 hh:mm:ss
export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

export interface WordCountConfig {
  headerType: HeaderType
  showMascotMotto: boolean
  showSessionWords: boolean
  showSpeed: boolean
  showWritingTime: boolean
  showIdleTime: boolean
  layout: LayoutType
}

export const WordCountPanelModal: React.FC<
  WordCountPanelProps & {
    config?: WordCountConfig
    onConfigChange?: (cfg: WordCountConfig) => void
  }
> = ({
  onClose,
  bookTitle = '私密作品使用指南',
  bookCover,
  todayTarget = 4600,
  stats,
  randomPort = randomSource,
  onPinAsWidget,
  onOpenGoalModal,
  config: externalConfig,
  onConfigChange,
}) => {
  // 头部内容选择
  const [headerType, setHeaderType] = useState<HeaderType>(externalConfig?.headerType ?? 'mascot')

  // 展示元素复选框
  const [showMascotMotto, setShowMascotMotto] = useState<boolean>(
    externalConfig?.showMascotMotto ?? true,
  )
  const [showSessionWords, setShowSessionWords] = useState<boolean>(
    externalConfig?.showSessionWords ?? true,
  )
  const [showSpeed, setShowSpeed] = useState<boolean>(externalConfig?.showSpeed ?? true)
  const [showWritingTime, setShowWritingTime] = useState<boolean>(
    externalConfig?.showWritingTime ?? true,
  )
  const [showIdleTime, setShowIdleTime] = useState<boolean>(externalConfig?.showIdleTime ?? true)

  // 排版布局选择
  const [layout, setLayout] = useState<LayoutType>(externalConfig?.layout ?? 'layout2')

  // 小标语随性语录
  const mottos = [
    '灵感在笔尖流淌，世界在眼前诞生。',
    '笔耕不辍，行远自迩，日拱一卒无有尽。',
    '码字是一场与自己的深刻对话。',
    '每一段文字，都是岁月赠予的印记。',
  ]
  const [motto] = useState<string>(() => mottos[Math.floor(randomPort.next() * mottos.length)])

  const updateConfig = (patch: Partial<WordCountConfig>) => {
    const next: WordCountConfig = {
      headerType,
      showMascotMotto,
      showSessionWords,
      showSpeed,
      showWritingTime,
      showIdleTime,
      layout,
      ...patch,
    }
    if (patch.headerType !== undefined) setHeaderType(patch.headerType)
    if (patch.showMascotMotto !== undefined) setShowMascotMotto(patch.showMascotMotto)
    if (patch.showSessionWords !== undefined) setShowSessionWords(patch.showSessionWords)
    if (patch.showSpeed !== undefined) setShowSpeed(patch.showSpeed)
    if (patch.showWritingTime !== undefined) setShowWritingTime(patch.showWritingTime)
    if (patch.showIdleTime !== undefined) setShowIdleTime(patch.showIdleTime)
    if (patch.layout !== undefined) setLayout(patch.layout)
    onConfigChange?.(next)
  }

  // 计算今日计划半圆环进度角度
  const percent = Math.min(1, Math.max(0, stats.sessionWords / (todayTarget || 4600)))
  const strokeDashoffset = 220 * (1 - percent)

  const isLayout2 = layout === 'layout2'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-4xl bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] rounded-2xl shadow-[var(--ink-shadow-lg)] flex flex-col max-h-[90vh] overflow-hidden text-[var(--ink-text)] font-sans">
        {/* 弹窗头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--ink-border)]">
          <h2 className="text-[16px] font-bold text-[var(--ink-text)] tracking-tight">字数面板</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer"
            title="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 左右分栏内容区 */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-y-auto">
          {/* 左侧：配置控制面板 */}
          <div className="w-full md:w-[320px] p-6 border-b md:border-b-0 md:border-r border-[var(--ink-border)] flex flex-col gap-6 shrink-0 bg-[var(--ink-bg-panel)]">
            {/* 1. 头部内容 */}
            <div className="space-y-2.5">
              <label className="text-[13px] font-semibold text-[var(--ink-text)] block">
                头部内容
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => updateConfig({ headerType: 'mascot' })}
                  className={`py-2 px-3 rounded-lg text-[13px] font-medium border transition-all cursor-pointer ${
                    headerType === 'mascot'
                      ? 'border-[var(--ink-accent)] bg-[var(--ink-accent-soft)] text-[var(--ink-accent)] font-semibold shadow-xs'
                      : 'border-[var(--ink-border)] bg-[var(--ink-bg-card)] text-[var(--ink-text)] hover:border-[var(--ink-border-strong)]'
                  }`}
                >
                  小助码字
                </button>
                <button
                  type="button"
                  onClick={() => updateConfig({ headerType: 'cover' })}
                  className={`py-2 px-3 rounded-lg text-[13px] font-medium border transition-all cursor-pointer ${
                    headerType === 'cover'
                      ? 'border-[var(--ink-accent)] bg-[var(--ink-accent-soft)] text-[var(--ink-accent)] font-semibold shadow-xs'
                      : 'border-[var(--ink-border)] bg-[var(--ink-bg-card)] text-[var(--ink-text)] hover:border-[var(--ink-border-strong)]'
                  }`}
                >
                  作品书封
                </button>
                <button
                  type="button"
                  onClick={() => updateConfig({ headerType: 'plan' })}
                  className={`py-2 px-3 rounded-lg text-[13px] font-medium border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    headerType === 'plan'
                      ? 'border-[var(--ink-accent)] bg-[var(--ink-accent-soft)] text-[var(--ink-accent)] font-semibold shadow-xs'
                      : 'border-[var(--ink-border)] bg-[var(--ink-bg-card)] text-[var(--ink-text)] hover:border-[var(--ink-border-strong)]'
                  }`}
                >
                  <span>今日计划</span>
                  <SlidersHorizontal
                    className="w-3.5 h-3.5 opacity-70 hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenGoalModal?.()
                    }}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => updateConfig({ headerType: 'none' })}
                  className={`py-2 px-3 rounded-lg text-[13px] font-medium border transition-all cursor-pointer ${
                    headerType === 'none'
                      ? 'border-[var(--ink-accent)] bg-[var(--ink-accent-soft)] text-[var(--ink-accent)] font-semibold shadow-xs'
                      : 'border-[var(--ink-border)] bg-[var(--ink-bg-card)] text-[var(--ink-text)] hover:border-[var(--ink-border-strong)]'
                  }`}
                >
                  无
                </button>
              </div>
            </div>

            {/* 2. 展示元素 */}
            <div className="space-y-2.5">
              <label className="text-[13px] font-semibold text-[var(--ink-text)] block">
                展示元素
              </label>
              <div className="grid grid-cols-2 gap-y-2.5 gap-x-2">
                <label className="flex items-center gap-2 text-[13px] text-[var(--ink-text)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showMascotMotto}
                    onChange={(e) => updateConfig({ showMascotMotto: e.target.checked })}
                    className="w-4 h-4 rounded text-[var(--ink-accent)] border-[var(--ink-border)] accent-[var(--ink-accent)] cursor-pointer"
                  />
                  <span>小标语</span>
                </label>

                <label className="flex items-center gap-2 text-[13px] text-[var(--ink-text)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showSessionWords}
                    onChange={(e) => updateConfig({ showSessionWords: e.target.checked })}
                    className="w-4 h-4 rounded text-[var(--ink-accent)] border-[var(--ink-border)] accent-[var(--ink-accent)] cursor-pointer"
                  />
                  <span>本次码字</span>
                </label>

                <label className="flex items-center gap-2 text-[13px] text-[var(--ink-text)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showSpeed}
                    onChange={(e) => updateConfig({ showSpeed: e.target.checked })}
                    className="w-4 h-4 rounded text-[var(--ink-accent)] border-[var(--ink-border)] accent-[var(--ink-accent)] cursor-pointer"
                  />
                  <span>码字速率</span>
                </label>

                <label className="flex items-center gap-2 text-[13px] text-[var(--ink-text)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showWritingTime}
                    onChange={(e) => updateConfig({ showWritingTime: e.target.checked })}
                    className="w-4 h-4 rounded text-[var(--ink-accent)] border-[var(--ink-border)] accent-[var(--ink-accent)] cursor-pointer"
                  />
                  <span>码字时间</span>
                </label>

                <label className="flex items-center gap-2 text-[13px] text-[var(--ink-text)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showIdleTime}
                    onChange={(e) => updateConfig({ showIdleTime: e.target.checked })}
                    className="w-4 h-4 rounded text-[var(--ink-accent)] border-[var(--ink-border)] accent-[var(--ink-accent)] cursor-pointer"
                  />
                  <span>空闲时间</span>
                </label>
              </div>
            </div>

            {/* 3. 排版布局 */}
            <div className="space-y-2.5">
              <label className="text-[13px] font-semibold text-[var(--ink-text)] block">
                排版布局
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => updateConfig({ layout: 'layout1' })}
                  className={`py-2 px-3 rounded-lg text-[13px] font-medium border transition-all cursor-pointer ${
                    layout === 'layout1'
                      ? 'border-[var(--ink-accent)] bg-[var(--ink-accent-soft)] text-[var(--ink-accent)] font-semibold shadow-xs'
                      : 'border-[var(--ink-border)] bg-[var(--ink-bg-card)] text-[var(--ink-text)] hover:border-[var(--ink-border-strong)]'
                  }`}
                >
                  布局1
                </button>
                <button
                  type="button"
                  onClick={() => updateConfig({ layout: 'layout2' })}
                  className={`py-2 px-3 rounded-lg text-[13px] font-medium border transition-all cursor-pointer ${
                    layout === 'layout2'
                      ? 'border-[var(--ink-accent)] bg-[var(--ink-accent-soft)] text-[var(--ink-accent)] font-semibold shadow-xs'
                      : 'border-[var(--ink-border)] bg-[var(--ink-bg-card)] text-[var(--ink-text)] hover:border-[var(--ink-border-strong)]'
                  }`}
                >
                  布局2
                </button>
                <button
                  type="button"
                  onClick={() => updateConfig({ layout: 'layout3' })}
                  className={`py-2 px-3 rounded-lg text-[13px] font-medium border transition-all cursor-pointer ${
                    layout === 'layout3'
                      ? 'border-[var(--ink-accent)] bg-[var(--ink-accent-soft)] text-[var(--ink-accent)] font-semibold shadow-xs'
                      : 'border-[var(--ink-border)] bg-[var(--ink-bg-card)] text-[var(--ink-text)] hover:border-[var(--ink-border-strong)]'
                  }`}
                >
                  布局3
                </button>
              </div>
            </div>
          </div>

          {/* 右侧：实时卡片预览区 */}
          <div className="flex-1 p-6 md:p-10 flex items-center justify-center bg-[var(--ink-bg-panel)] overflow-y-auto">
            {/* 居中卡片 */}
            <div
              className={`max-w-full bg-[var(--ink-bg-elevated)] rounded-2xl shadow-[var(--ink-shadow-lg)] border border-[var(--ink-border)] p-6 flex flex-col transition-all font-sans antialiased ${
                isLayout2
                  ? 'w-[350px]'
                  : layout === 'layout1'
                    ? 'w-[260px] text-center items-center'
                    : 'w-[300px] text-center items-center'
              }`}
            >
              {/* 头部：Logo与品牌标 */}
              <div className="w-full flex items-center justify-start gap-1.5 text-xs font-semibold text-[var(--ink-text)] mb-3">
                <div className="w-5 h-5 rounded-md bg-[var(--ink-accent)] text-white flex items-center justify-center shadow-2xs">
                  <Feather className="w-3 h-3" />
                </div>
                <span className="tracking-tight">作家助手</span>
              </div>

              {/* ── 布局 2：左数右图排版 ── */}
              {isLayout2 ? (
                <div className="w-full flex flex-col">
                  <h3 className="text-[15px] font-semibold text-[var(--ink-text)] tracking-tight text-center mb-3 truncate">
                    {bookTitle}
                  </h3>

                  <div className="flex items-center justify-between gap-4">
                    {/* 左侧4项数据 */}
                    <div className="flex-1 flex flex-col gap-2.5 text-[12px]">
                      {showSessionWords && (
                        <div className="flex items-center justify-between">
                          <span className="text-[var(--ink-text-muted)] flex items-center gap-1">
                            本次码字
                            <span className="inline-flex items-center justify-center w-3 h-3 text-[8.5px] rounded-full border border-[var(--ink-border-strong)] text-[var(--ink-text-faint)]">
                              i
                            </span>
                          </span>
                          <span className="font-semibold text-[var(--ink-text)] tabular-nums text-[13px]">
                            {stats.sessionWords.toLocaleString()}
                          </span>
                        </div>
                      )}

                      {showSpeed && (
                        <div className="flex items-center justify-between">
                          <span className="text-[var(--ink-text-muted)]">码字速率(字/时)</span>
                          <span className="font-semibold text-[var(--ink-text)] tabular-nums text-[13px]">
                            {stats.speedPerHour.toLocaleString()}
                          </span>
                        </div>
                      )}

                      {showWritingTime && (
                        <div className="flex items-center justify-between">
                          <span className="text-[var(--ink-text-muted)]">码字时间</span>
                          <span className="font-medium text-[var(--ink-text)] tabular-nums text-[12.5px]">
                            {formatTime(stats.writingSeconds)}
                          </span>
                        </div>
                      )}

                      {showIdleTime && (
                        <div className="flex items-center justify-between">
                          <span className="text-[var(--ink-text-muted)]">空闲时间</span>
                          <span className="font-medium text-[var(--ink-text)] tabular-nums text-[12.5px]">
                            {formatTime(stats.idleSeconds)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 右侧插图/书封/仪表盘 */}
                    {headerType === 'mascot' && (
                      <div className="shrink-0 w-24 h-24 flex items-center justify-center">
                        <MascotFigure className="w-full h-full" />
                      </div>
                    )}

                    {headerType === 'cover' && (
                      <div className="shrink-0 w-[68px] h-[92px] rounded-xl overflow-hidden shadow-sm border border-[var(--ink-border)]">
                        <BookCover title={bookTitle} cover={bookCover} />
                      </div>
                    )}

                    {headerType === 'plan' && (
                      <div className="shrink-0 w-28 h-20 relative flex flex-col items-center justify-center">
                        <svg viewBox="0 0 200 120" className="w-full h-full">
                          <path
                            d="M 30 100 A 70 70 0 0 1 170 100"
                            fill="none"
                            stroke="var(--ink-border)"
                            strokeWidth="16"
                            strokeLinecap="round"
                          />
                          <path
                            d="M 30 100 A 70 70 0 0 1 170 100"
                            fill="none"
                            stroke="var(--ink-accent)"
                            strokeWidth="16"
                            strokeLinecap="round"
                            strokeDasharray="220"
                            strokeDashoffset={strokeDashoffset}
                            className="transition-all duration-500"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
                          <span className="text-[9px] text-[var(--ink-text-faint)]">今日计划</span>
                          <span className="text-[11px] font-bold text-[var(--ink-accent)] tabular-nums">
                            {stats.sessionWords}/{todayTarget}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* ── 布局 3 与 布局 1 ── */
                <div className="w-full flex flex-col items-center">
                  {headerType === 'mascot' && (
                    <div className="mb-3">
                      <MascotFigure className="w-24 h-24" />
                    </div>
                  )}

                  {headerType === 'cover' && (
                    <div className="mb-3 w-[72px] h-[96px] rounded-xl overflow-hidden shadow-sm border border-[var(--ink-border)]">
                      <BookCover title={bookTitle} cover={bookCover} />
                    </div>
                  )}

                  {headerType === 'plan' && (
                    <div className="mb-3 relative w-36 h-22 flex flex-col items-center justify-center">
                      <svg viewBox="0 0 200 120" className="w-full h-full">
                        <path
                          d="M 30 100 A 70 70 0 0 1 170 100"
                          fill="none"
                          stroke="var(--ink-border)"
                          strokeWidth="14"
                          strokeLinecap="round"
                        />
                        <path
                          d="M 30 100 A 70 70 0 0 1 170 100"
                          fill="none"
                          stroke="var(--ink-accent)"
                          strokeWidth="14"
                          strokeLinecap="round"
                          strokeDasharray="220"
                          strokeDashoffset={strokeDashoffset}
                          className="transition-all duration-500"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
                        <span className="text-[10px] text-[var(--ink-text-faint)] font-medium">
                          今日计划
                        </span>
                        <span className="text-xs font-bold text-[var(--ink-accent)] tabular-nums">
                          {stats.sessionWords}
                          <span className="text-[var(--ink-text-muted)] text-[10px] font-normal">
                            /{todayTarget.toLocaleString()}
                          </span>
                        </span>
                      </div>
                    </div>
                  )}

                  <h3 className="text-[15px] font-semibold text-[var(--ink-text)] tracking-tight mb-1 truncate max-w-full">
                    {bookTitle}
                  </h3>

                  {showMascotMotto && headerType !== 'none' && (
                    <p className="text-[11px] text-[var(--ink-text-muted)] mb-3 tracking-normal">
                      {motto}
                    </p>
                  )}

                  {/* 布局 3 */}
                  {layout === 'layout3' && (
                    <div className="w-full grid grid-cols-2 gap-y-3 gap-x-2 py-2.5 border-t border-[var(--ink-border)]">
                      {showSessionWords && (
                        <div className="flex flex-col items-center">
                          <span className="text-[10.5px] text-[var(--ink-text-muted)] flex items-center gap-1 mb-0.5">
                            本次码字
                            <span className="inline-flex items-center justify-center w-2.5 h-2.5 text-[8px] rounded-full border border-[var(--ink-border-strong)] text-[var(--ink-text-faint)]">
                              i
                            </span>
                          </span>
                          <span className="text-lg font-bold text-[var(--ink-text)] tabular-nums tracking-tight">
                            {stats.sessionWords.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {showSpeed && (
                        <div className="flex flex-col items-center">
                          <span className="text-[10.5px] text-[var(--ink-text-muted)] mb-0.5">
                            码字速率(字/时)
                          </span>
                          <span className="text-lg font-bold text-[var(--ink-text)] tabular-nums tracking-tight">
                            {stats.speedPerHour.toLocaleString()}
                          </span>
                        </div>
                      )}
                      {showWritingTime && (
                        <div className="flex flex-col items-center">
                          <span className="text-[10.5px] text-[var(--ink-text-muted)] mb-0.5">
                            码字时间
                          </span>
                          <span className="text-[12px] font-medium text-[var(--ink-text)] tabular-nums">
                            {formatTime(stats.writingSeconds)}
                          </span>
                        </div>
                      )}
                      {showIdleTime && (
                        <div className="flex flex-col items-center">
                          <span className="text-[10.5px] text-[var(--ink-text-muted)] mb-0.5">
                            空闲时间
                          </span>
                          <span className="text-[12px] font-medium text-[var(--ink-text)] tabular-nums">
                            {formatTime(stats.idleSeconds)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 布局 1 */}
                  {layout === 'layout1' && (
                    <div className="w-full flex flex-col gap-1.5 py-2 border-t border-[var(--ink-border)] text-[12px]">
                      {showSessionWords && (
                        <div className="flex items-center justify-between px-2">
                          <span className="text-[var(--ink-text-muted)]">本次码字</span>
                          <span className="font-semibold tabular-nums text-[var(--ink-text)]">
                            {stats.sessionWords}
                          </span>
                        </div>
                      )}
                      {showSpeed && (
                        <div className="flex items-center justify-between px-2">
                          <span className="text-[var(--ink-text-muted)]">码字速率(字/时)</span>
                          <span className="font-semibold text-[var(--ink-accent)] tabular-nums">
                            {stats.speedPerHour}
                          </span>
                        </div>
                      )}
                      {showWritingTime && (
                        <div className="flex items-center justify-between px-2">
                          <span className="text-[var(--ink-text-muted)]">码字时间</span>
                          <span className="tabular-nums text-[var(--ink-text)]">
                            {formatTime(stats.writingSeconds)}
                          </span>
                        </div>
                      )}
                      {showIdleTime && (
                        <div className="flex items-center justify-between px-2">
                          <span className="text-[var(--ink-text-muted)]">空闲时间</span>
                          <span className="tabular-nums text-[var(--ink-text)]">
                            {formatTime(stats.idleSeconds)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 弹窗底部操作条 */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-[var(--ink-border)] bg-[var(--ink-bg-panel)]">
          <div>
            {onPinAsWidget && (
              <button
                type="button"
                onClick={() => {
                  onPinAsWidget()
                  onClose()
                }}
                className="px-4 py-2 rounded-xl text-[13px] font-medium text-[var(--ink-accent)] bg-[var(--ink-accent-soft)] hover:opacity-90 transition-colors cursor-pointer"
              >
                悬浮在写作窗口
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-xl text-[13px] font-semibold bg-[var(--ink-accent)] hover:bg-[var(--ink-accent-hover)] text-white shadow-xs hover:shadow transition-all cursor-pointer"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  )
}
