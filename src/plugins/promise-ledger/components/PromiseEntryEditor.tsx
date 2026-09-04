import { useState, type FC } from 'react'
import type { PromiseLedgerEntry, PromiseTier, PromiseStatus } from '../types'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import { X, Check } from 'lucide-react'

interface PromiseEntryEditorProps {
  entry: Partial<PromiseLedgerEntry>
  projectId: string
  currentChapter?: number
  onSave: (entry: PromiseLedgerEntry) => void
  onCancel: () => void
}

const TIERS: { id: PromiseTier; label: string }[] = [
  { id: 'main_plot', label: '主线核心 (权重大)' },
  { id: 'power_system', label: '战力/法则' },
  { id: 'romance', label: '情感/CP线' },
  { id: 'side_arc', label: '支线剧情' },
  { id: 'atmosphere', label: '气氛伏笔' },
]

export const PromiseEntryEditor: FC<PromiseEntryEditorProps> = ({
  entry,
  projectId,
  currentChapter = 1,
  onSave,
  onCancel,
}) => {
  const [clueName, setClueName] = useState(entry.clueName || '')
  const [tier, setTier] = useState<PromiseTier>(entry.tier || 'main_plot')
  const [plantChapter, setPlantChapter] = useState(entry.plantChapter ?? currentChapter)
  const [softDeadline, setSoftDeadline] = useState(entry.softDeadline ?? 15)
  const [dueChapterLimit, setDueChapterLimit] = useState(entry.dueChapterLimit ?? 25)
  const [plantNote, setPlantNote] = useState(entry.plantNote || '')
  const [status, setStatus] = useState<PromiseStatus>(entry.status || 'planted')
  const [payoffChapter, setPayoffChapter] = useState<number | undefined>(entry.payoffChapter)
  const [payoffNote, setPayoffNote] = useState(entry.payoffNote || '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!clueName.trim()) return

    const now = clock.now()
    const saved: PromiseLedgerEntry = {
      id: entry.id || idGenerator.generate('promise'),
      projectId: entry.projectId || projectId,
      clueName: clueName.trim(),
      tier,
      plantChapter: Number(plantChapter),
      softDeadline: Number(softDeadline),
      dueChapterLimit: Number(dueChapterLimit),
      plantNote: plantNote.trim(),
      status,
      memoryDecayLambda: entry.memoryDecayLambda || 0.05,
      progressHistory: entry.progressHistory || [],
      payoffChapter: status === 'paid_off' ? Number(payoffChapter ?? currentChapter) : undefined,
      payoffNote: status === 'paid_off' ? payoffNote.trim() : undefined,
      relatedEntityIds: entry.relatedEntityIds || [],
      relatedChapterIds: entry.relatedChapterIds || [],
      createdAt: entry.createdAt || now,
      updatedAt: now,
    }

    onSave(saved)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-[var(--ink-bg-panel)] border border-[var(--ink-border)] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* 标题 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--ink-border)]">
          <h3 className="font-medium text-sm text-[var(--ink-text)]">
            {entry.id ? '编辑伏笔账本条目' : '新建 3P 伏笔（契诃夫之枪）'}
          </h3>
          <button
            onClick={onCancel}
            className="p-1 rounded text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 表单内容 */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          <div>
            <label className="block text-[var(--ink-text-muted)] mb-1">
              伏笔代称 / 道具 / 契机 <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={clueName}
              onChange={(e) => setClueName(e.target.value)}
              placeholder="例如：残破青铜鼎的第三道铭文"
              className="w-full px-3 py-2 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none focus:border-[var(--ink-accent)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[var(--ink-text-muted)] mb-1">伏笔重要度分层</label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as PromiseTier)}
                className="w-full px-3 py-2 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none"
              >
                {TIERS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[var(--ink-text-muted)] mb-1">生命周期状态</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PromiseStatus)}
                className="w-full px-3 py-2 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none"
              >
                <option value="planted">埋设中 (Planted)</option>
                <option value="progressing">发酵推进中 (Progressing)</option>
                <option value="paid_off">已闭环回收 (Paid-off)</option>
                <option value="abandoned">已弃用 (Abandoned)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[var(--ink-text-muted)] mb-1">埋设章节</label>
              <input
                type="number"
                min="0"
                value={plantChapter}
                onChange={(e) => setPlantChapter(Number(e.target.value))}
                className="w-full px-3 py-2 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[var(--ink-text-muted)] mb-1" title="距埋设多少章后告警">
                软预警跨度(章)
              </label>
              <input
                type="number"
                min="1"
                value={softDeadline}
                onChange={(e) => setSoftDeadline(Number(e.target.value))}
                className="w-full px-3 py-2 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[var(--ink-text-muted)] mb-1" title="距埋设多少章内必须回收">
                硬红线跨度(章)
              </label>
              <input
                type="number"
                min="1"
                value={dueChapterLimit}
                onChange={(e) => setDueChapterLimit(Number(e.target.value))}
                className="w-full px-3 py-2 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[var(--ink-text-muted)] mb-1">埋设场景简述 / 线索上下文</label>
            <textarea
              rows={3}
              value={plantNote}
              onChange={(e) => setPlantNote(e.target.value)}
              placeholder="记录伏笔的埋藏细节，如：主角在拍卖会无意竞得，鼎身铭文与母亲遗物一致…"
              className="w-full px-3 py-2 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none focus:border-[var(--ink-accent)] resize-none"
            />
          </div>

          {status === 'paid_off' && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg space-y-2">
              <div className="font-semibold text-blue-400">回收闭环信息</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[var(--ink-text-muted)] mb-1">兑现章节号</label>
                  <input
                    type="number"
                    value={payoffChapter ?? currentChapter}
                    onChange={(e) => setPayoffChapter(Number(e.target.value))}
                    className="w-full px-2 py-1.5 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[var(--ink-text-muted)] mb-1">兑现方式与效果</label>
                  <input
                    type="text"
                    value={payoffNote}
                    onChange={(e) => setPayoffNote(e.target.value)}
                    placeholder="如：断界渊破境时鼎魂觉醒"
                    className="w-full px-2 py-1.5 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--ink-border)]">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-1.5 rounded text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)]"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded bg-[var(--ink-accent)] text-white hover:opacity-90 flex items-center gap-1.5 font-medium"
            >
              <Check className="w-3.5 h-3.5" /> 保存伏笔
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
