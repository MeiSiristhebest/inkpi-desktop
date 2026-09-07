import React from 'react'
import { SelectionToolbar } from '../SelectionToolbar'
import { SplitViewDrawer } from '../modals/SplitViewDrawer'
import { ScratchpadDrawer } from '../modals/ScratchpadDrawer'
import { EditorContent } from '@tiptap/react'
import type { EditorModel } from '../hooks/useChapterEditorModel'
import type { ChapterRecord, VolumeRecord } from '../../../types'
import type { EditorBackgroundConfig } from '../modals/BackgroundModal'
import { PRESET_SKINS } from '../modals/BackgroundModal'

interface EditorCanvasProps {
  model: EditorModel
  editor?: any
  canvasRef: React.RefObject<HTMLDivElement | null>
  effectiveZen?: boolean
  effectiveTypewriter?: boolean
  projectId: string
  onAiPrompt?: (text: string, chapterId?: string) => void
  onOpenAssistant?: () => void
  bgConfig?: EditorBackgroundConfig
}

export const EditorCanvas: React.FC<EditorCanvasProps> = ({
  model,
  editor,
  canvasRef,
  effectiveZen,
  effectiveTypewriter = false,
  projectId,
  onAiPrompt,
  onOpenAssistant,
  bgConfig,
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

  // 计算当前背景颜色
  const currentSkin = PRESET_SKINS.find((s) => s.id === bgConfig?.skinId)
  const isDark = bgConfig?.themeMode === 'dark'
  const bgColor = bgConfig?.customBgImage
    ? 'transparent'
    : currentSkin
      ? isDark
        ? currentSkin.darkBg
        : currentSkin.bg
      : undefined

  // 网格线科学对齐系统：每行文字基线严格端坐在网格线上
  const gridType = bgConfig?.gridType || 'none'
  const isDashed = gridType === 'dashed'
  const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'
  const lineHeightNum = Number(lineHeight || 2.0)
  const stepPx = Math.round(fontSize * lineHeightNum)

  // 段落间距也必须是 stepPx 的整数倍，这样多个段落之间不会错位！
  const paragraphSpacingPx = stepPx * (model.paragraphSpacing ? 1 : 0)

  // 稿纸底纹：基于 stepPx 的精准基线
  const gridBackground =
    gridType === 'none'
      ? undefined
      : isDashed
        ? `linear-gradient(90deg, ${gridColor} 6px, transparent 6px) repeat-x 0 ${stepPx}px`
        : `linear-gradient(to bottom, transparent ${stepPx - 1}px, ${gridColor} ${stepPx - 1}px, ${gridColor} ${stepPx}px)`

  const canvasBackgroundStyle: React.CSSProperties = {
    backgroundColor: bgColor,
    backgroundImage: bgConfig?.customBgImage ? `url(${bgConfig.customBgImage})` : undefined,
    backgroundSize: bgConfig?.customBgImage ? 'cover' : undefined,
    backgroundPosition: bgConfig?.customBgImage ? 'center' : undefined,
    backgroundAttachment: bgConfig?.customBgImage ? 'fixed' : undefined,
  }

  // 仅在正文编辑容器内绘制基准格线，确保第一行文字的底沿 100% 对齐第一条线
  const editorAreaGridStyle: React.CSSProperties = {
    backgroundImage: gridType !== 'none' && !bgConfig?.customBgImage ? gridBackground : undefined,
    backgroundSize: isDashed ? `12px ${stepPx}px` : `100% ${stepPx}px`,
    backgroundPosition: `0 0`,
  }

  return (
    <div
      className="flex-1 flex min-h-0 overflow-hidden relative transition-colors duration-300"
      style={canvasBackgroundStyle}
    >
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
          {/* 打字机模式下的垂直视觉对齐指示 */}
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
                  ...editorAreaGridStyle,
                  fontSize: `${fontSize}px`,
                  lineHeight: `${stepPx}px`,
                  fontFamily: fontStack,
                  '--ink-paragraph-spacing': `${paragraphSpacingPx}px`,
                } as React.CSSProperties
              }
            >
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>
      </div>

      {/* 左右分屏对照阅读 */}
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

      {/* 行旁待办与备忘录 */}
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
