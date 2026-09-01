import { Extension } from '@tiptap/core'
import type { Editor } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

/**
 * 光标后内联的续写建议（Ghost Text）。
 *
 * 以 ProseMirror 的 widget decoration 渲染，不写入文档内容，
 * 因此不会污染 undo 历史、不参与选区、也不被序列化导出。
 *
 * 约定：
 *   - 文档一旦变更，建议自动撤销（避免与正文错位）。
 *   - 建议以 Tab 采纳，由调用方读取并插入（本扩展只负责渲染）。
 */

export interface GhostTextState {
  text: string
  pos: number
}

export const ghostTextPluginKey = new PluginKey<GhostTextState | null>('inkGhostText')

export const GhostText = Extension.create({
  name: 'inkGhostText',

  addProseMirrorPlugins() {
    return [
      new Plugin<GhostTextState | null>({
        key: ghostTextPluginKey,

        state: {
          init: () => null,

          apply(tr, value) {
            // 显式设置 / 清除优先
            const meta = tr.getMeta(ghostTextPluginKey) as GhostTextState | null | undefined
            if (meta !== undefined) return meta

            // 正文一改动就让建议失效，避免建议停在错位的位置
            if (tr.docChanged) return null

            return value
          },
        },

        props: {
          decorations(state) {
            const ghost = ghostTextPluginKey.getState(state)
            if (!ghost || !ghost.text) return null

            // 位置可能因文档被截断而越界，做一次钳制
            const safePos = Math.min(Math.max(ghost.pos, 0), state.doc.content.size)

            return DecorationSet.create(state.doc, [
              Decoration.widget(
                safePos,
                () => {
                  const span = document.createElement('span')
                  span.className = 'ink-ghost-inline'
                  span.setAttribute('contenteditable', 'false')
                  span.setAttribute('data-ink-ghost', 'true')
                  span.textContent = ghost.text
                  return span
                },
                {
                  // 渲染在光标之后
                  side: 1,
                  // 不继承光标处的 marks，否则建议会跟着加粗/斜体
                  marks: [],
                }
              ),
            ])
          },
        },
      }),
    ]
  },
})

/** 在指定位置（默认当前光标）显示续写建议 */
export function setGhostText(editor: Editor, text: string, pos?: number): void {
  const view = editor?.view
  if (!view) return

  const at = pos ?? view.state.selection.to
  view.dispatch(view.state.tr.setMeta(ghostTextPluginKey, { text, pos: at }))
}

/** 撤销当前显示的续写建议 */
export function clearGhostText(editor: Editor): void {
  const view = editor?.view
  if (!view) return

  view.dispatch(view.state.tr.setMeta(ghostTextPluginKey, null))
}
