import { Edit3, Copy, Check, Hash, FileDown, Trash2, FolderInput } from 'lucide-react'
import { STATUS_OPTIONS } from '../editorUi'
import type { ChapterStatus } from '../../../types'
import type { EditorModel } from '../hooks/useChapterEditorModel'

interface ChapterContextMenuProps {
  model: EditorModel
}

/** 章节右键上下文菜单。organisms 层，仅声明式渲染，命令走 model.actions.* */
export const ChapterContextMenu: React.FC<ChapterContextMenuProps> = ({ model }) => {
  const { chapterContextMenu, copiedChapterId, excludedNumberingIds, volumes, actions } = model
  if (!chapterContextMenu) return null
  const ch = chapterContextMenu.chapter
  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={() => actions.setChapterContextMenu(null)}
        onContextMenu={(e) => {
          e.preventDefault()
          actions.setChapterContextMenu(null)
        }}
      />
      <div
        className="fixed z-50 min-w-[240px] w-auto max-w-[280px] p-1.5 rounded-xl bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] shadow-[var(--ink-shadow)] text-[12.5px] select-none backdrop-blur-md"
        style={{ left: chapterContextMenu.x, top: chapterContextMenu.y }}
      >
        <div className="px-2.5 py-1.5 border-b border-[var(--ink-border)]/60 text-[11px] text-[var(--ink-text-faint)] truncate font-medium">
          {ch.title}
        </div>

        <button
          onClick={() => {
            actions.setChapterContextMenu(null)
            actions.setRenamingChapter(ch)
            actions.setRenamingTitle(ch.title)
          }}
          className="w-full px-2.5 py-1.5 rounded-lg text-left text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
        >
          <Edit3 size={13} className="text-[var(--ink-text-muted)] shrink-0" />
          <span className="whitespace-nowrap">重命名 (F2)</span>
        </button>

        <button
          onClick={() => {
            actions.setChapterContextMenu(null)
            actions.duplicateChapter(ch)
          }}
          className="w-full px-2.5 py-1.5 rounded-lg text-left text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
        >
          <Copy size={13} className="text-[var(--ink-text-muted)] shrink-0" />
          <span className="whitespace-nowrap">复制 / 创建副本</span>
        </button>

        <button
          onClick={() => {
            actions.setChapterContextMenu(null)
            actions.copyChapterText(ch)
          }}
          className="w-full px-2.5 py-1.5 rounded-lg text-left text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
        >
          {copiedChapterId === ch.id ? (
            <Check size={13} className="text-[var(--ink-success)] shrink-0" />
          ) : (
            <Copy size={13} className="text-[var(--ink-text-muted)] shrink-0" />
          )}
          <span className="whitespace-nowrap">
            {copiedChapterId === ch.id ? '已复制纯文本' : '复制正文到剪贴板'}
          </span>
        </button>

        <button
          onClick={() => {
            actions.setChapterContextMenu(null)
            actions.toggleExcludeNumbering(ch.id)
          }}
          className="w-full px-2.5 py-1.5 rounded-lg text-left text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
        >
          <Hash size={13} className="text-[var(--ink-text-muted)] shrink-0" />
          <span className="whitespace-nowrap">
            {excludedNumberingIds.has(ch.id) ? '恢复计入正文序号' : '设为不计入序号(序章/番外)'}
          </span>
        </button>

        <div className="border-t border-[var(--ink-border)]/60 my-1" />

        <div className="px-2.5 py-1 text-[10.5px] text-[var(--ink-text-faint)] font-medium">
          状态标记
        </div>
        <div className="px-1.5 py-0.5 flex items-center gap-1">
          {STATUS_OPTIONS.map((st) => (
            <button
              key={st.value}
              onClick={() => {
                actions.setChapterContextMenu(null)
                actions.setStatus(st.value as ChapterStatus)
              }}
              className={`flex-1 py-1 rounded-md text-[11px] text-center font-medium transition-colors whitespace-nowrap ${
                ch.status === st.value
                  ? 'bg-[var(--ink-accent)] text-white shadow-2xs'
                  : 'bg-[var(--ink-bg-panel)] text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)]'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div className="border-t border-[var(--ink-border)]/60 my-1" />

        <button
          onClick={() => {
            actions.setChapterContextMenu(null)
            actions.exportSingleChapter(ch, 'txt')
          }}
          className="w-full px-2.5 py-1.5 rounded-lg text-left text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
        >
          <FileDown size={13} className="text-[var(--ink-text-muted)] shrink-0" />
          <span className="whitespace-nowrap">导出为 TXT 纯文本</span>
        </button>

        <button
          onClick={() => {
            actions.setChapterContextMenu(null)
            actions.exportSingleChapter(ch, 'md')
          }}
          className="w-full px-2.5 py-1.5 rounded-lg text-left text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
        >
          <FileDown size={13} className="text-[var(--ink-text-muted)] shrink-0" />
          <span className="whitespace-nowrap">导出为 Markdown</span>
        </button>

        {volumes && volumes.length > 1 && (
          <>
            <div className="border-t border-[var(--ink-border)]/60 my-1" />
            <div className="px-2.5 py-1 text-[10.5px] text-[var(--ink-text-faint)] font-medium">
              跨卷移动
            </div>
            {volumes
              .filter((v) => v.id !== ch.volumeId)
              .map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    actions.setChapterContextMenu(null)
                    actions.moveChapterToVolume(ch, v.id)
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg text-left text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
                >
                  <FolderInput size={13} className="text-[var(--ink-accent)] shrink-0" />
                  <span className="truncate">移入「{v.title}」</span>
                </button>
              ))}
          </>
        )}

        <div className="border-t border-[var(--ink-border)]/60 my-1" />

        <button
          onClick={() => {
            actions.setChapterContextMenu(null)
            actions.setDeletingChapter(ch)
          }}
          className="w-full px-2.5 py-1.5 rounded-lg text-left text-rose-500 hover:bg-rose-500/10 flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
        >
          <Trash2 size={13} className="shrink-0" />
          <span className="whitespace-nowrap">删除本章节</span>
        </button>
      </div>
    </>
  )
}
