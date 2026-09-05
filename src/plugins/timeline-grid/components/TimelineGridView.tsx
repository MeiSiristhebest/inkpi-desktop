import { useState, useEffect, useMemo, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import type { NarrativeThread, TimelineNode, NarrativeConflict } from '../types'
import { causalEngine } from '../engine/CausalEngine'
import { TimelineNodeCard } from './TimelineNodeCard'
import { ConflictPanel } from './ConflictPanel'
import { indexedDbTimelineRepository } from '../../../adapters/indexedDbTimelineRepository'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import { Plus, GitBranch, X, Check, Trash2 } from 'lucide-react'

export const DEFAULT_THREADS: Omit<NarrativeThread, 'projectId'>[] = [
  { id: 'thread-main', name: '主线 / 逆天修仙', color: '#3b82f6', characterIds: [], order: 0 },
  { id: 'thread-sect', name: '宗门 / 暗潮夺位', color: '#10b981', characterIds: [], order: 1 },
  { id: 'thread-evil', name: '暗线 / 天魔夺舍', color: '#8b5cf6', characterIds: [], order: 2 },
  { id: 'thread-love', name: '情感 / 灵狐契约', color: '#ec4899', characterIds: [], order: 3 },
]

export const DEMO_NODES: Omit<TimelineNode, 'projectId' | 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'node-1',
    threadId: 'thread-main',
    chapterOrder: 1,
    eventTitle: '后山受辱，偶得残破小鼎',
    summary: '主角被同族废脉排挤，跌入悬崖偶获青铜鼎器魂认主。',
    status: 'planned',
    prerequisites: [],
    causalOutcome: '获得残鼎',
    relatedEntityIds: [],
    emotionalPolarity: -0.5,
  },
  {
    id: 'node-2',
    threadId: 'thread-sect',
    chapterOrder: 2,
    eventTitle: '执法长老暗遣探子调查后山异动',
    summary: '天生异象引来宗门高层猜疑。',
    status: 'planned',
    prerequisites: ['node-1'],
    causalOutcome: '宗门势力介入',
    relatedEntityIds: [],
    emotionalPolarity: -0.2,
  },
  {
    id: 'node-3',
    threadId: 'thread-main',
    chapterOrder: 3,
    eventTitle: '利用鼎中灵火强行通脉突破',
    summary: '主角连破三层境界，惊艳宗门小比。',
    status: 'planned',
    prerequisites: ['node-1'],
    causalOutcome: '实力初现',
    relatedEntityIds: [],
    emotionalPolarity: 0.8,
  },
  {
    id: 'node-4',
    threadId: 'thread-evil',
    chapterOrder: 4,
    eventTitle: '魔门圣女伪装身份潜入外门',
    summary: '寻找失落万年的镇界残鼎线索。',
    status: 'planned',
    prerequisites: ['node-2'],
    causalOutcome: '暗线与宗门线交汇',
    relatedEntityIds: [],
    emotionalPolarity: 0.3,
  },
]

