import React, { useState } from 'react'
import { Bold, Underline } from 'lucide-react'
import { Modal } from '../../../ui/molecules/Modal'
import type { EditorModel } from '../hooks/useChapterEditorModel'
import type { FontKind } from '../../../core/settings'

interface FontFormatModalProps {
  onClose: () => void
  model: EditorModel
  editor?: any
}

const FONTS: { id: FontKind; label: string }[] = [
  { id: 'sans', label: '汉仪旗黑 / 黑体' },
  { id: 'serif', label: '思源宋体 / 宋体' },
  { id: 'wenkai', label: '霞鹜文楷 / 文楷' },
  { id: 'kaiti', label: '经典楷体' },
  { id: 'fangsong', label: '经典仿宋' },
  { id: 'mono', label: '等宽字体 (代码/剧本)' },
]

export const FontFormatModal: React.FC<FontFormatModalProps> = ({ onClose, model, editor }) => {
  const [tab, setTab] = useState<'chapter' | 'assistant'>('chapter')

  const currentFont = (model.fontFamily || 'wenkai') as FontKind
  const currentFontSize = model.fontSize || 18
  const currentLineHeight = parseFloat(String(model.lineHeight || '2.0'))
  const canvasWidth = model.canvasWidth || 'narrow'

  // 段间空行与首行缩进（由设置中心驱动）
  const [paragraphSpacingEnabled, setParagraphSpacingEnabled] = useState(
    (model.paragraphSpacing ?? 0.25) > 0,
  )
  const [indentEnabled, setIndentEnabled] = useState(true)

  const isBold = typeof editor?.isActive === 'function' ? editor.isActive('bold') : false
  const isUnderline = typeof editor?.isActive === 'function' ? editor.isActive('underline') : false

  return (
    <Modal
      onClose={onClose}
      widthClass="max-w-[340px]"
      overlayClassName="bg-black/25 backdrop-blur-2xs"
      panelClassName="bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] rounded-2xl shadow-2xl p-5 text-[var(--ink-text)] font-sans select-none flex flex-col gap-4"
    >
      {/* 顶部 Tab：章节内容 / 辅助窗口 */}
      <div className="flex items-center gap-6 border-b border-[var(--ink-border)] pb-2.5">
        <button
          type="button"
          onClick={() => setTab('chapter')}
          className={`text-[14px] font-semibold transition-colors cursor-pointer relative pb-1 ${
            tab === 'chapter'
              ? 'text-[var(--ink-text)]'
              : 'text-[var(--ink-text-muted)] hover:text-[var(--ink-text)]'
          }`}
        >
          <span>章节内容</span>
          {tab === 'chapter' && (
            <div className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-full bg-[var(--ink-accent)]" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setTab('assistant')}
          className={`text-[14px] font-semibold transition-colors cursor-pointer relative pb-1 ${
            tab === 'assistant'
              ? 'text-[var(--ink-text)]'
              : 'text-[var(--ink-text-muted)] hover:text-[var(--ink-text)]'
          }`}
        >
          <span>辅助窗口</span>
          {tab === 'assistant' && (
            <div className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-full bg-[var(--ink-accent)]" />
          )}
        </button>
      </div>

      {tab === 'chapter' ? (
        <div className="flex flex-col gap-4">
          {/* 1. 字体选择 + 粗体 + 下划线 */}
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-[var(--ink-text-muted)] w-10 shrink-0">字体</span>
            <select
              value={currentFont}
              onChange={(e) => model.updateSettings?.({ fontFamily: e.target.value as FontKind })}
              className="flex-1 px-3 py-1.5 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-card)] text-[var(--ink-text)] text-xs focus:outline-none focus:border-[var(--ink-accent)] cursor-pointer"
            >
              {FONTS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>

            {/* 加粗 (Bold) */}
            <button
              type="button"
              onClick={() => {
                if (editor && !editor.isDestroyed && editor.chain) {
                  editor.chain().focus().toggleBold().run()
                }
              }}
              className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                isBold
                  ? 'bg-[var(--ink-bg-active)] border-[var(--ink-accent)] text-[var(--ink-accent)] font-bold'
                  : 'border-[var(--ink-border)] bg-[var(--ink-bg-card)] text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)]'
              }`}
              title="加粗"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>

            {/* 下划线 (Underline) */}
            <button
              type="button"
              onClick={() => {
                if (editor && !editor.isDestroyed && editor.chain) {
                  editor.chain().focus().toggleUnderline?.().run()
                }
              }}
              className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                isUnderline
                  ? 'bg-[var(--ink-bg-active)] border-[var(--ink-accent)] text-[var(--ink-accent)]'
                  : 'border-[var(--ink-border)] bg-[var(--ink-bg-card)] text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)]'
              }`}
              title="下划线"
            >
              <Underline className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 2. 字号滑块 */}
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-[var(--ink-text-muted)] w-10 shrink-0">字号</span>
            <div className="flex-1 flex items-center gap-2">
              <input
                type="range"
                min={12}
                max={30}
                step={1}
                value={currentFontSize}
                onChange={(e) => model.updateSettings?.({ fontSize: Number(e.target.value) })}
                className="flex-1 accent-[var(--ink-accent)] cursor-pointer h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg"
              />
              <span className="text-[11.5px] font-mono tabular-nums text-[var(--ink-text-muted)] w-8 text-right">
                {currentFontSize}px
              </span>
            </div>
          </div>

          {/* 3. 行高滑块 */}
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-[var(--ink-text-muted)] w-10 shrink-0">行高</span>
            <div className="flex-1 flex items-center gap-2">
              <input
                type="range"
                min={1.2}
                max={3.0}
                step={0.1}
                value={currentLineHeight}
                onChange={(e) => model.updateSettings?.({ lineHeight: e.target.value })}
                className="flex-1 accent-[var(--ink-accent)] cursor-pointer h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg"
              />
              <span className="text-[11.5px] font-mono tabular-nums text-[var(--ink-text-muted)] w-8 text-right">
                {currentLineHeight.toFixed(1)}
              </span>
            </div>
          </div>

          {/* 4. 行宽滑块 / 选项 */}
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-[var(--ink-text-muted)] w-10 shrink-0">行宽</span>
            <div className="flex-1 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => model.actions.setCanvasWidth('narrow')}
                className={`flex-1 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                  canvasWidth === 'narrow'
                    ? 'border-[var(--ink-accent)] bg-[var(--ink-accent-soft)] text-[var(--ink-accent)]'
                    : 'border-[var(--ink-border)] bg-[var(--ink-bg-card)] text-[var(--ink-text-muted)]'
                }`}
              >
                限宽
              </button>
              <button
                type="button"
                onClick={() => model.actions.setCanvasWidth('wide')}
                className={`flex-1 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                  canvasWidth === 'wide'
                    ? 'border-[var(--ink-accent)] bg-[var(--ink-accent-soft)] text-[var(--ink-accent)]'
                    : 'border-[var(--ink-border)] bg-[var(--ink-bg-card)] text-[var(--ink-text-muted)]'
                }`}
              >
                较宽
              </button>
              <button
                type="button"
                onClick={() => model.actions.setCanvasWidth('full')}
                className={`flex-1 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                  canvasWidth === 'full'
                    ? 'border-[var(--ink-accent)] bg-[var(--ink-accent-soft)] text-[var(--ink-accent)]'
                    : 'border-[var(--ink-border)] bg-[var(--ink-bg-card)] text-[var(--ink-text-muted)]'
                }`}
              >
                铺满
              </button>
            </div>
          </div>

          {/* 5. 段间空行与首行缩进勾选项 */}
          <div className="pt-2 border-t border-[var(--ink-border)]/60 flex items-center justify-between text-xs text-[var(--ink-text)]">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={paragraphSpacingEnabled}
                onChange={(e) => {
                  const checked = e.target.checked
                  setParagraphSpacingEnabled(checked)
                  model.updateSettings?.({ paragraphSpacing: checked ? 0.25 : 0 })
                }}
                className="w-4 h-4 rounded text-[var(--ink-accent)] border-[var(--ink-border)] accent-[var(--ink-accent)] cursor-pointer"
              />
              <span>段间空行</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={indentEnabled}
                onChange={(e) => {
                  const checked = e.target.checked
                  setIndentEnabled(checked)
                  if (checked) {
                    model.actions.autoFormat()
                  }
                }}
                className="w-4 h-4 rounded text-[var(--ink-accent)] border-[var(--ink-border)] accent-[var(--ink-accent)] cursor-pointer"
              />
              <span>首行缩进 (正规排版)</span>
            </label>
          </div>
        </div>
      ) : (
        /* 辅助窗口设置（侧边栏、大纲字号等） */
        <div className="py-4 text-center text-xs text-[var(--ink-text-muted)] space-y-2">
          <p>辅助侧栏（大纲/便签/分卷目录）已自动继承系统界面字体与最佳紧凑间距。</p>
        </div>
      )}
    </Modal>
  )
}
