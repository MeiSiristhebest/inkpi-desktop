import { useState, useEffect, useMemo, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import type { PromiseLedgerEntry, PayoffCandidate } from '../types'
import { ledgerEngine } from '../engine/LedgerEngine'
import { indexedDbPromiseLedgerRepository } from '../../../adapters/indexedDbPromiseLedgerRepository'
import { clock } from '../../../adapters/clock'
import { pluginEventBus } from '../../../core/pluginEventBus'
import {
  Sparkles,
  AlertCircle,
  CheckCircle,
  Flame,
  TrendingUp,
} from 'lucide-react'

export const LedgerWriterDrawer: FC<DesktopPluginDrawerProps> = ({
  projectId,
  currentText,
}) => {
  const [entries, setEntries] = useState<PromiseLedgerEntry[]>([])
  const [activeTab, setActiveTab] = useState<'candidates' | 'debts'>('candidates')
  const [currentChapter] = useState(1)

  const loadEntries = async () => {
    try {
      const all = await indexedDbPromiseLedgerRepository.getAll()
      const projectEntries = all.filter((e) => e.projectId === projectId)
      setEntries(projectEntries)
    } catch (e) {
      console.error('Failed to load promises in drawer:', e)
    }
  }

  useEffect(() => {
    loadEntries()
  }, [projectId])

  // 监听 FORESHADOW_PLANTED 事件（来自 chekhov-radar 自动扫描捕获的伏笔），自动入库或刷新列表
  useEffect(() => {
    const unsub = pluginEventBus.on('FORESHADOW_PLANTED', (payload) => {
      if (payload.projectId === projectId) {
        // 自动入账或刷新列表
        loadEntries()
      }
    })
    return () => {
      unsub()
    }
  }, [projectId])

  // 检测正文中出现的伏笔关键词候选
  const candidates: PayoffCandidate[] = useMemo(() => {
    return ledgerEngine.detectPayoffCandidates(currentText, entries)
  }, [currentText, entries])

  // 计算债务快照
  const snapshots = useMemo(() => {
    return ledgerEngine.computeDebtSnapshot(entries, currentChapter)
  }, [entries, currentChapter])

  const overdueSnapshots = useMemo(() => {
    return snapshots.filter((s) => s.isOverdue)
  }, [snapshots])

  const warningSnapshots = useMemo(() => {
    return snapshots.filter((s) => s.isWarning)
  }, [snapshots])

  // 快速兑现伏笔
  const handleQuickPayoff = async (candidate: PayoffCandidate) => {
    const target = entries.find((e) => e.id === candidate.entryId)
    if (!target) return
    const updated: PromiseLedgerEntry = {
      ...target,
      status: 'paid_off',
      payoffChapter: currentChapter,
      payoffNote: `正文命中关键词「${candidate.matchedKeyword}」`,
      updatedAt: clock.now(),
    }
    await indexedDbPromiseLedgerRepository.save(updated)
    await loadEntries()
  }

  // 快速添加推进记录
  const handleQuickProgress = async (entryId: string) => {
    const target = entries.find((e) => e.id === entryId)
    if (!target) return
    const updated: PromiseLedgerEntry = {
      ...target,
      status: 'progressing',
      progressHistory: [
        ...(target.progressHistory || []),
        {
          chapter: currentChapter,
          note: `在正文中推进`,
          memoryBoost: 0.5,
          timestamp: clock.now(),
        },
      ],
      updatedAt: clock.now(),
    }
    await indexedDbPromiseLedgerRepository.save(updated)
    await loadEntries()
  }

  return (
    <aside
      className="w-72 h-full flex flex-col bg-[var(--ink-bg-panel)] border-l border-[var(--ink-border)] text-[var(--ink-text)] text-xs"
      data-testid="ledger-writer-drawer"
    >
      {/* 头部面板 */}
      <div className="p-3 border-b border-[var(--ink-border)] bg-[var(--ink-bg-elevated)]/40 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 font-semibold text-[var(--ink-text)]">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>伏笔随动感知</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[var(--ink-text-muted)]">
            契诃夫之枪
          </span>
        </div>

        {/* 标签切换 */}
        <div className="grid grid-cols-2 gap-1 p-0.5 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)]">
          <button
            onClick={() => setActiveTab('candidates')}
            className={`py-1 text-[11px] rounded font-medium transition-colors ${
              activeTab === 'candidates'
                ? 'bg-[var(--ink-bg-panel)] text-[var(--ink-text)] shadow-xs'
                : 'text-[var(--ink-text-muted)] hover:text-[var(--ink-text)]'
            }`}
          >
            正文命中 ({candidates.length})
          </button>
          <button
            onClick={() => setActiveTab('debts')}
            className={`py-1 text-[11px] rounded font-medium transition-colors ${
              activeTab === 'debts'
                ? 'bg-[var(--ink-bg-panel)] text-[var(--ink-text)] shadow-xs'
                : 'text-[var(--ink-text-muted)] hover:text-[var(--ink-text)]'
            }`}
          >
            债务告警 ({overdueSnapshots.length + warningSnapshots.length})
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {activeTab === 'candidates' ? (
          candidates.length === 0 ? (
            <div className="text-center py-8 text-[var(--ink-text-muted)]">
              <p className="mb-1 text-[11px]">正文中暂未提及已知伏笔关键词</p>
              <p className="text-[10px] text-[var(--ink-text-faint)]">
                在文中描写已登记的道具或人物时，将在此自动提示回收
              </p>
            </div>
          ) : (
            candidates.map((cand) => (
              <div
                key={cand.entryId}
                className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-amber-500 truncate">{cand.clueName}</span>
                  <span className="text-[10px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-600">
                    匹配「{cand.matchedKeyword}」
                  </span>
                </div>
                <p className="text-[11px] text-[var(--ink-text-muted)]">
                  系统探测到当前章节文本与此伏笔高度相关，是否在此闭环兑现？
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleQuickPayoff(cand)}
                    className="flex-1 py-1 rounded bg-amber-500 text-white font-medium text-[11px] hover:opacity-90 flex items-center justify-center gap-1"
                  >
                    <CheckCircle className="w-3 h-3" /> 确认兑现
                  </button>
                  <button
                    onClick={() => handleQuickProgress(cand.entryId)}
                    className="px-2 py-1 rounded border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] text-[11px] hover:bg-[var(--ink-bg-hover)] flex items-center gap-1"
                    title="记录一次推进，提振读者记忆"
                  >
                    <TrendingUp className="w-3 h-3" /> 推进
                  </button>
                </div>
              </div>
            ))
          )
        ) : (
          /* 债务红线列表 */
          <div className="space-y-2">
            {overdueSnapshots.length === 0 && warningSnapshots.length === 0 ? (
              <div className="text-center py-8 text-[var(--ink-text-muted)]">
                <CheckCircle className="w-6 h-6 mx-auto text-emerald-500 mb-2 opacity-80" />
                <p className="text-[11px]">暂无超期或临近告警的伏笔</p>
                <p className="text-[10px] text-[var(--ink-text-faint)]">叙事债务处于健康状态</p>
              </div>
            ) : (
              <>
                {overdueSnapshots.map((snap) => (
                  <div
                    key={snap.entry.id}
                    className="p-2.5 rounded-lg border border-rose-500/30 bg-rose-500/5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-rose-500 font-semibold">
                      <span className="flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{snap.entry.clueName}</span>
                      </span>
                      <span className="text-[10px]">已超期</span>
                    </div>
                    <p className="text-[10px] text-[var(--ink-text-muted)]">
                      第 {snap.entry.plantChapter} 章埋设，硬红线第{' '}
                      {snap.entry.plantChapter + snap.entry.dueChapterLimit} 章
                    </p>
                    <div className="flex items-center justify-between pt-1 text-[10px]">
                      <span className="flex items-center gap-1 text-[var(--ink-text-faint)]">
                        <Flame className="w-3 h-3 text-rose-400" />
                        记忆热度 {Math.round(snap.memoryHeat * 100)}%
                      </span>
                      <button
                        onClick={() => handleQuickProgress(snap.entry.id)}
                        className="text-[var(--ink-accent)] hover:underline"
                      >
                        记录推进
                      </button>
                    </div>
                  </div>
                ))}

                {warningSnapshots.map((snap) => (
                  <div
                    key={snap.entry.id}
                    className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-amber-500 font-semibold">
                      <span className="truncate">{snap.entry.clueName}</span>
                      <span className="text-[10px]">临近回收</span>
                    </div>
                    <p className="text-[10px] text-[var(--ink-text-muted)]">
                      已发酵 {snap.elapsedChapters} 章，建议尽快布置填坑场景
                    </p>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
