import { createBlockId } from './blockIdentity'
import { normalizeHtmlText, normalizeText } from './textNormalizer'
import {
  createTextSourceMap,
  type EditorPosition,
  type SourceMapSegment,
  type TextSourceMap,
} from './sourceMap'

export interface SemanticBlock {
  id: string
  type: string
  text: string
  from: number
  to: number
  editorPosition?: EditorPosition
  metadata?: Record<string, unknown>
}

export interface SemanticDocument {
  documentId: string
  revision: number
  text: string
  blocks: SemanticBlock[]
  sourceMap: TextSourceMap
  representation: 'prosemirror-json' | 'html' | 'text'
}

export interface ProseMirrorNodeLike {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  content?: ProseMirrorNodeLike[]
}

interface MutableBlock {
  type: string
  text: string
  editorFrom: number
  editorTo: number
  existingId?: unknown
  metadata?: Record<string, unknown>
  sourceSegments?: MutableSourceSegment[]
}

interface MutableSourceSegment {
  semanticFrom: number
  semanticTo: number
  editorFrom: number
  editorTo: number
}

const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'listItem',
  'horizontalRule',
])

function nodeSize(node: ProseMirrorNodeLike): number {
  if (typeof node.text === 'string') return normalizeText(node.text).length
  if (!node.content?.length) return 1
  return 2 + node.content.reduce((sum, child) => sum + nodeSize(child), 0)
}

function nodeText(node: ProseMirrorNodeLike): string {
  if (typeof node.text === 'string') return normalizeText(node.text)
  if (node.type === 'hardBreak') return '\n'
  if (!node.content?.length) return ''

  const separator = node.content.some((child) => BLOCK_TYPES.has(child.type || '')) ? '\n' : ''
  return node.content.map((child) => nodeText(child)).join(separator)
}

function collectProseMirrorBlocks(
  node: ProseMirrorNodeLike,
  nodeStart: number,
  blocks: MutableBlock[],
): void {
  if (!node.content?.length) return

  let offset = 0
  for (const child of node.content) {
    const childStart = nodeStart + 1 + offset
    const type = child.type || 'unknown'
    if (BLOCK_TYPES.has(type)) {
      const text = nodeText(child)
      blocks.push({
        type,
        text,
        editorFrom: childStart + 1,
        editorTo: Math.max(childStart + 1, childStart + nodeSize(child) - 1),
        existingId: child.attrs?.id,
        metadata: child.attrs,
      })
    } else {
      collectProseMirrorBlocks(child, childStart, blocks)
    }
    offset += nodeSize(child)
  }
}

function createDocument(
  documentId: string,
  revision: number,
  representation: SemanticDocument['representation'],
  mutableBlocks: MutableBlock[],
): SemanticDocument {
  const blocks: SemanticBlock[] = []
  const segments: SourceMapSegment[] = []
  let text = ''

  mutableBlocks.forEach((block, ordinal) => {
    if (ordinal > 0) text += '\n'
    const from = text.length
    text += block.text
    const to = text.length
    const id = createBlockId(documentId, ordinal, block.type, block.existingId)
    const editorPosition = { from: block.editorFrom, to: block.editorTo, blockId: id }
    blocks.push({
      id,
      type: block.type,
      text: block.text,
      from,
      to,
      editorPosition,
      metadata: block.metadata,
    })
    if (block.sourceSegments?.length) {
      segments.push(
        ...block.sourceSegments.map((segment) => ({
          blockId: id,
          semanticFrom: from + segment.semanticFrom,
          semanticTo: from + segment.semanticTo,
          editorFrom: segment.editorFrom,
          editorTo: segment.editorTo,
        })),
      )
    } else {
      segments.push({
        blockId: id,
        semanticFrom: from,
        semanticTo: to,
        editorFrom: block.editorFrom,
        editorTo: block.editorTo,
      })
    }
  })

  return {
    documentId,
    revision,
    text,
    blocks,
    sourceMap: createTextSourceMap(segments, text.length),
    representation,
  }
}

