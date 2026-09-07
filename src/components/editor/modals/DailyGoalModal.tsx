import React, { useState } from 'react'
import { Modal } from '../../../ui/molecules/Modal'
import { HelpCircle } from 'lucide-react'

export interface DailyGoalModalProps {
  onClose: () => void
  currentGoal: number
  onSave: (newGoal: number) => void
  onDelete?: () => void
}

export const DailyGoalModal: React.FC<DailyGoalModalProps> = ({
  onClose,
  currentGoal,
  onSave,
  onDelete,
}) => {
  const [goal, setGoal] = useState<number>(currentGoal || 4600)
  const [spreadToRestOfMonth, setSpreadToRestOfMonth] = useState<boolean>(false)
  const [remindOption, setRemindOption] = useState<string>('none')

  // 计算本月存稿与折算假期估算
  const estimatedDraft = goal * 3 // 预估约3天存稿

  const presets = [
    { label: '全勤计划', value: 4200 },
    { label: '超越自我', value: 4600 },
    { label: '突破瓶颈', value: 5000 },
    { label: '极限挑战', value: 6000 },
  ]

  return (
    <Modal
      onClose={onClose}
      widthClass="max-w-md"
      overlayClassName="bg-black/40 backdrop-blur-sm"
      panelClassName="bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] rounded-[20px] shadow-[var(--ink-shadow-lg)] p-6 text-[var(--ink-text)] flex flex-col gap-5 font-sans"
    >
      <div className="text-center">
        <div className="text-xs text-[var(--ink-text-muted)] font-medium mb-1">每日码字目标</div>
        <div className="text-4xl font-extrabold text-[var(--ink-accent)] tabular-nums tracking-tight">
          {goal.toLocaleString()}
        </div>
        <div className="flex items-center justify-center gap-1.5 text-xs text-[var(--ink-text-muted)] mt-2">
          <span>
            预估本月存稿{' '}
            <strong className="text-[var(--ink-text)]">{estimatedDraft.toLocaleString()}</strong>{' '}
            折算假期 <strong className="text-[var(--ink-accent)]">3天</strong>
          </span>
          <HelpCircle className="w-3.5 h-3.5 text-[var(--ink-text-faint)]" />
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-[var(--ink-text-muted)] mt-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={spreadToRestOfMonth}
            onChange={(e) => setSpreadToRestOfMonth(e.target.checked)}
            className="rounded text-[var(--ink-accent)] border-[var(--ink-border)] accent-[var(--ink-accent)] cursor-pointer"
          />
          <span>不足字数均摊到本月剩余天数</span>
        </label>
      </div>

      {/* 滑动滑块 */}
      <div className="space-y-2 px-1">
        <input
          type="range"
          min={0}
          max={30000}
          step={200}
          value={goal}
          onChange={(e) => setGoal(Number(e.target.value))}
          className="w-full accent-[var(--ink-accent)] cursor-pointer"
        />
        <div className="flex justify-between text-[11px] text-[var(--ink-text-faint)] tabular-nums">
          <span>0</span>
          <span>1.5万</span>
          <span>3万</span>
        </div>
      </div>

      {/* 推荐目标列表 */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-[var(--ink-text-muted)]">推荐目标</div>
        <div className="border border-[var(--ink-border)] rounded-xl overflow-hidden divide-y divide-[var(--ink-border)]">
          {presets.map((p) => {
            const isSelected = goal === p.value
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => setGoal(p.value)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-xs transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--ink-accent-soft)] text-[var(--ink-accent)] font-semibold'
                    : 'bg-[var(--ink-bg-elevated)] hover:bg-[var(--ink-bg-hover)] text-[var(--ink-text)]'
                }`}
              >
                <span>{p.label}</span>
                <span className="tabular-nums font-semibold">{p.value}/天</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 提醒选项 */}
      <div className="flex items-center justify-between text-xs pt-1">
        <div className="flex items-center gap-1 text-[var(--ink-text-muted)]">
          <span>写作提醒</span>
          <HelpCircle className="w-3.5 h-3.5 text-[var(--ink-text-faint)]" />
        </div>
        <select
          value={remindOption}
          onChange={(e) => setRemindOption(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] text-[var(--ink-text)] text-xs focus:outline-none focus:border-[var(--ink-accent)] cursor-pointer"
        >
          <option value="none">不提醒</option>
          <option value="20:00">每日 20:00</option>
          <option value="21:00">每日 21:00</option>
          <option value="22:00">每日 22:00</option>
        </select>
      </div>

      {/* 底部按钮栏 */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--ink-border)]">
        {onDelete ? (
          <button
            type="button"
            onClick={() => {
              onDelete()
              onClose()
            }}
            className="px-4 py-2 rounded-xl text-xs font-medium text-[var(--ink-danger)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer"
          >
            删除计划
          </button>
        ) : (
          <div />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium border border-[var(--ink-border)] hover:bg-[var(--ink-bg-hover)] text-[var(--ink-text)] transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(goal)
              onClose()
            }}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-[var(--ink-accent)] hover:bg-[var(--ink-accent-hover)] text-white shadow-xs transition-colors cursor-pointer"
          >
            保存
          </button>
        </div>
      </div>
    </Modal>
  )
}