export const TimelineGridView: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const [threads, setThreads] = useState<NarrativeThread[]>([])
  const [nodes, setNodes] = useState<TimelineNode[]>([])
  const [loading, setLoading] = useState(true)
  const [showConflicts, setShowConflicts] = useState(true)
  const [editingNode, setEditingNode] = useState<Partial<TimelineNode> | null>(null)
  const [maxChapter, setMaxChapter] = useState(6)

  const loadData = async () => {
    try {
      setLoading(true)
      const [allThreads, allNodes] = await Promise.all([
        indexedDbTimelineRepository.getAllThreads(),
        indexedDbTimelineRepository.getAllNodes(),
      ])

      const projThreads = allThreads
        .filter((t) => t.projectId === projectId)
        .sort((a, b) => a.order - b.order)

      const projNodes = allNodes.filter((n) => n.projectId === projectId)

      setThreads(projThreads)
      setNodes(projNodes)

      const highestCh = Math.max(6, ...projNodes.map((n) => n.chapterOrder + 2))
      setMaxChapter(highestCh)
    } catch (e) {
      console.error('Failed to load timeline grid data:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [projectId])

  const handleSeedDemo = async () => {
    const now = clock.now()
    for (const t of DEFAULT_THREADS) {
      await indexedDbTimelineRepository.saveThread({ ...t, projectId })
    }
    for (const n of DEMO_NODES) {
      await indexedDbTimelineRepository.saveNode({
        ...n,
        projectId,
        createdAt: now,
        updatedAt: now,
      })
    }
    await loadData()
  }

  const handleSaveNode = async (node: TimelineNode) => {
    await indexedDbTimelineRepository.saveNode(node)
    setEditingNode(null)
    await loadData()
  }

  const handleDeleteNode = async (id: string) => {
    await indexedDbTimelineRepository.deleteNode(id)
    setEditingNode(null)
    await loadData()
  }

  // 冲突检测
  const conflicts: NarrativeConflict[] = useMemo(() => {
    return causalEngine.auditAllConflicts(nodes)
  }, [nodes])

  const conflictNodeIds = useMemo(() => {
    const set = new Set<string>()
    conflicts.forEach((c) => c.nodeIds.forEach((id) => set.add(id)))
    return set
  }, [conflicts])

  // 章节列列表 (1 .. maxChapter)
  const chapters = useMemo(() => Array.from({ length: maxChapter }, (_, i) => i + 1), [maxChapter])

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-canvas)] text-[var(--ink-text)] overflow-hidden">
      {/* 顶栏 */}
      <div className="border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4 shrink-0 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight">时空因果大纲网格</h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--ink-accent)]/15 text-[var(--ink-accent)] font-medium">
              DAG 环路检测与防因果倒置
            </span>
          </div>
          <p className="text-xs text-[var(--ink-text-muted)] mt-0.5">
            X 轴（时间/章节）× Y 轴（多线动线）双维坐标系，前置依赖实时校验
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setMaxChapter((prev) => prev + 2)}
            className="px-3 py-1.5 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] hover:bg-[var(--ink-bg-hover)] text-xs"
          >
            + 扩展 2 章
          </button>
          <button
            onClick={() => setShowConflicts((prev) => !prev)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              conflicts.length > 0
                ? 'border-rose-500/50 bg-rose-500/10 text-rose-500'
                : 'border-[var(--ink-border)] bg-[var(--ink-bg-elevated)]'
            }`}
          >
            因果门禁 ({conflicts.length})
          </button>
          <button
            onClick={() =>
              setEditingNode({
                projectId,
                threadId: threads[0]?.id || 'thread-main',
                chapterOrder: 1,
                status: 'planned',
                prerequisites: [],
                emotionalPolarity: 0,
              })
            }
            className="px-3 py-1.5 rounded-lg bg-[var(--ink-accent)] text-white text-xs font-medium hover:opacity-90 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> 添加大纲事件
          </button>
        </div>
      </div>

      {/* 主体区 */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-xs text-[var(--ink-text-muted)]">
            加载因果大纲网格...
          </div>
        ) : threads.length === 0 && nodes.length === 0 ? (
          /* 空状态 */
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-md p-8 border border-dashed border-[var(--ink-border)] rounded-2xl text-center bg-[var(--ink-bg-panel)]">
              <GitBranch className="w-8 h-8 mx-auto text-[var(--ink-accent)] mb-3 opacity-80" />
              <h3 className="font-medium text-sm text-[var(--ink-text)] mb-1">尚无时空大纲网格</h3>
              <p className="text-xs text-[var(--ink-text-muted)] mb-5 leading-relaxed">
                为你的作品建立多线叙事坐标。主线、支线与暗线交织演进，实时杜绝因果死锁与逻辑吃书。
              </p>
              <button
                onClick={handleSeedDemo}
                className="px-4 py-2 rounded-lg bg-[var(--ink-accent)] text-white text-xs font-medium hover:opacity-90"
              >
                预载修仙多线因果网格示例
              </button>
            </div>
          </div>
        ) : (
          /* 二维网格画布 */
          <div className="flex-1 overflow-auto p-4">
            <div
              className="inline-grid gap-2"
              style={{
                gridTemplateColumns: `140px repeat(${chapters.length}, minmax(160px, 1fr))`,
              }}
            >
              {/* 顶栏表头：空白角 + 章节标题 */}
              <div className="sticky top-0 z-20 bg-[var(--ink-bg-panel)] p-2 font-semibold text-xs border-b border-[var(--ink-border)] text-[var(--ink-text-muted)]">
                叙事线 / 章节
              </div>
              {chapters.map((ch) => (
                <div
                  key={`header-${ch}`}
                  className="sticky top-0 z-20 bg-[var(--ink-bg-panel)] p-2 text-center font-semibold text-xs border-b border-[var(--ink-border)] text-[var(--ink-text)]"
                >
                  第 {ch} 章
                </div>
              ))}

              {/* 每一行叙事线 */}
              {threads.map((thread) => (
                <div key={thread.id} className="contents">
                  {/* 左侧叙事线标签 (sticky left) */}
                  <div
                    className="sticky left-0 z-10 p-2.5 rounded-lg bg-[var(--ink-bg-panel)] border border-[var(--ink-border)] flex flex-col justify-center"
                    style={{ borderLeftWidth: '4px', borderLeftColor: thread.color }}
                  >
                    <span className="font-semibold text-xs text-[var(--ink-text)] truncate">
                      {thread.name}
                    </span>
                  </div>

                  {/* 这一行各章节单元格 */}
                  {chapters.map((ch) => {
                    const cellNodes = nodes.filter(
                      (n) => n.threadId === thread.id && n.chapterOrder === ch,
                    )

                    return (
                      <div
                        key={`${thread.id}-${ch}`}
                        className="min-h-[100px] p-1 rounded-lg border border-[var(--ink-border)]/60 bg-[var(--ink-bg-elevated)]/30 hover:bg-[var(--ink-bg-hover)]/40 transition-colors flex flex-col gap-1.5 relative group"
                      >
                        {cellNodes.map((n) => (
                          <TimelineNodeCard
                            key={n.id}
                            node={n}
                            thread={thread}
                            hasConflict={conflictNodeIds.has(n.id)}
                            onClick={() => setEditingNode(n)}
                          />
                        ))}

                        {cellNodes.length === 0 && (
                          <button
                            onClick={() =>
                              setEditingNode({
                                threadId: thread.id,
                                chapterOrder: ch,
                                status: 'planned',
                                prerequisites: [],
                                emotionalPolarity: 0,
                              })
                            }
                            className="w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[var(--ink-text-muted)] hover:text-[var(--ink-accent)]"
                            title="在此章节添加事件节点"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 侧边冲突门禁面板 */}
        {showConflicts && <ConflictPanel conflicts={conflicts} />}
      </div>

      {/* 节点编辑模态窗 */}
      {editingNode && (
        <NodeEditorModal
          node={editingNode}
          threads={threads}
          allNodes={nodes}
          onSave={handleSaveNode}
          onDelete={handleDeleteNode}
          onCancel={() => setEditingNode(null)}
        />
      )}
    </div>
  )
}

interface NodeEditorModalProps {
  node: Partial<TimelineNode>
  threads: NarrativeThread[]
  allNodes: TimelineNode[]
  onSave: (node: TimelineNode) => void
  onDelete: (id: string) => void
  onCancel: () => void
}

const NodeEditorModal: FC<NodeEditorModalProps> = ({
  node,
  threads,
  allNodes,
  onSave,
  onDelete,
  onCancel,
}) => {
  const [eventTitle, setEventTitle] = useState(node.eventTitle || '')
  const [threadId, setThreadId] = useState(node.threadId || threads[0]?.id || '')
  const [chapterOrder, setChapterOrder] = useState(node.chapterOrder ?? 1)
  const [summary, setSummary] = useState(node.summary || '')
  const [causalOutcome, setCausalOutcome] = useState(node.causalOutcome || '')
  const [emotionalPolarity, setEmotionalPolarity] = useState(node.emotionalPolarity ?? 0)
  const [prerequisites, setPrerequisites] = useState<string[]>(node.prerequisites || [])

  const availablePreNodes = allNodes.filter((n) => n.id !== node.id)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!eventTitle.trim()) return

    const now = clock.now()
    const saved: TimelineNode = {
      id: node.id || idGenerator.generate('node'),
      projectId: node.projectId || '',
      threadId,
      chapterOrder: Number(chapterOrder),
      eventTitle: eventTitle.trim(),
      summary: summary.trim(),
      status: node.status || 'planned',
      prerequisites,
      causalOutcome: causalOutcome.trim(),
      relatedEntityIds: node.relatedEntityIds || [],
      emotionalPolarity: Number(emotionalPolarity),
      createdAt: node.createdAt || now,
      updatedAt: now,
    }

    onSave(saved)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="w-full max-w-md bg-[var(--ink-bg-panel)] border border-[var(--ink-border)] rounded-xl shadow-2xl overflow-hidden flex flex-col text-xs">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--ink-border)]">
          <h3 className="font-semibold text-sm text-[var(--ink-text)]">
            {node.id ? '编辑时空大纲事件' : '新建大纲事件节点'}
          </h3>
          <button
            onClick={onCancel}
            className="p-1 rounded text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto max-h-[80vh]">
          <div>
            <label className="block text-[var(--ink-text-muted)] mb-1">
              事件标题 <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              placeholder="如：断界渊试炼突破"
              className="w-full px-3 py-2 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[var(--ink-text-muted)] mb-1">所属叙事线</label>
              <select
                value={threadId}
                onChange={(e) => setThreadId(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none"
              >
                {threads.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[var(--ink-text-muted)] mb-1">发生章节 (X轴)</label>
              <input
                type="number"
                min="1"
                value={chapterOrder}
                onChange={(e) => setChapterOrder(Number(e.target.value))}
                className="w-full px-3 py-2 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[var(--ink-text-muted)] mb-1">
              事件摘要 (供 AI 提取情境)
            </label>
            <textarea
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="一句话阐述核心冲突与情境..."
              className="w-full px-3 py-2 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[var(--ink-text-muted)] mb-1">因果演变走向</label>
              <input
                type="text"
                value={causalOutcome}
                onChange={(e) => setCausalOutcome(e.target.value)}
                placeholder="如：宗门势力介入"
                className="w-full px-3 py-2 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[var(--ink-text-muted)] mb-1">
                情感张力 (-1.0 ~ +1.0)
              </label>
              <input
                type="number"
                step="0.1"
                min="-1"
                max="1"
                value={emotionalPolarity}
                onChange={(e) => setEmotionalPolarity(Number(e.target.value))}
                className="w-full px-3 py-2 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[var(--ink-text-muted)] mb-1">
              前置依赖事件 (DAG 因果约束)
            </label>
            <div className="max-h-28 overflow-y-auto border border-[var(--ink-border)] rounded bg-[var(--ink-bg-canvas)] p-1.5 space-y-1">
              {availablePreNodes.length === 0 ? (
                <div className="text-[var(--ink-text-faint)] py-2 text-center">
                  暂无其他可选节点
                </div>
              ) : (
                availablePreNodes.map((pn) => {
                  const checked = prerequisites.includes(pn.id)
                  return (
                    <label
                      key={pn.id}
                      className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-[var(--ink-bg-hover)] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setPrerequisites((prev) => [...prev, pn.id])
                          } else {
                            setPrerequisites((prev) => prev.filter((id) => id !== pn.id))
                          }
                        }}
                      />
                      <span className="truncate">
                        第 {pn.chapterOrder} 章：{pn.eventTitle}
                      </span>
                    </label>
                  )
                })
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[var(--ink-border)]">
            {node.id ? (
              <button
                type="button"
                onClick={() => onDelete(node.id!)}
                className="px-3 py-1.5 rounded text-rose-400 hover:bg-rose-500/10 flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> 删除
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-3 py-1.5 rounded text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)]"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-[var(--ink-accent)] text-white hover:opacity-90 flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" /> 保存事件
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
