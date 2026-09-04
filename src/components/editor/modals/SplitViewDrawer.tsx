import React, { useState, useMemo } from 'react'
import { Columns2, BookOpen, X } from 'lucide-react'
import type { ChapterRecord, VolumeRecord } from '../../../types'
import { htmlToPlain } from '../../../domain/text'

interface SplitViewDrawerProps {
  currentChapterId: string
  volumes: VolumeRecord[]
  chapters: ChapterRecord[]
  onClose: () => void
  fontSize?: number
  lineHeight?: string | number
  fontStack?: string
  paragraphSpacing?: number
}

export const SplitViewDrawer: React.FC<SplitViewDrawerProps> = ({
  currentChapterId,
  volumes,
  chapters,
  onClose,
  fontSize = 18,
  lineHeight = 2.0,
  fontStack = 'var(--ink-font-serif)',
  paragraphSpacing = 0.25,
}) => {
  // 默认对照上一章，若无上一章则选第一章
  const initialRefChapterId = useMemo(() => {
    const currentIndex = chapters.findIndex((c) => c.id === currentChapterId)
    if (currentIndex > 0) return chapters[currentIndex - 1].id
    if (chapters.length > 1) {
      const other = chapters.find((c) => c.id !== currentChapterId)
      if (other) return other.id
    }
    return chapters[0]?.id || ''
  }, [chapters, currentChapterId])

  const [selectedChapterId, setSelectedChapterId] = useState<string>(initialRefChapterId)

  const activeRefChapter = chapters.find((c) => c.id === selectedChapterId)

  const paragraphs = useMemo(() => {
    if (!activeRefChapter?.content) return []
    const plain = htmlToPlain(activeRefChapter.content)
    return plain.split('\n').filter((l) => l.trim().length > 0)
  }, [activeRefChapter?.content])

  return (
    <div className="flex-1 w-1/2 h-full flex flex-col border-l border-[var(--ink-border)] bg-[var(--ink-bg)] text-[var(--ink-text)] overflow-hidden">
      {/* 顶栏：高度 h-9，严格与左侧写作区分屏指示条 1:1 对称 */}
      <div className="h-9 shrink-0 flex items-center justify-between px-4 border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)]/40 text-[11px]">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Columns2 className="w-3.5 h-3.5 text-[var(--ink-accent)] shrink-0" />
          <span className="font-semibold text-[var(--ink-text)] shrink-0">分屏对照参考台</span>

          {/* 章节快速切换下拉 */}
          <select
            value={selectedChapterId}
            onChange={(e) => setSelectedChapterId(e.target.value)}
            className="ml-1.5 max-w-[200px] px-2 py-0.5 text-[11px] rounded-md bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none focus:border-[var(--ink-accent)] truncate cursor-pointer"
          >
            {volumes.map((vol) => {
              const volChs = chapters.filter((c) => c.volumeId === vol.id)
              if (volChs.length === 0) return null
              return (
                <optgroup key={vol.id} label={vol.title}>
                  {volChs.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.id === currentChapterId ? `当前: ${ch.title}` : ch.title}
                    </option>
                  ))}
                </optgroup>
              )
            })}
          </select>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-[10.5px] text-[var(--ink-text-faint)]">
            {activeRefChapter?.wordCount || 0} 字
          </span>
          <button
            onClick={onClose}
            title="关闭对照分屏"
            className="p-1 rounded-md text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)] transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 对照正文区域：与左侧 100% 对齐的 padding、字号与排版 */}
      <div className="flex-1 overflow-y-auto px-8 py-8 relative selection:bg-[var(--ink-accent)]/20">
        <div className="w-full max-w-[40rem] mx-auto">
          {activeRefChapter ? (
            <>
              <h1
                className="text-[24px] font-medium tracking-tight mb-6 leading-snug text-[var(--ink-text)]"
                style={{ fontFamily: fontStack }}
              >
                {activeRefChapter.title || '无标题'}
              </h1>
              {paragraphs.length > 0 ? (
                <div
                  className="ink-editor"
                  style={
                    {
                      fontSize: `${fontSize}px`,
                      lineHeight,
                      fontFamily: fontStack,
                      '--ink-paragraph-spacing': `${paragraphSpacing * 2.4}em`,
                    } as React.CSSProperties
                  }
                >
                  {paragraphs.map((p, idx) => (
                    <p key={idx} className="indent-8 text-[var(--ink-text)]">
                      {p}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-[var(--ink-text-faint)] italic">（本章暂无内容）</p>
              )}
            </>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-xs text-[var(--ink-text-faint)] gap-2">
              <BookOpen className="w-8 h-8 opacity-30" />
              <span>请在上方选择要对照的历史章节</span>
            </div>
          )}
        </div>
        <span className="sr-only">对照面板仅供阅读与伏笔核验，不会改动原章节</span>
      </div>
    </div>
  )
}
