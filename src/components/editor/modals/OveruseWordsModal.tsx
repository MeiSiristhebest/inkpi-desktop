import React, { useMemo } from 'react'
import { X, BarChart3, Search, AlertCircle } from 'lucide-react'
import { Modal } from '../../../ui/molecules/Modal'
import { analyzeWordFrequency, htmlToPlain } from '../../../domain/text'

interface OveruseWordsModalProps {
  content: string
  chapterTitle: string
  onHighlightWord: (word: string) => void
  onClose: () => void
}

export const OveruseWordsModal: React.FC<OveruseWordsModalProps> = ({
  content,
  chapterTitle,
  onHighlightWord,
  onClose,
}) => {
  const plainText = useMemo(() => htmlToPlain(content), [content])
  const analysis = useMemo(() => analyzeWordFrequency(plainText, 20), [plainText])

  return (
    <Modal onClose={onClose} widthClass="max-w-xl">
      {/* 顶部标题 */}
      <div className="px-5 py-3.5 border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[var(--ink-accent)]" />
          <h3 className="text-sm font-semibold text-[var(--ink-text)]">
            高频词与口癖点检 · {chapterTitle}
          </h3>
        </div>
        <button
          onClick={onClose}
          title="关闭"
          className="p-1.5 rounded-lg text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 概览统计 */}
      <div className="px-5 py-2.5 bg-[var(--ink-bg-panel)]/50 border-b border-[var(--ink-border)] flex items-center justify-between text-xs text-[var(--ink-text-muted)]">
        <span>
          有效词汇总数：<strong className="text-[var(--ink-text)]">{analysis.totalTokens}</strong>{' '}
          词
        </span>
        <span>
          独立词汇量：<strong className="text-[var(--ink-text)]">{analysis.uniqueWords}</strong> 词
        </span>
        <span className="text-[11px] text-[var(--ink-text-faint)]">（已过滤通用虚词助词）</span>
      </div>

      {/* 列表区 */}
      <div className="p-4 overflow-y-auto space-y-2 flex-1 bg-[var(--ink-bg)]">
        {analysis.topWords.length === 0 ? (
          <div className="py-12 text-center text-xs text-[var(--ink-text-muted)] flex flex-col items-center gap-2">
            <AlertCircle className="w-6 h-6 text-[var(--ink-text-faint)]" />
            <span>本章文本字数过少，暂无明显的高频词汇数据</span>
          </div>
        ) : (
          analysis.topWords.map((item, idx) => {
            const isHighWarning = item.count >= 8
            return (
              <div
                key={item.word}
                onClick={() => {
                  onHighlightWord(item.word)
                  onClose()
                }}
                title="点击在正文中高亮并查找该词"
                className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-4 text-xs cursor-pointer transition-all ${
                  isHighWarning
                    ? 'bg-amber-500/5 border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/10'
                    : 'bg-[var(--ink-bg-elevated)] border-[var(--ink-border)] hover:border-[var(--ink-accent)] hover:shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-5 text-center text-[11px] text-[var(--ink-text-faint)] font-mono">
                    #{idx + 1}
                  </span>
                  <span className="font-semibold text-sm text-[var(--ink-text)] truncate">
                    {item.word}
                  </span>
                  {isHighWarning && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-medium">
                      高频口癖预警
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] text-[var(--ink-text-muted)]">
                    占比 {item.percentage}%
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[var(--ink-accent-soft)] text-[var(--ink-accent)] font-semibold font-mono text-xs">
                    {item.count} 次
                  </span>
                  <span className="p-1 text-[var(--ink-text-faint)] hover:text-[var(--ink-text)]">
                    <Search className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* 底部引导 */}
      <div className="px-5 py-3 border-t border-[var(--ink-border)] bg-[var(--ink-bg-panel)] flex items-center justify-between text-xs text-[var(--ink-text-muted)]">
        <span>💡 提示：点击任意词汇将立即打开正文查找并高亮所有匹配处</span>
        <button
          onClick={onClose}
          className="px-3.5 py-1.5 rounded-xl bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] hover:bg-[var(--ink-bg-hover)] text-xs font-medium text-[var(--ink-text)] transition-colors shadow-2xs"
        >
          完成
        </button>
      </div>
    </Modal>
  )
}
