import { useEffect, useState, type RefObject } from 'react'
import { Bold, Italic, Wand2 } from 'lucide-react'

interface SelectionToolbarProps {
  /** TipTap 编辑器实例（任意结构，仅在具备 on/off/view 时生效） */
  editor: any
  /** 承载编辑器的可滚动容器（position: relative），用于把选区坐标换算为工具条定位 */
  containerRef: RefObject<HTMLElement | null>
  /** 划词润色：把选中文本发给 AI 副驾驶 */
  onAiPrompt?: (text: string, chapterId?: string) => void
  /** 打开 AI 副驾驶面板 */
  onOpenAssistant?: () => void
  /** 当前章节 id，随润色请求一并上报 */
  activeChapterId?: string
}

interface ToolbarState {
  show: boolean
  top: number
  left: number
}

/**
 * 自绘选区浮动工具条，完全替代 tippy.js 版 BubbleMenu。
 *
 * 为何要替换：@tiptap/react 的 BubbleMenu 基于 tippy.js，会把菜单 <div>
 * 从 React 树内挪到 document.body，导致组件卸载时 React 在 commit 阶段
 * 找不到原父节点而抛 `insertBefore`/`removeChild` 错误 → 整页白屏。
 * 本组件只渲染在 React 树内（容器内部 absolute 定位），不挪动任何 DOM，
 * 因此卸载时干净、不会触发该冲突。
 */
export const SelectionToolbar: React.FC<SelectionToolbarProps> = ({
  editor,
  containerRef,
  onAiPrompt,
  onOpenAssistant,
  activeChapterId,
}) => {
  const [state, setState] = useState<ToolbarState>({ show: false, top: 0, left: 0 })

  useEffect(() => {
    if (
      !editor ||
      !editor.view ||
      typeof editor.on !== 'function' ||
      typeof editor.off !== 'function'
    ) {
      return
    }

    const hide = () => {
      setState((s) => (s.show ? { ...s, show: false } : s))
    }

    const compute = () => {
      const { from, to } = editor.state.selection
      if (from === to) {
        hide()
        return
      }
      const text = editor.state.doc.textBetween(from, to, ' ')
      if (!text.trim()) {
        hide()
        return
      }
      try {
        const start = editor.view.coordsAtPos(from)
        const end = editor.view.coordsAtPos(to)
        const canvas = containerRef.current
        if (!canvas) {
          hide()
          return
        }
        const crect = canvas.getBoundingClientRect()
        // 容器可滚动：absolute 子元素随内容滚动，故用「内容坐标」= 视口偏移 + scrollTop
        const top = start.top - crect.top + canvas.scrollTop - 44
        const left = (start.left + end.left) / 2 - crect.left
        setState({ show: true, top, left })
      } catch {
        // jsdom 无布局信息 / 选区临时不可用，忽略
        hide()
      }
    }

    editor.on('selectionUpdate', compute)
    editor.on('transaction', compute)
    editor.on('blur', hide)
    editor.on('focus', compute)

    return () => {
      editor.off('selectionUpdate', compute)
      editor.off('transaction', compute)
      editor.off('blur', hide)
      editor.off('focus', compute)
    }
  }, [editor, containerRef])

  if (!state.show || !editor) return null

  const aiPolish = () => {
    const { from, to } = editor.state.selection
    const text = editor.state.doc.textBetween(from, to, ' ')
    if (text) {
      onAiPrompt?.(`请润色以下小说段落：\n${text}`, activeChapterId)
      onOpenAssistant?.()
    }
  }

  return (
    <div
      className="absolute z-20 -translate-x-1/2 flex items-center gap-0.5 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] px-1 py-1 shadow-[var(--ink-shadow-lg)]"
      style={{ top: state.top, left: state.left }}
      // 阻止 mousedown 抢占选区，确保点击工具条时选区不丢失
      onMouseDown={(e) => e.preventDefault()}
    >
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`p-1.5 rounded-md hover:bg-[var(--ink-bg-hover)] ${editor.isActive('bold') ? 'text-[var(--ink-accent)]' : ''}`}
        title="加粗"
      >
        <Bold className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`p-1.5 rounded-md hover:bg-[var(--ink-bg-hover)] ${editor.isActive('italic') ? 'text-[var(--ink-accent)]' : ''}`}
        title="斜体"
      >
        <Italic className="w-3.5 h-3.5" />
      </button>
      <div className="w-px h-4 bg-[var(--ink-border)] mx-0.5" />
      <button
        type="button"
        onClick={aiPolish}
        className="px-2 py-1 rounded-md text-[12px] flex items-center gap-1 text-[var(--ink-accent)] hover:bg-[var(--ink-accent-soft)] transition-colors duration-150"
        title="调用 InkPi AI 划词润色"
      >
        <Wand2 className="w-3 h-3" />
        <span>AI 润色</span>
      </button>
    </div>
  )
}

export default SelectionToolbar
