import React, { useState, useMemo } from 'react'
import { ShieldAlert, CheckCircle2, AlertTriangle, X, Replace } from 'lucide-react'
import { Modal } from '../../../ui/molecules/Modal'

import { DEFAULT_SENSITIVE_WORDS } from '../../../config/sensitiveWords'

interface SensitiveModalProps {
  content: string
  onApply: (newContent: string) => void
  onClose: () => void
}

export const SensitiveModal: React.FC<SensitiveModalProps> = ({ content, onApply, onClose }) => {
  const [customWords, setCustomWords] = useState<string>('')
  const [replacements, setReplacements] = useState<Record<string, string>>({})

  const allWords = useMemo(() => {
    return [
      ...DEFAULT_SENSITIVE_WORDS,
      ...customWords
        .split(/[,，\s\n]+/)
        .map((w) => w.trim())
        .filter(Boolean),
    ]
  }, [customWords])

  const hits = useMemo(() => {
    const list: { word: string; count: number }[] = []
    for (const w of allWords) {
      if (!w) continue
      const regex = new RegExp(w, 'g')
      const matches = content.match(regex)
      if (matches && matches.length > 0) {
        list.push({ word: w, count: matches.length })
      }
    }
    return list
  }, [content, allWords])

  const handleReplaceOne = (word: string) => {
    const rep = replacements[word] || '**'
    const regex = new RegExp(word, 'g')
    const updated = content.replace(regex, rep)
    onApply(updated)
  }

  const handleReplaceAll = () => {
    let updated = content
    for (const h of hits) {
      const rep = replacements[h.word] || '**'
      const regex = new RegExp(h.word, 'g')
      updated = updated.replace(regex, rep)
    }
    onApply(updated)
    onClose()
  }

  return (
    <Modal onClose={onClose} widthClass="max-w-lg">
      {/* 标题栏 */}
      <div className="px-5 py-3.5 border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-500" />
          <h3 className="text-sm font-semibold text-[var(--ink-text)]">本章敏感词即时检测</h3>
        </div>
        <button
          onClick={onClose}
          title="关闭"
          className="p-1.5 rounded-lg text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 overflow-y-auto space-y-4 flex-1 bg-[var(--ink-bg)]">
        <div>
          <label className="text-xs font-medium text-[var(--ink-text-muted)] block mb-1.5">
            自定义补充敏感词（逗号或换行分隔）：
          </label>
          <textarea
            value={customWords}
            onChange={(e) => setCustomWords(e.target.value)}
            placeholder="如特定平台避讳词、人名..."
            rows={2}
            className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] text-[var(--ink-text)] placeholder-[var(--ink-text-faint)] focus:outline-none focus:border-[var(--ink-accent)] transition-colors resize-none"
          />
        </div>

        <div>
          <h4 className="text-xs font-medium text-[var(--ink-text-muted)] mb-2">
            扫描结果（共发现 {hits.reduce((acc, cur) => acc + cur.count, 0)} 处命中）：
          </h4>
          {hits.length === 0 ? (
            <div className="py-8 px-4 text-center rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex flex-col items-center gap-2">
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
              <span className="font-medium">本章正文未发现常见违禁敏感词，符合规范 ✓</span>
            </div>
          ) : (
            <div className="space-y-2">
              {hits.map((h) => (
                <div
                  key={h.word}
                  className="p-3 rounded-xl bg-[var(--ink-bg-elevated)] border border-rose-500/20 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span className="font-semibold text-rose-600 dark:text-rose-400 truncate">
                      {h.word}
                    </span>
                    <span className="text-[11px] text-[var(--ink-text-faint)] shrink-0">
                      出现 {h.count} 次
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="text"
                      placeholder="替换为 (默认**)"
                      value={replacements[h.word] || ''}
                      onChange={(e) =>
                        setReplacements((prev) => ({ ...prev, [h.word]: e.target.value }))
                      }
                      className="w-24 px-2 py-1 text-xs rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg)] text-[var(--ink-text)] focus:outline-none focus:border-[var(--ink-accent)]"
                    />
                    <button
                      onClick={() => handleReplaceOne(h.word)}
                      className="px-2.5 py-1 rounded-lg bg-[var(--ink-bg-hover)] hover:bg-[var(--ink-bg-active)] text-[var(--ink-text)] transition-colors flex items-center gap-1 text-[11px]"
                    >
                      <Replace className="w-3 h-3" />
                      替换
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {hits.length > 0 && (
        <div className="px-5 py-3 border-t border-[var(--ink-border)] bg-[var(--ink-bg-panel)] flex items-center justify-between">
          <span className="text-[11px] text-[var(--ink-text-muted)]">
            点击一键替换后更新正文并存盘
          </span>
          <button
            onClick={handleReplaceAll}
            className="px-4 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
          >
            一键替换全部
          </button>
        </div>
      )}
    </Modal>
  )
}
