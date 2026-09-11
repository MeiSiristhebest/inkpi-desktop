import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { CodexEntity } from '../plugins/living-codex/types'
import { GenericAhoCorasick } from '../utils/AhoCorasick'

export interface EntityHighlightOptions {
  entities: CodexEntity[]
  enabled: boolean
  highlightRole: boolean
  highlightSetting: boolean
  onEntityClick?: (entity: CodexEntity) => void
}

export const entityHighlightPluginKey = new PluginKey('entityHighlight')

interface KeywordPayload {
  entity: CodexEntity
  isRole: boolean
}

// 缓存构建好的 AC 自动机实例，避免每次击键都重复解析实体字典
class EntityHighlightEngine {
  private ac = new GenericAhoCorasick<KeywordPayload>()
  private entitySignature = ''

  public sync(
    entities: CodexEntity[],
    options: { highlightRole: boolean; highlightSetting: boolean },
  ) {
    const sig = `${entities.length}_${options.highlightRole}_${options.highlightSetting}_${entities.map((e) => e.updatedAt || 0).join(',')}`
    if (sig === this.entitySignature) return

    this.entitySignature = sig
    const items: Array<{ keyword: string; payload: KeywordPayload }> = []

    for (const ent of entities) {
      const isRole = ent.category === 'character'
      if (isRole && !options.highlightRole) continue
      if (!isRole && !options.highlightSetting) continue

      if (ent.name && ent.name.trim().length >= 2) {
        items.push({
          keyword: ent.name.trim(),
          payload: { entity: ent, isRole },
        })
      }
      if (ent.aliases && Array.isArray(ent.aliases)) {
        for (const alias of ent.aliases) {
          if (alias && alias.trim().length >= 2) {
            items.push({
              keyword: alias.trim(),
              payload: { entity: ent, isRole },
            })
          }
        }
      }
    }

    this.ac.build(items)
  }

  public match(text: string) {
    return this.ac.scan(text)
  }
}

const highlightEngine = new EntityHighlightEngine()

function buildEntityDecorations(
  doc: any,
  entities: CodexEntity[],
  options: { highlightRole: boolean; highlightSetting: boolean },
): DecorationSet {
  if (!entities || entities.length === 0) {
    return DecorationSet.empty
  }

  highlightEngine.sync(entities, options)
  const decorations: Decoration[] = []

  doc.descendants((node: any, pos: number) => {
    if (!node.isText || !node.text) return
    const text = node.text
    // 严格 O(N) 单趟线性扫描，十万字毫无压力
    const matches = highlightEngine.match(text)

    for (const m of matches) {
      const from = pos + m.startIndex
      const to = pos + m.endIndex
      const { entity, isRole } = m.payload

      decorations.push(
        Decoration.inline(from, to, {
          class: `ink-entity-highlight ${isRole ? 'ink-entity-character' : 'ink-entity-setting'}`,
          'data-entity-id': entity.id,
          'data-entity-name': entity.name,
          'data-entity-category': entity.category,
          title: `【${isRole ? '角色' : '设定'}】${entity.name}${entity.summary ? ` · ${entity.summary}` : ''}`,
        }),
      )
    }
  })

  return DecorationSet.create(doc, decorations)
}

export const EntityHighlight = Extension.create<EntityHighlightOptions>({
  name: 'entityHighlight',

  addOptions() {
    return {
      entities: [],
      enabled: true,
      highlightRole: true,
      highlightSetting: true,
    }
  },

  addProseMirrorPlugins() {
    const opts = this.options

    return [
      new Plugin({
        key: entityHighlightPluginKey,
        state: {
          init: (_, { doc }) => {
            if (!opts.enabled) return DecorationSet.empty
            return buildEntityDecorations(doc, opts.entities, opts)
          },
          apply: (tr, oldSet, _oldState, newState) => {
            const meta = tr.getMeta(entityHighlightPluginKey)
            if (meta) {
              if (!meta.enabled) return DecorationSet.empty
              return buildEntityDecorations(newState.doc, meta.entities, meta)
            }
            if (tr.docChanged) {
              if (!opts.enabled) return DecorationSet.empty
              return buildEntityDecorations(newState.doc, opts.entities, opts)
            }
            return oldSet.map(tr.mapping, tr.doc)
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)
          },
          handleClick(_view, _pos, event) {
            const target = event.target as HTMLElement
            if (target && target.classList?.contains('ink-entity-highlight')) {
              const entId = target.getAttribute('data-entity-id')
              if (entId && opts.onEntityClick) {
                const found = opts.entities.find((e) => e.id === entId)
                if (found) {
                  opts.onEntityClick(found)
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
