import React, { useState, useEffect } from 'react'
import { StickyNote, Plus, Trash2, CheckCircle2, Bookmark, Quote } from 'lucide-react'
import { idGenerator } from '../../../adapters/idGenerator'
import { clock } from '../../../adapters/clock'
import { localStorageKeyValueStore } from '../../../adapters/localStorageKeyValueStore'
import type { KeyValueStore } from '../../../ports/keyValueStore'
import type { IdGenerator } from '../../../ports/idGenerator'
import type { Clock } from '../../../ports/clock'
import { Drawer, DrawerHeader } from '../../../ui/molecules/Drawer'

interface ScratchpadDrawerProps {
  projectId: string
  chapterId?: string
  onClose: () => void
  /** KV 层注入（测试时传内存实现，生产默认 localStorageKeyValueStore） */
  kvStore?: KeyValueStore
  idGen?: IdGenerator
  clockPort?: Clock
}

type NoteTag = '伏笔' | '待办' | '设定' | '修辞'

interface ScratchItem {
  id: string
  text: string
  anchorQuote?: string
  tag?: NoteTag
  done: boolean
  createdAt: number
}

const TAG_CONFIG: Record<NoteTag, { bg: string; text: string }> = {
  伏笔: { bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-600 dark:text-amber-400' },
  待办: { bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-600 dark:text-emerald-400' },
  设定: { bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-600 dark:text-blue-400' },
  修辞: { bg: 'bg-purple-500/10 border-purple-500/30', text: 'text-purple-600 dark:text-purple-400' },
}

export const ScratchpadDrawer: React.FC<ScratchpadDrawerProps> = ({
  projectId,
  chapterId,
  onClose,
  kvStore = localStorageKeyValueStore,
  idGen = idGenerator,
  clockPort = clock,
}) => {
  const storageKey = `inkpi-scratchpad-${projectId}-${chapterId || 'global'}`
  const [items, setItems] = useState<ScratchItem[]>([])
  const [inputText, setInputText] = useState('')
  const [anchorText, setAnchorText] = useState('')
  const [selectedTag, setSelectedTag] = useState<NoteTag>('伏笔')
  const [showAnchorInput, setShowAnchorInput] = useState(false)

  useEffect(() => {
    kvStore.get(storageKey).then((saved) => {
      if (saved) {
        try {
          setItems(JSON.parse(saved))
        } catch {
          /* ignore */
        }
      }
    })
  }, [storageKey, kvStore])

  const save = (next: ScratchItem[]) => {
    setItems(next)
    void kvStore.set(storageKey, JSON.stringify(next))
  }

  const handleAdd = () => {
    if (!inputText.trim()) return
    const newItem: ScratchItem = {
      id: idGen.generate('note'),
      text: inputText.trim(),
      anchorQuote: anchorText.trim() || undefined,
      tag: selectedTag,
      done: false,
      createdAt: clockPort.now(),
    }
    save([newItem, ...items])
    setInputText('')
    setAnchorText('')
    setShowAnchorInput(false)
  }

  const toggleDone = (id: string) => {
    save(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)))
  }

  const handleDelete = (id: string) => {
    save(items.filter((i) => i.id !== id))
  }

  return (
    <Drawer widthClass="w-[380px] 2xl:w-[420px]">
      {/* 标题 */}
      <DrawerHeader
        icon={<StickyNote className="w-4 h-4 text-amber-500" />}
        title="行旁待办与备忘录"
        onClose={onClose}
        closeTitle="关闭批注备忘录"
      />

      {/* 说明横条 */}
      <div className="px-3.5 py-2 bg-amber-500/10 border-b border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
        🛡️ 铁律保护：此处备忘待办与正文物理隔离，<strong>导出成书/交稿时 100% 自动滤除</strong>。
      </div>

      {/* 便签创建面板 */}
      <div className="p-3 border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)]/50 space-y-2">
        {/* 标签选择 */}
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-[var(--ink-text-faint)] text-[10px] font-medium mr-1">类型:</span>
          {(['伏笔', '待办', '设定', '修辞'] as NoteTag[]).map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setSelectedTag(tag)}
              className={`px-2 py-0.5 rounded-full border text-[10.5px] font-medium transition-all cursor-pointer ${
                selectedTag === tag
                  ? 'bg-[var(--ink-accent)] text-white border-transparent shadow-2xs'
                  : 'bg-[var(--ink-bg-elevated)] border-[var(--ink-border)] text-[var(--ink-text-muted)] hover:border-[var(--ink-border-strong)]'
              }`}
            >
              {tag}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowAnchorInput((s) => !s)}
            className={`ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] transition-colors cursor-pointer ${
              showAnchorInput || anchorText
                ? 'text-[var(--ink-accent)] bg-[var(--ink-accent)]/10 font-medium'
                : 'text-[var(--ink-text-faint)] hover:text-[var(--ink-text-muted)]'
            }`}
          >
            <Quote className="w-3 h-3" />
            <span>关联段落</span>
          </button>
        </div>

        {/* 关联正文引文输入（可折叠） */}
        {showAnchorInput && (
          <textarea
            value={anchorText}
            onChange={(e) => setAnchorText(e.target.value)}
            placeholder="粘贴关联的正文句子或段落（作为批注锚点）…"
            rows={2}
            className="w-full px-2.5 py-1.5 text-[11px] rounded-lg bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none focus:border-[var(--ink-accent)] italic"
          />
        )}

        {/* 批注内容输入框 */}
        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder={
              selectedTag === '伏笔'
                ? '记录此处埋设的伏笔细节、后续章节揭晓计划…'
                : selectedTag === '设定'
                  ? '记录临时新增的人物、境界、法宝设定…'
                  : '写下修改备忘与行旁灵感…'
            }
            className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none focus:border-[var(--ink-accent)]"
          />
          <button
            onClick={handleAdd}
            className="px-3 py-1.5 rounded-lg bg-[var(--ink-accent)] text-white text-xs font-medium hover:bg-[var(--ink-accent-hover)] transition-colors flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" /> 添加
          </button>
        </div>
      </div>

      {/* 便签列表 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.length === 0 ? (
          <div className="py-14 text-center text-xs text-[var(--ink-text-faint)] space-y-2">
            <Bookmark className="w-8 h-8 mx-auto opacity-30 text-[var(--ink-text-muted)]" />
            <p>本章暂无伏笔备忘与行旁批注</p>
            <p className="text-[11px] opacity-70">
              在上方记录伏笔、待补情节或修辞思路
            </p>
          </div>
        ) : (
          items.map((item) => {
            const tagCfg = item.tag ? TAG_CONFIG[item.tag] : TAG_CONFIG['伏笔']
            return (
              <div
                key={item.id}
                className={`p-3 rounded-xl border text-xs transition-all ${
                  item.done
                    ? 'bg-[var(--ink-bg)]/40 border-[var(--ink-border)] opacity-60'
                    : 'bg-[var(--ink-bg-panel)] border-[var(--ink-border)] shadow-2xs hover:border-[var(--ink-border-strong)]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${tagCfg.bg} ${tagCfg.text}`}
                  >
                    {item.tag || '批注'}
                  </span>
                  <span className="text-[10px] text-[var(--ink-text-faint)]">
                    {new Date(item.createdAt).toLocaleTimeString('zh-CN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {/* 关联正文锚点引文 */}
                {item.anchorQuote && (
                  <div className="border-l-2 border-[var(--ink-accent)]/40 pl-2 my-1.5 text-[11px] text-[var(--ink-text-muted)] italic bg-[var(--ink-bg)]/40 py-1 pr-1.5 rounded-r">
                    “{item.anchorQuote}”
                  </div>
                )}

                <div className="flex items-start gap-2 mt-1">
                  <button
                    onClick={() => toggleDone(item.id)}
                    className="mt-0.5 shrink-0 text-[var(--ink-text-faint)] hover:text-[var(--ink-accent)] cursor-pointer"
                    title={item.done ? '标记为未完成' : '标记为已完成'}
                  >
                    <CheckCircle2
                      className={`w-3.5 h-3.5 ${
                        item.done ? 'text-[var(--ink-success)] fill-[var(--ink-success)]/20' : ''
                      }`}
                    />
                  </button>
                  <span
                    className={`flex-1 break-words leading-relaxed text-[12.5px] ${
                      item.done
                        ? 'line-through text-[var(--ink-text-faint)]'
                        : 'text-[var(--ink-text)]'
                    }`}
                  >
                    {item.text}
                  </span>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="shrink-0 p-1 text-[var(--ink-text-faint)] hover:text-rose-500 rounded hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer"
                    title="删除批注"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* 底部统计栏 */}
      <div className="h-9 shrink-0 px-3.5 border-t border-[var(--ink-border)] bg-[var(--ink-bg-panel)] flex items-center justify-between text-[11px] text-[var(--ink-text-faint)]">
        <span>共 {items.length} 条本章批注与备忘</span>
        <span>
          已完成 {items.filter((i) => i.done).length} / {items.length}
        </span>
      </div>
    </Drawer>
  )
}
