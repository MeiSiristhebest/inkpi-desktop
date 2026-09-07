import React, { useState, useRef, useEffect, useCallback } from 'react'
import { X, Feather, SlidersHorizontal, Settings, Bell } from 'lucide-react'
import type { WritingSessionStats } from '../hooks/useWritingSessionStats'
import { formatTime, type WordCountConfig } from '../modals/WordCountPanelModal'
import { MascotFigure } from './MascotFigure'
import { BookCover } from '../../../ui/atoms/BookCover'

interface FloatingWordCountWidgetProps {
  stats: WritingSessionStats
  config: WordCountConfig
  bookTitle?: string
  bookCover?: string
  todayTarget?: number
  onOpenSettings: () => void
  onOpenGoalModal?: () => void
  onClose: () => void
}

export const FloatingWordCountWidget: React.FC<FloatingWordCountWidgetProps> = ({
  stats,
  config,
  bookTitle = '私密作品使用指南',
  bookCover,
  todayTarget = 4600,
  onOpenSettings,
  onOpenGoalModal,
  onClose,
}) => {
  const nodeRef = useRef<HTMLDivElement>(null)
  const posRef = useRef<{ x: number; y: number }>({
    x: Math.max(20, typeof window !== 'undefined' ? window.innerWidth - 380 : 800),
    y: Math.max(40, typeof window !== 'undefined' ? window.innerHeight - 380 : 400),
  })
  const isDraggingRef = useRef(false)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const rafIdRef = useRef<number | null>(null)

  // 气泡操作菜单开关
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // 立即在 DOM 上应用位置变换（避免 React 频繁 re-render 导致拖拽掉帧滞后）
  const updateDomTransform = useCallback((x: number, y: number) => {
    if (nodeRef.current) {
      nodeRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`
    }
  }, [])

  useEffect(() => {
    updateDomTransform(posRef.current.x, posRef.current.y)
  }, [updateDomTransform])

  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    window.addEventListener('click', handleDocClick)
    return () => window.removeEventListener('click', handleDocClick)
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return // 只响应鼠标左键
    isDraggingRef.current = true
    dragOffsetRef.current = {
      x: e.clientX - posRef.current.x,
      y: e.clientY - posRef.current.y,
    }
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return
      const nextX = Math.min(
        Math.max(10, e.clientX - dragOffsetRef.current.x),
        window.innerWidth - 260,
      )
      const nextY = Math.min(
        Math.max(10, e.clientY - dragOffsetRef.current.y),
        window.innerHeight - 150,
      )
      posRef.current = { x: nextX, y: nextY }

      // 使用 requestAnimationFrame 保证与显示器刷新率 100% 同步，丝滑跟手
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          updateDomTransform(posRef.current.x, posRef.current.y)
          rafIdRef.current = null
        })
      }
    }

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false
        document.body.style.userSelect = ''
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current)
          rafIdRef.current = null
        }
        updateDomTransform(posRef.current.x, posRef.current.y)
      }
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
    }
  }, [updateDomTransform])

  const {
    headerType,
    showMascotMotto,
    showSessionWords,
    showSpeed,
    showWritingTime,
    showIdleTime,
    layout,
  } = config

  // 计算今日计划半圆环进度角度
  const percent = Math.min(1, Math.max(0, stats.sessionWords / (todayTarget || 4600)))
  const strokeDashoffset = 220 * (1 - percent)

  const isLayout2 = layout === 'layout2'

  return (
    <div
      ref={nodeRef}
      style={{
        left: 0,
        top: 0,
        transform: `translate3d(${posRef.current.x}px, ${posRef.current.y}px, 0)`,
        willChange: 'transform',
      }}
      className={`fixed z-40 select-none bg-[var(--ink-bg-elevated)]/95 backdrop-blur-xl rounded-2xl shadow-[var(--ink-shadow-lg)] border border-[var(--ink-border)] flex flex-col text-[var(--ink-text)] font-sans antialiased ${
        isLayout2 ? 'w-[350px]' : layout === 'layout1' ? 'w-[260px]' : 'w-[290px]'
      }`}
    >
      {/* 顶部标题栏 + 拖拽手柄 + 操作按钮（精细 Apple 风格） */}
      <div
        onMouseDown={handleMouseDown}
        className="flex items-center justify-between px-4 pt-3.5 pb-2 cursor-move rounded-t-2xl select-none"
      >
        <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink-text)] tracking-tight">
          <div className="w-5 h-5 rounded-md bg-[var(--ink-accent)] text-white flex items-center justify-center shadow-2xs shrink-0">
            <Feather className="w-3 h-3" />
          </div>
          <span>作家助手</span>
        </div>

        <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
          {/* 设置图标与气泡菜单 */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              title="设置"
              className={`p-1.5 rounded-lg text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer ${
                menuOpen ? 'bg-[var(--ink-bg-hover)] text-[var(--ink-accent)]' : ''
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[136px] py-1 rounded-xl bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] shadow-[var(--ink-shadow-lg)] text-[12.5px] overflow-hidden flex flex-col backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => {
                    onOpenSettings()
                    setMenuOpen(false)
                  }}
                  className="px-3.5 py-2 text-left hover:bg-[var(--ink-bg-hover)] text-[var(--ink-text)] transition-colors cursor-pointer flex items-center gap-2 font-normal"
                >
                  <Settings className="w-3.5 h-3.5 text-[var(--ink-text-muted)]" />
                  <span>设置字数面板</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onOpenGoalModal?.()
                    setMenuOpen(false)
                  }}
                  className="px-3.5 py-2 text-left hover:bg-[var(--ink-bg-hover)] text-[var(--ink-text)] transition-colors cursor-pointer flex items-center gap-2 font-normal"
                >
                  <Bell className="w-3.5 h-3.5 text-[var(--ink-text-muted)]" />
                  <span>设置写作提醒</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            title="关闭悬浮"
            className="p-1.5 rounded-lg text-[var(--ink-text-muted)] hover:text-[var(--ink-danger)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── 布局 2：左侧数据纵览 + 右侧头部视觉 ── */}
      {isLayout2 ? (
        <div className="px-5 pb-5 pt-1 flex flex-col">
          {/* 居中标题 */}
          <h3 className="text-[15px] font-semibold text-[var(--ink-text)] tracking-tight text-center mb-3.5 truncate">
            {bookTitle}
          </h3>

          {/* 左右并列内容 */}
          <div className="flex items-center justify-between gap-4">
            {/* 左侧：4项核心数据条目 */}
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

            {/* 右侧：小助占位 / 书籍真实封面 / 计划半圆环 */}
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
        <div className="px-5 pb-5 pt-1 flex flex-col items-center text-center">
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

          {/* 作品标题 */}
          <h3 className="text-[15px] font-semibold text-[var(--ink-text)] tracking-tight mb-1 truncate max-w-full">
            {bookTitle}
          </h3>

          {/* 小标语 */}
          {showMascotMotto && headerType !== 'none' && (
            <p className="text-[11px] text-[var(--ink-text-muted)] mb-3 tracking-normal">
              {stats.isTyping ? '笔耕不辍，行远自迩。' : '小憩片刻，灵感正在酝酿…'}
            </p>
          )}

          {/* 布局 3 */}
          {layout === 'layout3' && (
            <div className="w-full grid grid-cols-2 gap-y-3 gap-x-2 py-2.5 border-t border-[var(--ink-border)]">
              {showSessionWords && (
                <div className="flex flex-col items-center">
                  <span className="text-[10.5px] text-[var(--ink-text-muted)] flex items-center gap-0.5 mb-0.5">
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
                <div className="flex justify-between items-center px-1">
                  <span className="text-[var(--ink-text-muted)]">本次码字</span>
                  <span className="font-semibold tabular-nums text-[var(--ink-text)]">
                    {stats.sessionWords}
                  </span>
                </div>
              )}
              {showSpeed && (
                <div className="flex justify-between items-center px-1">
                  <span className="text-[var(--ink-text-muted)]">码字速率(字/时)</span>
                  <span className="font-semibold tabular-nums text-[var(--ink-text)]">
                    {stats.speedPerHour}
                  </span>
                </div>
              )}
              {showWritingTime && (
                <div className="flex justify-between items-center px-1">
                  <span className="text-[var(--ink-text-muted)]">码字时间</span>
                  <span className="tabular-nums text-[var(--ink-text)]">
                    {formatTime(stats.writingSeconds)}
                  </span>
                </div>
              )}
              {showIdleTime && (
                <div className="flex justify-between items-center px-1">
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
  )
}
