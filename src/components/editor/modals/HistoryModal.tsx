import React, { useState, useEffect, useMemo } from 'react'
import { History, RotateCcw, X, Clock, GitCompare, Bookmark, Plus, Check, Info } from 'lucide-react'
import { Modal } from '../../../ui/molecules/Modal'
import { diffWordsWithSpace } from 'diff'
import { htmlToPlain } from '../../../domain/text'
import type { ChapterRecord } from '../../../types'
import { idGenerator } from '../../../adapters/idGenerator'
import { clock } from '../../../adapters/clock'
import { localStorageKeyValueStore } from '../../../adapters/localStorageKeyValueStore'
import type { KeyValueStore } from '../../../ports/keyValueStore'
import type { IdGenerator } from '../../../ports/idGenerator'
import type { Clock as ClockPort } from '../../../ports/clock'

interface HistoryModalProps {
  chapter: ChapterRecord
  onRestore: (content: string) => void
  onClose: () => void
  /** KV 层注入（测试时传内存实现，生产默认 localStorageKeyValueStore） */
  kvStore?: KeyValueStore
  idGen?: IdGenerator
  clockPort?: ClockPort
}

export interface VersionSnapshot {
  id?: string
  name?: string
  timestamp: number
  wordCount: number
  content: string
  kind?: 'auto' | 'milestone'
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  chapter,
  onRestore,
  onClose,
  kvStore = localStorageKeyValueStore,
  idGen = idGenerator,
  clockPort = clock,
}) => {
  const [snapshots, setSnapshots] = useState<VersionSnapshot[]>([])
  const [activeDiffIndex, setActiveDiffIndex] = useState<number | null>(0)
  const [newSnapshotName, setNewSnapshotName] = useState('')
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  const storageKey = `chapter-history-${chapter.id}`

  useEffect(() => {
    kvStore.get(storageKey).then((saved) => {
      if (saved) {
        try {
          setSnapshots(JSON.parse(saved))
        } catch {
          /* ignore */
        }
      } else {
        const initial: VersionSnapshot = {
          id: 'init',
          name: '初始版本',
          timestamp: chapter.updatedAt || clockPort.now(),
          wordCount: chapter.wordCount,
          content: chapter.content,
          kind: 'milestone',
        }
        setSnapshots([initial])
      }
    })
  }, [
    chapter.id,
    chapter.updatedAt,
    chapter.wordCount,
    chapter.content,
    storageKey,
    kvStore,
    clockPort,
  ])

  const saveSnapshots = (updated: VersionSnapshot[]) => {
    setSnapshots(updated)
    void kvStore.set(storageKey, JSON.stringify(updated))
  }

  const handleCreateSnapshot = () => {
    const name =
      newSnapshotName.trim() ||
      `里程碑定稿 ${new Date(clockPort.now()).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    const snap: VersionSnapshot = {
      id: idGen.generate('snap'),
      name,
      timestamp: clockPort.now(),
      wordCount: chapter.wordCount,
      content: chapter.content,
      kind: 'milestone',
    }
    const next = [snap, ...snapshots]
    saveSnapshots(next)
    setNewSnapshotName('')
    setIsCreatingSnapshot(false)
    setActiveDiffIndex(0)
  }

  const handleRevert = (snap: VersionSnapshot) => {
    onRestore(snap.content)
    setRestoringId(snap.id || 'current')
    setTimeout(() => {
      onClose()
    }, 400)
  }

  // 行业通用真实 Diff 计算：对比选中的历史快照与当前最新正文
  const diffResult = useMemo(() => {
    if (activeDiffIndex === null || !snapshots[activeDiffIndex]) return null
    const historyPlain = htmlToPlain(snapshots[activeDiffIndex].content)
    const currentPlain = htmlToPlain(chapter.content)
    return diffWordsWithSpace(historyPlain, currentPlain)
  }, [activeDiffIndex, snapshots, chapter.content])

  const activeSnap = activeDiffIndex !== null ? snapshots[activeDiffIndex] : null

  return (
    <Modal onClose={onClose} widthClass="max-w-4xl">
      {/* 标题栏 */}
      <div className="px-5 py-3.5 border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-[var(--ink-accent)]" />
          <h3 className="text-sm font-semibold text-[var(--ink-text)]">
            版本时光机与差异比对 · {chapter.title}
          </h3>
        </div>
        <button
          onClick={onClose}
          title="关闭"
          className="p-1.5 rounded-lg text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] hover:text-[var(--ink-text)] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 机制说明与操作条 */}
      <div className="px-5 py-2.5 bg-[var(--ink-bg-panel)]/40 border-b border-[var(--ink-border)] flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-[var(--ink-text-muted)]">
          <Info className="w-3.5 h-3.5 text-[var(--ink-accent)] shrink-0" />
          <span className="text-[11.5px]">
            自动检查点在持续写作间隙生成；支持随时封存带备注的「里程碑定稿」，安全可逆。
          </span>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          {isCreatingSnapshot ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newSnapshotName}
                onChange={(e) => setNewSnapshotName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateSnapshot()}
                placeholder="里程碑名称（如：第一卷重写稿）"
                autoFocus
                className="w-52 px-2.5 py-1 text-xs bg-[var(--ink-bg-card)] border border-[var(--ink-border)] rounded-lg focus:outline-none focus:border-[var(--ink-accent)]"
              />
              <button
                onClick={handleCreateSnapshot}
                className="px-2.5 py-1 rounded-lg bg-[var(--ink-accent)] text-white text-xs font-medium hover:bg-[var(--ink-accent-hover)] transition-colors cursor-pointer"
              >
                保存
              </button>
              <button
                onClick={() => setIsCreatingSnapshot(false)}
                className="px-2 py-1 text-xs text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] cursor-pointer"
              >
                取消
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsCreatingSnapshot(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--ink-accent)] text-white hover:bg-[var(--ink-accent-hover)] font-medium text-xs transition-colors cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>保存当前为里程碑版本</span>
            </button>
          )}
        </div>
      </div>

      {/* 主体：左侧历史检查点列表，右侧实时 Diff 对比 */}
      <div className="flex-1 flex min-h-0 overflow-hidden h-[540px]">
        {/* 左侧历史列表 */}
        <div className="w-80 border-r border-[var(--ink-border)] overflow-y-auto p-3 space-y-2 shrink-0 bg-[var(--ink-bg-sidebar)]/30">
          <div className="text-[11px] font-medium text-[var(--ink-text-faint)] px-1 py-0.5 flex items-center justify-between">
            <span>历史版本列表</span>
            <span>共 {snapshots.length} 个记录</span>
          </div>

          {snapshots.map((snap, idx) => {
            const isSelected = activeDiffIndex === idx
            const isMilestone = snap.kind === 'milestone'
            const wordDelta = chapter.wordCount - snap.wordCount

            return (
              <div
                key={snap.id || idx}
                onClick={() => setActiveDiffIndex(idx)}
                className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[var(--ink-bg-panel)] border-[var(--ink-accent)] shadow-sm'
                    : 'bg-[var(--ink-bg)] border-[var(--ink-border)] hover:border-[var(--ink-border-strong)] text-[var(--ink-text-muted)]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5 gap-1">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 flex items-center gap-1 ${
                      isMilestone
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                    }`}
                  >
                    {isMilestone ? <Bookmark className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                    <span>{isMilestone ? '里程碑' : '自动检查点'}</span>
                  </span>

                  {idx === 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--ink-accent)]/10 text-[var(--ink-accent)] border border-[var(--ink-accent)]/20">
                      最新快照
                    </span>
                  )}
                </div>

                <div className="font-semibold text-[12.5px] text-[var(--ink-text)] truncate mb-1">
                  {snap.name || `检查点 #${snapshots.length - idx}`}
                </div>

                <div className="flex items-center justify-between text-[11px] text-[var(--ink-text-faint)] pt-1 border-t border-[var(--ink-border)]/50 mt-2">
                  <span>{new Date(snap.timestamp).toLocaleString('zh-CN')}</span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span>{snap.wordCount} 字</span>
                    {wordDelta !== 0 && (
                      <span
                        className={`text-[10px] font-medium ${
                          wordDelta > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {wordDelta > 0 ? `+${wordDelta}` : wordDelta}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* 右侧：逐词差异比对区 */}
        <div className="flex-1 flex flex-col min-w-0 p-4 overflow-hidden bg-[var(--ink-bg-panel)]">
          {activeSnap ? (
            <>
              <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-[var(--ink-border)]">
                <div className="flex items-center gap-2 text-xs">
                  <GitCompare className="w-4 h-4 text-[var(--ink-accent)]" />
                  <span className="font-medium text-[var(--ink-text)]">
                    正在对比：【{activeSnap.name || '选定快照'}】 ➔ 【当前正文】
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1 text-[var(--ink-text-muted)]">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-500/30 border border-emerald-500/60" />
                    当前新增
                  </span>
                  <span className="flex items-center gap-1 text-[var(--ink-text-muted)]">
                    <span className="w-2.5 h-2.5 rounded bg-rose-500/30 border border-rose-500/60" />
                    已被删改
                  </span>
                  <button
                    onClick={() => handleRevert(activeSnap)}
                    className="ml-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--ink-accent)] text-white text-xs font-medium hover:bg-[var(--ink-accent-hover)] transition-colors cursor-pointer shadow-2xs"
                  >
                    {restoringId === activeSnap.id ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> 已恢复
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" /> 恢复至此版本
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg)] p-4 text-[13px] leading-relaxed select-text font-serif">
                {diffResult ? (
                  <div className="whitespace-pre-wrap break-words">
                    {diffResult.map((part, index) => {
                      const color = part.added
                        ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 rounded px-0.5'
                        : part.removed
                          ? 'bg-rose-500/20 text-rose-800 dark:text-rose-300 line-through rounded px-0.5'
                          : ''
                      return (
                        <span key={index} className={color}>
                          {part.value}
                        </span>
                      )
                    })}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-[var(--ink-text-faint)]">
                    两版本内容完全一致，无任何文字差异
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-[var(--ink-text-faint)]">
              请在左侧选择一个历史检查点以对比与当前正文的改动差异
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