export function semanticDocumentFromProseMirror(
  documentId: string,
  json: ProseMirrorNodeLike,
  revision = 0,
): SemanticDocument {
  const blocks: MutableBlock[] = []
  collectProseMirrorBlocks(json, -1, blocks)
  return createDocument(documentId, revision, 'prosemirror-json', blocks)
}

const BLOCK_TAGS = /^(?:p|div|h[1-6]|blockquote|pre|li)$/i

function parseTag(token: string): { name: string; closing: boolean; selfClosing: boolean } | null {
  const match = token.match(/^<\s*(\/)?\s*([a-z][\w-]*)[^>]*?(\/)?\s*>$/i)
  if (!match) return null
  return {
    name: match[2].toLowerCase(),
    closing: Boolean(match[1]),
    selfClosing: Boolean(match[3]) || /^br$/i.test(match[2]),
  }
}

export function semanticDocumentFromHtml(
  documentId: string,
  html: string,
  revision = 0,
): SemanticDocument {
  const mutableBlocks: MutableBlock[] = []
  let current: MutableBlock | null = null
  let token: RegExpExecArray | null
  const tokenizer = /<[^>]*>|[^<]+/g

  const flush = (): void => {
    if (!current) return
    mutableBlocks.push(current)
    current = null
  }

  const appendMappedText = (
    block: MutableBlock,
    value: string,
    editorFrom: number,
    editorTo: number,
  ): void => {
    if (!value) return
    const semanticFrom = block.text.length
    block.text += value
    block.sourceSegments ??= []
    block.sourceSegments.push({
      semanticFrom,
      semanticTo: block.text.length,
      editorFrom,
      editorTo,
    })
    block.editorTo = Math.max(block.editorTo, editorTo)
  }

  while ((token = tokenizer.exec(html)) !== null) {
    const raw = token[0]
    const tag = raw.startsWith('<') ? parseTag(raw) : null
    if (!tag) {
      if (raw.startsWith('<!--') || /^<\s*[!?]/.test(raw)) continue
      if (!current && raw.trim() === '') continue
      if (!current) {
        current = { type: 'paragraph', text: '', editorFrom: token.index, editorTo: token.index }
      }
      appendMappedText(current, normalizeHtmlText(raw), token.index, token.index + raw.length)
      continue
    }

    if (tag.name === 'br' && !tag.closing) {
      if (!current) {
        current = { type: 'paragraph', text: '', editorFrom: token.index, editorTo: token.index }
      }
      appendMappedText(current, '\n', token.index, token.index + raw.length)
      continue
    }

    if (BLOCK_TAGS.test(tag.name)) {
      const blockType = tag.name === 'li' ? 'listItem' : tag.name
      if (tag.closing) {
        if (current?.type === blockType || (current?.type === 'blockquote' && tag.name === 'p')) {
          current.editorTo = token.index + raw.length
          if (tag.name !== 'p' || current.type !== 'blockquote') flush()
        }
      } else {
        if (blockType === 'listItem' && current?.type === 'listItem') flush()
        if (current?.type === 'blockquote' && tag.name === 'p' && current.text.length > 0) {
          appendMappedText(current, '\n', token.index, token.index)
        }
        if (!current) {
          current = {
            type: blockType,
            text: '',
            editorFrom: token.index,
            editorTo: token.index + raw.length,
          }
          if (tag.selfClosing) flush()
        }
      }
      continue
    }

    if (tag.selfClosing) {
      if (current) current.editorTo = token.index + raw.length
    }
  }
  flush()

  if (mutableBlocks.length === 0 && html.length > 0) {
    mutableBlocks.push({
      type: 'paragraph',
      text: normalizeHtmlText(html.replace(/<[^>]*>/g, '')),
      editorFrom: 0,
      editorTo: html.length,
    })
  }
  return createDocument(documentId, revision, 'html', mutableBlocks)
}

export function semanticDocumentFromText(
  documentId: string,
  value: string,
  revision = 0,
): SemanticDocument {
  const normalized = normalizeText(value)
  let offset = 0
  const blocks = normalized.split('\n').map((line) => {
    const block = {
      type: 'paragraph',
      text: line,
      editorFrom: offset,
      editorTo: offset + line.length,
    }
    offset += line.length + 1
    return block
  })
  return createDocument(documentId, revision, 'text', blocks)
}
