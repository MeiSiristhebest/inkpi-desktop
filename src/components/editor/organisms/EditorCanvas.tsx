import { EditorContent } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import { SplitViewDrawer } from '../modals/SplitViewDrawer'
import { ScratchpadDrawer } from '../modals/ScratchpadDrawer'
import { SelectionToolbar } from '../SelectionToolbar'
import type { EditorModel } from '../hooks/useChapterEditorModel'
import type { VolumeRecord, ChapterRecord } from '../../../types'

interface EditorCanvasProps {
  model: EditorModel
  editor: Editor | null
  canvasRef: React.RefObject<HTMLDivElement | null>
  effectiveZen: boolean
  effectiveTypewriter?: boolean
  projectId: string
  onAiPrompt?: (text: string, chapterId?: string) => void
  onOpenAssistant?: () => void
}

/** 写作画布（标题 + 选区工具条 + 正文 + 分屏/备忘侧栏）。organisms 层，仅声明式渲染。 */
export const EditorCanvas: React.FC<EditorCanvasProps> = ({
  model,
  editor,
  canvasRef,
  effectiveZen,
  effectiveTypewriter = false,
  projectId,
  onAiPrompt,
  onOpenAssistant,
}) => {
  const {
    activeChapter,
    canvasWidth,
    fontStack,
    fontSize,
    lineHeight,
    showSplitView,
    showScratchpad,
    volumes,
    chapters,
    actions,
  } = model
  return (
    <div className="flex-1 flex min-h-0 overflow-hidden relative">
      <div
        className={`flex-1 flex flex-col h-full overflow-hidden ${
          showSplitView ? 'w-1/2' : 'w-full'
        }`}
      >
        {/* 分屏模式下左侧写作区顶部指示条：与右侧参考区 h-9 严格 1:1 对齐 */}
        {showSplitView && !effectiveZen && (
          <div className="h-9 shrink-0 flex items-center justify-between px-4 border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)]/40 text-[11px] text-[var(--ink-text-muted)]">
            <span className="font-medium text-[var(--ink-text)] truncate">
              当前编辑 · {activeChapter?.title || '无标题'}
            </span>
            <span className="shrink-0 font-mono text-[10.5px]">
              {activeChapter?.wordCount || 0} 字
            </span>
          </div>
        )}

        <div
          ref={canvasRef}
          className={`flex-1 overflow-y-auto relative ${effectiveTypewriter ? 'scroll-smooth' : ''}`}
        >
          {/* 打字机模式下的垂直视觉对齐指示（极度柔和的半透明参考线） */}
          {effectiveTypewriter && (
            <div
              className="pointer-events-none sticky top-[45%] -translate-y-1/2 border-t border-[var(--ink-accent)]/15 z-10 flex items-center justify-end pr-4"
              title="打字机光标聚焦参考线"
            >
              <span className="text-[10px] font-mono text-[var(--ink-accent)]/40 tracking-wider">
                TYPEWRITER FOCUS
              </span>
            </div>
          )}

          <div
            className={`mx-auto transition-all duration-200 ${
              showSplitView ? 'px-8 py-8 w-full max-w-[40rem]' : 'px-10'
            } ${
              canvasWidth === 'full'
                ? 'max-w-none w-full'
                : canvasWidth === 'wide'
                  ? 'max-w-[56rem]'
                  : 'max-w-[46rem]'
            }`}
            style={{
              paddingTop: effectiveTypewriter ? '35vh' : showSplitView ? '2rem' : '3rem',
              paddingBottom: effectiveTypewriter ? '55vh' : showSplitView ? '2rem' : '3rem',
            }}
          >
            {!effectiveZen && (
              <h1
                className={`${
                  showSplitView ? 'text-[24px] mb-6' : 'text-[26px] mb-6'
                } font-medium tracking-tight leading-snug`}
                style={{ fontFamily: fontStack }}
              >
                {activeChapter?.title || '无标题'}
              </h1>
            )}

            {editor && !editor.isDestroyed && (
              <SelectionToolbar
                editor={editor}
                containerRef={canvasRef}
                onAiPrompt={onAiPrompt}
                onOpenAssistant={onOpenAssistant}
                activeChapterId={activeChapter?.id}
              />
            )}

            <div
              className="ink-editor"
              style={
                {
                  fontSize: `${fontSize}px`,
                  lineHeight,
                  fontFamily: fontStack,
                  '--ink-paragraph-spacing': `${(model.paragraphSpacing ?? 0.25) * 2.4}em`,
                } as React.CSSProperties
              }
            >
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>
      </div>

      {/* 左右分屏对照阅读：真实 50/50 双栏排版对等视口 */}
      {showSplitView && !effectiveZen && (
        <SplitViewDrawer
          currentChapterId={activeChapter?.id || ''}
          volumes={volumes as VolumeRecord[]}
          chapters={chapters as ChapterRecord[]}
          onClose={() => actions.setShowSplitView(false)}
          fontSize={fontSize}
          lineHeight={lineHeight}
          fontStack={fontStack}
        />
      )}

      {/* 行旁待办与备忘录（导出自动滤除） */}
      {showScratchpad && !effectiveZen && (
        <ScratchpadDrawer
          projectId={projectId}
          chapterId={activeChapter?.id}
          onClose={() => actions.setShowScratchpad(false)}
        />
      )}
    </div>
  )
}
