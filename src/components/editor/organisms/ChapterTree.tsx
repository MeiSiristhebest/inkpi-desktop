import { motion, AnimatePresence } from 'motion/react'
import {
  Search,
  Plus,
  PanelLeftClose,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  FilePlus,
  MoreHorizontal,
  X,
} from 'lucide-react'
import { spring, variants, gesture } from '../../../motion'
import { STATUS_OPTIONS } from '../editorUi'
import type { EditorModel } from '../hooks/useChapterEditorModel'
import { useResizableWidth } from '../../../hooks/useResizableWidth'
import { shortcutHint } from '../../../core/editorShortcuts'
import { Tooltip } from '../../../ui/primitives'

interface ChapterTreeProps {
  model: EditorModel
  isConnected?: boolean
  isReconnecting?: boolean
  onReconnect?: () => void
}

/** 列 1：卷章目录树（可完全折叠，收起后写作区占满）。organisms 层，仅做声明式渲染。 */
export const ChapterTree: React.FC<ChapterTreeProps> = ({ model }) => {
  const { expanded, treeQuery, filteredVolumes, activeChapterId, chapterNumberMap, actions } = model

  // 章节目录宽度支持手柄拖拽微调：默认 250px，最小 190px，最大 440px，记忆持久化
  const { width, isDragging, onMouseDown, resetWidth } = useResizableWidth({
    initialWidth: 250,
    minWidth: 190,
    maxWidth: 440,
    storageKey: 'inkpi-chapter-tree-width',
    direction: 'left',
  })

  return (
    <aside
      style={{ width: `${width}px` }}
      data-testid="editor-chapter-tree"
      className="editor-chapter-tree shrink-0 flex flex-col border-r border-[var(--ink-border)] bg-[var(--ink-bg-sidebar)] relative group"
    >
      {/* 拖拽调宽手柄（右侧边线） */}
      <Tooltip content="拖拽调整目录宽度（双击恢复默认）">
        <div
          onMouseDown={onMouseDown}
          onDoubleClick={resetWidth}
          className={`absolute top-0 right-[-3px] w-[6px] h-full cursor-col-resize z-30 transition-colors ${
            isDragging ? 'bg-[var(--ink-accent)] w-[2px]' : 'bg-transparent'
          }`}
        />
      </Tooltip>
      <div className="h-11 shrink-0 flex items-center justify-between px-3 border-b border-[var(--ink-border)]/50">
        <Tooltip content="单击选择，双击重命名，右键更多操作">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-[22px] h-[22px] rounded-md bg-[var(--ink-accent)] text-white flex items-center justify-center text-[11px] shrink-0 font-medium">
              章
            </div>
            <span className="text-[13px] font-medium truncate">章节目录</span>
          </div>
        </Tooltip>
        <div className="flex items-center gap-0.5">
          <Tooltip content="新建分卷">
            <motion.button
              type="button"
              {...gesture.iconButton}
              transition={spring.snappy}
              onClick={() => actions.newVolume?.()}
              className="p-1.5 rounded-md text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)] transition-colors cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </motion.button>
          </Tooltip>
          <Tooltip content={shortcutHint('在当前卷新建章节', 'newChapter')}>
            <motion.button
              type="button"
              {...gesture.iconButton}
              transition={spring.snappy}
              onClick={() => actions.newChapter()}
              className="p-1.5 rounded-md text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)] transition-colors cursor-pointer"
            >
              <FilePlus className="w-3.5 h-3.5" />
            </motion.button>
          </Tooltip>
          <Tooltip content={shortcutHint('折叠目录', 'toggleChapterTree')}>
            <motion.button
              type="button"
              {...gesture.iconButton}
              transition={spring.snappy}
              onClick={() => actions.setSidebar(false)}
              className="p-1.5 rounded-md text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)] transition-colors cursor-pointer"
            >
              <PanelLeftClose className="w-3.5 h-3.5" />
            </motion.button>
          </Tooltip>
        </div>
      </div>

      {/* 章节搜索 */}
      <div className="px-2 pb-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--ink-text-faint)]" />
          <input
            type="text"
            value={treeQuery}
            onChange={(e) => actions.setTreeQuery(e.target.value)}
            placeholder="搜索章节…"
            className="w-full pl-7 pr-7 py-1.5 rounded-md text-[12px] bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] focus:outline-none focus:border-[var(--ink-accent)]"
          />
          {treeQuery && (
            <Tooltip content="清空搜索">
              <button
                type="button"
                onClick={() => actions.setTreeQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--ink-text-faint)] hover:text-[var(--ink-text)] p-0.5 rounded cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {filteredVolumes.length === 0 && (
          <div className="px-2 py-2 text-[12px] text-[var(--ink-text-faint)]">
            {treeQuery.trim() ? '无匹配章节' : '还没有分卷'}
          </div>
        )}
        {filteredVolumes.map(({ vol, chs, total }) => {
          const isOpen = expanded[vol.id] !== false
          return (
            <div key={vol.id} className="mb-2">
              <div className="group/vol flex items-center justify-between px-2 py-1 rounded hover:bg-[var(--ink-bg-hover)]/60 transition-colors">
                <button
                  type="button"
                  onClick={() => actions.toggleVolume(vol.id)}
                  className="flex items-center gap-1.5 min-w-0 flex-1 text-[11px] font-medium text-[var(--ink-text-faint)] hover:text-[var(--ink-text)] text-left truncate cursor-pointer"
                >
                  {isOpen ? (
                    <ChevronDown className="w-3 h-3 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3 h-3 shrink-0" />
                  )}
                  <span className="truncate">{vol.title}</span>
                </button>
                <div className="flex items-center gap-1 shrink-0 ml-1">
                  <span className="text-[10px] text-[var(--ink-text-faint)] font-normal tabular-nums">
                    {treeQuery.trim() ? `${chs.length}/${total}` : `${total}章`}
                  </span>
                  <Tooltip content={`在「${vol.title}」中新建章节`}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        actions.newChapter(vol.id)
                      }}
                      className="opacity-0 group-hover/vol:opacity-100 p-0.5 rounded text-[var(--ink-text-muted)] hover:text-[var(--ink-accent)] hover:bg-[var(--ink-bg-hover)] transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>
                </div>
              </div>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    {...variants.fadeDown}
                    transition={spring.gentle}
                    className="space-y-px mt-0.5 pl-1"
                  >
                    {chs.map((ch) => {
                      const isSelected = ch.id === activeChapterId
                      const num = chapterNumberMap.get(ch.id)
                      return (
                        <Tooltip
                          key={ch.id}
                          content={`${num ? `正文第 ${num} 章 · ` : ''}状态：${
                            STATUS_OPTIONS.find((s) => s.value === ch.status)?.label ??
                            ch.status ??
                            'draft'
                          }`}
                        >
                          {/* 行不按 motion 实例走：目录是唯一无上限的列表（长篇基线 1000 章），
                              每章一个 motion.div 实测多花 37% 挂载时间，而 listRow 只有 0.5% 按压缩放。 */}
                          <div
                            className={`group w-full flex items-center justify-between gap-1.5 px-2 py-[5px] rounded-md text-[13px] text-left transition-[color,transform] duration-150 active:scale-[0.995] cursor-pointer ${
                              isSelected
                                ? 'bg-[var(--ink-bg-active)] font-medium text-[var(--ink-text)]'
                                : 'text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)]'
                            }`}
                            onClick={() => actions.selectChapter(ch)}
                            onDoubleClick={() => {
                              actions.setRenamingChapter(ch)
                              actions.setRenamingTitle(ch.title)
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              actions.setChapterContextMenu({
                                x: Math.min(e.clientX, window.innerWidth - 200),
                                y: Math.min(e.clientY, window.innerHeight - 280),
                                chapter: ch,
                              })
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{
                                backgroundColor:
                                  STATUS_OPTIONS.find((s) => s.value === ch.status)?.color ||
                                  'var(--ink-text-faint)',
                              }}
                            />
                            {num ? (
                              <span className="text-[10px] text-[var(--ink-text-faint)] tabular-nums shrink-0 font-mono w-4 text-right">
                                {num}
                              </span>
                            ) : null}
                            <span className="truncate flex-1">{ch.title}</span>

                            {/* 字数统计与更多菜单触发器 */}
                            <span className="text-[10.5px] text-[var(--ink-text-faint)] shrink-0 tabular-nums group-hover:hidden">
                              {ch.wordCount}
                            </span>
                            <button
                              type="button"
                              aria-label="更多操作（重命名 / 删除 / 复制）"
                              onClick={(e) => {
                                e.stopPropagation()
                                actions.setChapterContextMenu({
                                  x: Math.min(e.clientX, window.innerWidth - 200),
                                  y: Math.min(e.clientY, window.innerHeight - 280),
                                  chapter: ch,
                                })
                              }}
                              className="hidden group-hover:flex items-center justify-center p-0.5 rounded text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer"
                            >
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </Tooltip>
                      )
                    })}

                    {/* 卷末轻量添加新章节项 */}
                    <Tooltip content={`在「${vol.title}」末尾新建章节`}>
                      <motion.button
                        type="button"
                        {...gesture.listRow}
                        transition={spring.snappy}
                        onClick={() => actions.newChapter(vol.id)}
                        className="w-full flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] text-[var(--ink-text-faint)] hover:text-[var(--ink-accent)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer text-left mt-0.5"
                      >
                        <Plus className="w-3 h-3" />
                        <span>新建章节</span>
                      </motion.button>
                    </Tooltip>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
