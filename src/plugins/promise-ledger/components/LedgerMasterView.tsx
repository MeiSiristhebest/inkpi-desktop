import { useState, useEffect, useMemo, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import type { PromiseLedgerEntry, PromiseStatus } from '../types'
import { ledgerEngine } from '../engine/LedgerEngine'
import { DebtGanttChart } from './DebtGanttChart'
import { PromiseEntryEditor } from './PromiseEntryEditor'
import { indexedDbPromiseLedgerRepository } from '../../../adapters/indexedDbPromiseLedgerRepository'
import { clock } from '../../../adapters/clock'
import {
  Plus,
  Search,
  Sparkles,
  Edit2,
  Trash2,
} from 'lucide-react'

export const DEMO_PROMISES: Omit<PromiseLedgerEntry, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>[] = [
  {
    clueName: '断界残鼎的第三重封印',
    tier: 'main_plot',
    plantChapter: 3,
    softDeadline: 20,
    dueChapterLimit: 35,
    plantNote: '主角自古洞府所得青铜残鼎，底部刻有三枚神秘血符，需金丹真火方能炼化。',
    status: 'planted',
    memoryDecayLambda: 0.04,
    progressHistory: [
      { chapter: 15, note: '在器火阁测试时残鼎微鸣，引起执法长老警觉', memoryBoost: 0.5 },
    ],
    relatedEntityIds: [],
    relatedChapterIds: [],
  },
  {
    clueName: '黑袍毒师遗留的墨色玉佩',
    tier: 'side_arc',
    plantChapter: 8,
    softDeadline: 15,
    dueChapterLimit: 25,
    plantNote: '黑市击杀毒师后搜出的随身信物，正面雕有百毒门暗徽。',
    status: 'progressing',
    memoryDecayLambda: 0.05,
    progressHistory: [
      { chapter: 18, note: '在万药斋被掌柜辨认出乃是暗市通行令', memoryBoost: 0.7 },
    ],
    relatedEntityIds: [],
    relatedChapterIds: [],
  },
  {
    clueName: '白狐幼兽的真实身世',
    tier: 'romance',
    plantChapter: 1,
    softDeadline: 12,
    dueChapterLimit: 18,
    plantNote: '后山雪夜救下的九尾灵狐血脉，体内蕴藏天狐皇族封印。',
    status: 'paid_off',
    memoryDecayLambda: 0.05,
    progressHistory: [],
    payoffChapter: 16,
    payoffNote: '灵狐在主角濒死之际破开封印化为少女，替主角挡下致命一击。',
    relatedEntityIds: [],
    relatedChapterIds: [],
  },
]

export const LedgerMasterView: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const [entries, setEntries] = useState<PromiseLedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | PromiseStatus | 'overdue'>('all')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'gantt' | 'list'>('gantt')
  const [editingEntry, setEditingEntry] = useState<Partial<PromiseLedgerEntry> | null>(null)
  const [currentChapter] = useState(22)

  // 加载数据
  const loadEntries = async () => {
    try {
      setLoading(true)
      const all = await indexedDbPromiseLedgerRepository.getAll()
      const projectEntries = all.filter((e) => !e.projectId || e.projectId === projectId)
      setEntries(projectEntries.sort((a, b) => a.plantChapter - b.plantChapter))
    } catch (e) {
      console.error('Failed to load promise ledger entries:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEntries()
  }, [projectId])

  const handleSaveEntry = async (entry: PromiseLedgerEntry) => {
    await indexedDbPromiseLedgerRepository.save(entry)
    setEditingEntry(null)
    await loadEntries()
  }

  const handleDeleteEntry = async (id: string) => {
    await indexedDbPromiseLedgerRepository.delete(id)
    await loadEntries()
  }

  const handleSeedDemo = async () => {
    const now = clock.now()
    for (let i = 0; i < DEMO_PROMISES.length; i++) {
      const p = DEMO_PROMISES[i]
      const item: PromiseLedgerEntry = {
        ...p,
        id: `demo-promise-${i + 1}-${now}`,
        projectId,
        createdAt: now,
        updatedAt: now,
      }
      await indexedDbPromiseLedgerRepository.save(item)
    }
    await loadEntries()
  }

  // 状态快照与指标计算
  const snapshots = useMemo(
    () => ledgerEngine.computeDebtSnapshot(entries, currentChapter),
    [entries, currentChapter],
  )

  const healthScore = useMemo(
    () => ledgerEngine.computeNarrativeHealthScore(entries, currentChapter),
    [entries, currentChapter],
  )

  const overdueCount = useMemo(() => snapshots.filter((s) => s.isOverdue).length, [snapshots])
  const activeCount = useMemo(
    () => entries.filter((e) => e.status === 'planted' || e.status === 'progressing').length,
    [entries],
  )
  const paidCount = useMemo(() => entries.filter((e) => e.status === 'paid_off').length, [entries])

  // 筛选过滤
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (search) {
        const q = search.toLowerCase()
        const matchName = entry.clueName.toLowerCase().includes(q)
        const matchNote = (entry.plantNote || '').toLowerCase().includes(q)
        if (!matchName && !matchNote) return false
      }

      if (activeTab === 'all') return true
      if (activeTab === 'overdue') {
        const snap = snapshots.find((s) => s.entry.id === entry.id)
        return snap?.isOverdue
      }
      return entry.status === activeTab
    })
  }, [entries, search, activeTab, snapshots])

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-canvas)] text-[var(--ink-text)] overflow-hidden">
      {/* 顶栏：指标概览与工具条 */}
      <div className="border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4 shrink-0 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight">3P 伏笔与债务账本</h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--ink-accent)]/15 text-[var(--ink-accent)] font-medium">
              契诃夫之枪闭环
            </span>
          </div>
          <p className="text-xs text-[var(--ink-text-muted)] mt-0.5">
            Plant（埋设）→ Progress（发酵）→ Payoff（回收）生命周期管理与超期红线预警
          </p>
        </div>

        {/* 核心叙事健康度指示盘 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)]">
            <div className="text-[10px] text-[var(--ink-text-muted)]">叙事健康分</div>
            <div
              className={`text-sm font-bold ${
                healthScore >= 85
                  ? 'text-emerald-500'
                  : healthScore >= 70
                    ? 'text-amber-500'
                    : 'text-rose-500'
              }`}
            >
              {healthScore}
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)]">
            <div className="text-[10px] text-[var(--ink-text-muted)]">待填坑</div>
            <div className="text-sm font-bold text-[var(--ink-text)]">{activeCount}</div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)]">
            <div className="text-[10px] text-[var(--ink-text-muted)]">超期红线</div>
            <div className="text-sm font-bold text-rose-500">{overdueCount}</div>
          </div>

          <button
            onClick={() => setEditingEntry({})}
            className="px-3 py-1.5 rounded-lg bg-[var(--ink-accent)] text-white text-xs font-medium hover:opacity-90 flex items-center gap-1.5 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" /> 埋下伏笔
          </button>
        </div>
      </div>

      {/* 筛选过滤与模式切换栏 */}
      <div className="border-b border-[var(--ink-border)] px-4 py-2 bg-[var(--ink-bg-elevated)]/50 shrink-0 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              activeTab === 'all'
                ? 'bg-[var(--ink-bg-panel)] font-medium text-[var(--ink-text)] shadow-xs'
                : 'text-[var(--ink-text-muted)] hover:text-[var(--ink-text)]'
            }`}
          >
            全部 ({entries.length})
          </button>
          <button
            onClick={() => setActiveTab('planted')}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              activeTab === 'planted'
                ? 'bg-[var(--ink-bg-panel)] font-medium text-[var(--ink-text)] shadow-xs'
                : 'text-[var(--ink-text-muted)] hover:text-[var(--ink-text)]'
            }`}
          >
            埋设中
          </button>
          <button
            onClick={() => setActiveTab('progressing')}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              activeTab === 'progressing'
                ? 'bg-[var(--ink-bg-panel)] font-medium text-[var(--ink-text)] shadow-xs'
                : 'text-[var(--ink-text-muted)] hover:text-[var(--ink-text)]'
            }`}
          >
            发酵推进中
          </button>
          <button
            onClick={() => setActiveTab('overdue')}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              activeTab === 'overdue'
                ? 'bg-rose-500/15 font-medium text-rose-500 shadow-xs'
                : 'text-rose-400 hover:text-rose-500'
            }`}
          >
            ⚠️ 超期预警 ({overdueCount})
          </button>
          <button
            onClick={() => setActiveTab('paid_off')}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              activeTab === 'paid_off'
                ? 'bg-[var(--ink-bg-panel)] font-medium text-emerald-500 shadow-xs'
                : 'text-[var(--ink-text-muted)] hover:text-emerald-500'
            }`}
          >
            已回收 ({paidCount})
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索线索/设定..."
              className="pl-8 pr-2.5 py-1 rounded-md bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)] focus:outline-none w-44"
            />
          </div>

          {/* 模式切换 */}
          <div className="flex items-center p-0.5 rounded-lg bg-[var(--ink-bg-panel)] border border-[var(--ink-border)]">
            <button
              onClick={() => setViewMode('gantt')}
              className={`px-2.5 py-0.5 rounded text-[11px] transition-colors ${
                viewMode === 'gantt'
                  ? 'bg-[var(--ink-accent)] text-white'
                  : 'text-[var(--ink-text-muted)] hover:text-[var(--ink-text)]'
              }`}
            >
              甘特图
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-2.5 py-0.5 rounded text-[11px] transition-colors ${
                viewMode === 'list'
                  ? 'bg-[var(--ink-accent)] text-white'
                  : 'text-[var(--ink-text-muted)] hover:text-[var(--ink-text)]'
              }`}
            >
              列表
            </button>
          </div>
        </div>
      </div>

      {/* 主视图内容 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="text-center py-16 text-xs text-[var(--ink-text-muted)]">
            加载伏笔账本数据中...
          </div>
        ) : entries.length === 0 ? (
          /* 空状态 */
          <div className="max-w-md mx-auto my-16 p-8 border border-dashed border-[var(--ink-border)] rounded-2xl text-center bg-[var(--ink-bg-panel)]">
            <Sparkles className="w-8 h-8 mx-auto text-[var(--ink-accent)] mb-3 opacity-80" />
            <h3 className="font-medium text-sm text-[var(--ink-text)] mb-1">
              尚无伏笔记录，开始构建契诃夫之枪
            </h3>
            <p className="text-xs text-[var(--ink-text-muted)] mb-5 leading-relaxed">
              第一幕出现的猎枪，在第三幕前必须击发。登记你的主线秘密、机缘遗物与悬念暗线，告别断头烂尾。
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleSeedDemo}
                className="px-4 py-2 rounded-lg bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] hover:bg-[var(--ink-bg-hover)] text-xs text-[var(--ink-text)]"
              >
                预载修仙伏笔演示包
              </button>
              <button
                onClick={() => setEditingEntry({})}
                className="px-4 py-2 rounded-lg bg-[var(--ink-accent)] text-white text-xs font-medium hover:opacity-90"
              >
                新建第一条伏笔
              </button>
            </div>
          </div>
        ) : viewMode === 'gantt' ? (
          <div className="space-y-4">
            <DebtGanttChart
              entries={filteredEntries}
              currentChapter={currentChapter}
              onSelectEntry={(entry) => setEditingEntry(entry)}
            />

            {/* 卡片补充列表 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredEntries.map((entry) => {
                const snap = snapshots.find((s) => s.entry.id === entry.id)
                return (
                  <div
                    key={entry.id}
                    className="p-3.5 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] hover:border-[var(--ink-accent)]/50 transition-colors flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-[var(--ink-text)] truncate">
                          {entry.clueName}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            entry.status === 'paid_off'
                              ? 'bg-blue-500/10 text-blue-400'
                              : snap?.isOverdue
                                ? 'bg-rose-500/10 text-rose-500'
                                : 'bg-emerald-500/10 text-emerald-500'
                          }`}
                        >
                          {entry.status === 'paid_off'
                            ? '已回收'
                            : snap?.isOverdue
                              ? '已超期'
                              : '连载中'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--ink-text-muted)] line-clamp-2 mb-2">
                        {entry.plantNote || '暂无埋设场景描述'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-[var(--ink-border)]/50 flex items-center justify-between text-[10px] text-[var(--ink-text-faint)]">
                      <span>埋设：第 {entry.plantChapter} 章</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingEntry(entry)}
                          className="hover:text-[var(--ink-text)]"
                          title="编辑"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="hover:text-rose-400"
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          /* 详细列表表格模式 */
          <div className="border border-[var(--ink-border)] rounded-lg overflow-hidden bg-[var(--ink-bg-panel)]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--ink-bg-elevated)] text-[var(--ink-text-muted)] border-b border-[var(--ink-border)]">
                <tr>
                  <th className="p-3">线索名称</th>
                  <th className="p-3">类型分层</th>
                  <th className="p-3">埋设章节</th>
                  <th className="p-3">硬红线</th>
                  <th className="p-3">读者记忆热度</th>
                  <th className="p-3">状态</th>
                  <th className="p-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ink-border)]/50">
                {filteredEntries.map((entry) => {
                  const snap = snapshots.find((s) => s.entry.id === entry.id)
                  const heat = snap?.memoryHeat ?? 1.0
                  return (
                    <tr key={entry.id} className="hover:bg-[var(--ink-bg-hover)]">
                      <td className="p-3 font-medium text-[var(--ink-text)]">{entry.clueName}</td>
                      <td className="p-3 text-[var(--ink-text-muted)]">{entry.tier}</td>
                      <td className="p-3">第 {entry.plantChapter} 章</td>
                      <td className="p-3">第 {entry.plantChapter + entry.dueChapterLimit} 章</td>
                      <td className="p-3">
                        <span
                          className={`font-semibold ${
                            heat < 0.2
                              ? 'text-rose-400'
                              : heat < 0.5
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                          }`}
                        >
                          {Math.round(heat * 100)}%
                        </span>
                      </td>
                      <td className="p-3">
                        {entry.status === 'paid_off' ? (
                          <span className="text-blue-400">已回收 (第{entry.payoffChapter}章)</span>
                        ) : snap?.isOverdue ? (
                          <span className="text-rose-500 font-semibold">⚠️ 已超期</span>
                        ) : snap?.isWarning ? (
                          <span className="text-amber-500">软预警</span>
                        ) : (
                          <span className="text-emerald-500">正常</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setEditingEntry(entry)}
                          className="px-2 py-1 text-xs text-[var(--ink-text-muted)] hover:text-[var(--ink-text)]"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="px-2 py-1 text-xs text-rose-400 hover:text-rose-300 ml-1"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 编辑弹窗 */}
      {editingEntry && (
        <PromiseEntryEditor
          entry={editingEntry}
          projectId={projectId}
          currentChapter={currentChapter}
          onSave={handleSaveEntry}
          onCancel={() => setEditingEntry(null)}
        />
      )}
    </div>
  )
}
