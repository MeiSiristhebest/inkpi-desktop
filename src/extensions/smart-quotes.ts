import { Extension, textInputRule } from '@tiptap/react'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'

/**
 * 中文智能标点与排版扩展：
 * 1. 当选中有文本时，按下 “ 或 「 或 《 自动包裹选中文本成对；
 * 2. 空白处键入中文前引号 “ 时，自动补齐闭合后引号 ” 并将光标定位到引号中间；
 * 3. 光标处于双引号中间直接按 Backspace 时，成对清除前后引号；
 * 4. 键入 -- 自动转换为标准中文破折号 ——；
 * 5. 键入 ... 或 。。。 自动转换为标准中文省略号 ……。
 */
export const SmartQuotes = Extension.create({
  name: 'smartQuotes',

  addInputRules() {
    return [
      // 连续破折号转标准中文双字线破折号：-- -> ——
      textInputRule({
        find: /--$/,
        replace: '——',
      }),
      // 连续三个半角句点转标准中文省略号：... -> ……
      textInputRule({
        find: /\.{3}$/,
        replace: '……',
      }),
      // 连续三个全角句号转标准中文省略号：。。。 -> ……
      textInputRule({
        find: /。。。$/,
        replace: '……',
      }),
    ]
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('smartQuotes'),
        props: {
          handleTextInput(view, from, to, text) {
            const { state, dispatch } = view
            const { selection } = state

            // 1. 选区包裹逻辑
            if (!selection.empty) {
              if (text === '“' || text === '"') {
                const tr = state.tr.replaceWith(
                  from,
                  to,
                  state.schema.text(`“${state.doc.textBetween(from, to)}”`),
                )
                dispatch(tr)
                return true
              }
              if (text === '「') {
                const tr = state.tr.replaceWith(
                  from,
                  to,
                  state.schema.text(`「${state.doc.textBetween(from, to)}」`),
                )
                dispatch(tr)
                return true
              }
              if (text === '《') {
                const tr = state.tr.replaceWith(
                  from,
                  to,
                  state.schema.text(`《${state.doc.textBetween(from, to)}》`),
                )
                dispatch(tr)
                return true
              }
            }

            // 2. 光标处自动配对补全
            if (text === '“') {
              const tr = state.tr.insertText('“”', from, to)
              // 光标移入引号中央
              tr.setSelection(TextSelection.create(tr.doc, from + 1))
              dispatch(tr)
              return true
            }

            if (text === '「') {
              const tr = state.tr.insertText('「」', from, to)
              tr.setSelection(TextSelection.create(tr.doc, from + 1))
              dispatch(tr)
              return true
            }

            return false
          },

          handleKeyDown(view, event) {
            // 3. 当光标位于成对引号中间时，退格键联动删除两端引号
            if (event.key === 'Backspace') {
              const { state, dispatch } = view
              const { selection } = state
              if (selection.empty && selection.from > 1) {
                const pos = selection.from
                const before = state.doc.textBetween(Math.max(0, pos - 1), pos)
                const after = state.doc.textBetween(pos, Math.min(state.doc.content.size, pos + 1))
                if ((before === '“' && after === '”') || (before === '「' && after === '」')) {
                  const tr = state.tr.delete(pos - 1, pos + 1)
                  dispatch(tr)
                  return true
                }
              }
            }
            return false
          },
        },
      }),
    ]
  },
})
