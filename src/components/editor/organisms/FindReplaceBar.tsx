import React, { useState } from 'react'
import { ArrowUp, ArrowDown, X, BookOpen, Replace, FileText } from 'lucide-react'
import { IconButton } from '../../../ui/atoms/IconButton'
import type { EditorModel } from '../hooks/useChapterEditorModel'

interface FindReplaceBarProps {
  model: EditorModel
  editorRef: React.RefObject<any>
}

/** 统一搜索中枢：本章即时查找替换 + 全书跨章节深度检索一体化。organisms 层，仅声明式渲染。 */
export const FindReplaceBar: React.FC<FindReplaceBarProps> = ({ model, editorRef }) => {
  const {
    actions,
    findText,
    replaceText,
    matchPositions,
    activeMatch,
    globalQuery,
    globalResults,
  } = model

  const [scope, setScope] = useState<'chapter' | 'book'>('chapter')
  const [showReplace, setShowReplace] = useState(true)

  const handleNextMatch = () => {
    const ed = editorRef.current
    if (!ed || ed.isDestroyed || matchPositions.length === 0) return
    const next = (activeMatch + 1) % matchPositions.length
    actions.setActiveMatch(next)
    const m = matchPositions[next]
    ed.commands.setTextSelection({ from: m.from, to: m.to })
    ed.commands.scrollIntoView()
  }

  const handlePrevMatch = () => {
    const ed = editorRef.current
    if (!ed || ed.isDestroyed || matchPositions.length === 0) return
    const next = (activeMatch - 1 + matchPositions.length) % matchPositions.length
    actions.setActiveMatch(next)
    const m = matchPositions[next]
    ed.commands.setTextSelection({ from: m.from, to: m.to })
    ed.commands.scrollIntoView()
  }

  const handleReplaceSingle = () => {
    const ed = editorRef.current
    if (!ed || ed.isDestroyed || matchPositions.length === 0) return
    const m = matchPositions[activeMatch]
    if (!m) return
    ed.commands.setTextSelection({ from: m.from, to: m.to })
    ed.commands.insertContent(replaceText)
    actions.handleEditorUpdate()
  }

  return (
    <div className="shrink-0 flex flex-col border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)] shadow-xs relative z-30 select-none">
      {/* 搜索控制条 */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* 范围选择分段控制器 */}
        <div className="flex items-center p-0.5 rounded-lg bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] shrink-0">
          <button
            type="button"
            onClick={() => setScope('chapter')}
            className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
              scope === 'chapter'
                ? 'bg-[var(--ink-accent)] text-white shadow-2xs'
                : 'text-[var(--ink-text-muted)] hover:text-[var(--ink-text)]'
            }`}
          >
            本章检索
          </button>
          <button
            type="button"
            onClick={() => {
              setScope('book')
              if (findText && !globalQuery) {
                actions.setGlobalQuery(findText)
                actions.runGlobalSearch()
              }
            }}
            className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
              scope === 'book'
                ? 'bg-[var(--ink-accent)] text-white shadow-2xs'
                : 'text-[var(--ink-text-muted)] hover:text-[var(--ink-text)]'
            }`}
          >
            全书检索
          </button>
        </div>

        {scope === 'chapter' ? (
          <>
            {/* 本章检索输入框组 */}
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <input
                type="text"
                value={findText}
                onChange={(e) => actions.setFindText(e.target.value)}
                placeholder="检索（文档内全文）"
                className="min-w-0 flex-1 px-2.5 py-1 rounded-md text-[12px] bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none focus:border-[var(--ink-accent)] placeholder:text-[var(--ink-text-faint)]"
              />

              {showReplace && (
                <input
                  type="text"
                  value={replaceText}
                  onChange={(e) => actions.setReplaceText(e.target.value)}
                  placeholder="替换为（可选）"
                  className="min-w-0 flex-1 px-2.5 py-1 rounded-md text-[12px] bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none focus:border-[var(--ink-accent)] placeholder:text-[var(--ink-text-faint)]"
                />
              )}
            </div>

            {/* 匹配计数与前后跳转 */}
            <div className="flex items-center gap-1 text-[11px] text-[var(--ink-text-faint)] shrink-0">
              <span className="tabular-nums min-w-[56px] text-center font-mono">
                {findText
                  ? `${matchPositions.length ? activeMatch + 1 : 0} / ${matchPositions.length || 0}`
                  : '—'}
              </span>

              <IconButton
                onClick={handlePrevMatch}
                disabled={matchPositions.length === 0}
                title="上一项"
                className="p-1 rounded-md hover:bg-[var(--ink-bg-hover)] disabled:opacity-30 cursor-pointer"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </IconButton>
              <IconButton
                onClick={handleNextMatch}
                disabled={matchPositions.length === 0}
                title="下一项"
                className="p-1 rounded-md hover:bg-[var(--ink-bg-hover)] disabled:opacity-30 cursor-pointer"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </IconButton>
            </div>

            {/* 替换按钮 */}
            {showReplace ? (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleReplaceSingle}
                  disabled={matchPositions.length === 0}
                  className="px-2 py-1 rounded-md text-[11.5px] border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] disabled:opacity-40 transition-colors cursor-pointer"
                >
                  替换单处
                </button>
                <button
                  type="button"
                  onClick={() => actions.executeReplace()}
                  disabled={!findText}
                  className="px-2.5 py-1 rounded-md text-[11.5px] bg-[var(--ink-accent)] text-white hover:bg-[var(--ink-accent-hover)] disabled:opacity-40 transition-colors cursor-pointer shadow-2xs font-medium"
                >
                  全部替换
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowReplace(true)}
                className="px-2 py-1 rounded-md text-[11px] text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Replace className="w-3 h-3" />
                <span>替换</span>
              </button>
            )}
          </>
        ) : (
          /* 全书检索模式输入组 */
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="relative flex-1 min-w-0">
              <BookOpen className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-accent)]" />
              <input
                type="text"
                autoFocus
                value={globalQuery}
                onChange={(e) => {
                  actions.setGlobalQuery(e.target.value)
                  if (e.target.value.trim().length >= 2) {
                    actions.runGlobalSearch()
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') actions.runGlobalSearch()
                }}
                placeholder="跨全书所有分卷与章节全文检索…"
                className="w-full pl-8 pr-3 py-1 rounded-md text-[12px] bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none focus:border-[var(--ink-accent)]"
              />
            </div>
            <button
              type="button"
              onClick={() => actions.runGlobalSearch()}
              className="px-3 py-1 rounded-md text-[12px] bg-[var(--ink-accent)] text-white hover:bg-[var(--ink-accent-hover)] transition-colors cursor-pointer font-medium"
            >
              检索全书
            </button>
          </div>
        )}

        <IconButton
          onClick={() => actions.setShowFindReplace(false)}
          title="关闭"
          className="cursor-pointer ml-1"
        >
          <X className="w-3.5 h-3.5" />
        </IconButton>
      </div>

      {/* 全书检索命中结果面板（就地直接呈现，无需弹出孤立 Modal 破坏视线） */}
      {scope === 'book' && globalQuery.trim() && (
        <div className="max-h-72 overflow-y-auto border-t border-[var(--ink-border)] bg-[var(--ink-bg)] p-2 space-y-1">
          <div className="px-2 py-1 text-[11px] text-[var(--ink-text-faint)] flex items-center justify-between font-medium">
            <span>检索结果：{globalResults.length} 个章节包含命中项</span>
            <span>回车再次刷新</span>
          </div>

          {globalResults.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--ink-text-faint)]">
              全书中未找到与 “{globalQuery}” 匹配的内容
            </div>
          ) : (
            globalResults.map((r) => (
              <button
                key={r.chapterId}
                type="button"
                onClick={() => {
                  actions.jumpToChapterFromSearch(r)
                  actions.setFindText(globalQuery)
                  setScope('chapter')
                }}
                className="w-full text-left p-2.5 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] hover:border-[var(--ink-accent)] hover:shadow-2xs transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-[var(--ink-text)] group-hover:text-[var(--ink-accent)] flex items-center gap-1.5 truncate">
                    <FileText className="w-3.5 h-3.5 text-[var(--ink-text-muted)]" />
                    {r.title}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--ink-accent)]/10 text-[var(--ink-accent)] font-mono shrink-0">
                    {r.count} 处命中
                  </span>
                </div>
                <div className="text-[11.5px] text-[var(--ink-text-muted)] truncate leading-relaxed">
                  …{r.snippet}…
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
