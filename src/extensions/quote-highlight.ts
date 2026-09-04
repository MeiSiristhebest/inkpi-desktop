import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

/**
 * 引用高亮：自动为成对引号包裹的文本添加柔和背景装饰。
 * 支持中文直角引号「」『』与西式弯引号“”‘’。
 * 仅做视觉装饰，不修改文档内容，因此不会影响保存/导出。
 */
const QUOTE_PAIRS = [
  { open: '「', close: '」' },
  { open: '『', close: '』' },
  { open: '“', close: '”' },
  { open: '‘', close: '’' },
]

function findQuoteRanges(text: string): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = []
  for (const { open, close } of QUOTE_PAIRS) {
    let start = 0
    while (true) {
      const a = text.indexOf(open, start)
      if (a === -1) break
      const b = text.indexOf(close, a + open.length)
      if (b === -1) break
      ranges.push({ from: a + open.length, to: b })
      start = b + close.length
    }
  }
  return ranges
}

function buildDecorations(doc: any): DecorationSet {
  const decorations: Decoration[] = []
  doc.descendants((node: any, pos: number) => {
    if (!node.isText || !node.text) return
    const ranges = findQuoteRanges(node.text)
    for (const r of ranges) {
      decorations.push(
        Decoration.inline(pos + r.from, pos + r.to, {
          class: 'ink-quote-highlight',
        }),
      )
    }
  })
  return DecorationSet.create(doc, decorations)
}

export const QuoteHighlight = Extension.create({
  name: 'quoteHighlight',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('quoteHighlight'),
        state: {
          init: (_, { doc }) => buildDecorations(doc),
          apply: (tr, value) => {
            if (!tr.docChanged) return value.map(tr.mapping, tr.doc)
            return buildDecorations(tr.doc)
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)
          },
        },
      }),
    ]
  },
})
