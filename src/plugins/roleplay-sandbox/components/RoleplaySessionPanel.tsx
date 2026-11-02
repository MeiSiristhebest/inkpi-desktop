import type { Dispatch, FC, SetStateAction } from 'react'
import { RotateCcw, Save, Send } from 'lucide-react'
import type { RoleplayDraft } from '../../../domain/roleplay/roleplaySandboxModel'
import type { RoleplayMessage, RoleplaySession } from '../../../domain/roleplay/roleplaySession'

export interface RoleplaySessionPanelProps {
  sandbox: RoleplaySession
  draft: RoleplayDraft
  setDraft: Dispatch<SetStateAction<RoleplayDraft>>
  draftIsDirty: boolean
  messageDraft: string
  setMessageDraft: Dispatch<SetStateAction<string>>
  busySessionId: string | null
  isAiAvailable: boolean
  onSaveSettings: () => void
  onSend: () => void
  onRetry: () => void
  onAbandon: () => void
  onPromote: (message: RoleplayMessage) => void
}

const updateDraft =
  (setDraft: RoleplaySessionPanelProps['setDraft'], field: keyof RoleplayDraft) =>
  (value: string) =>
    setDraft((current) => ({ ...current, [field]: value }))

export const RoleplaySessionPanel: FC<RoleplaySessionPanelProps> = ({
  sandbox,
  draft,
  setDraft,
  draftIsDirty,
  messageDraft,
  setMessageDraft,
  busySessionId,
  isAiAvailable,
  onSaveSettings,
  onSend,
  onRetry,
  onAbandon,
  onPromote,
}) => {
  const isBusy = busySessionId !== null
  const hasInterruptedTurn = sandbox.turnStatus === 'failed' || sandbox.turnStatus === 'interrupted'

  return (
    <div className="min-w-0 flex-1 space-y-4">
      <section className="rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-card)] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">沙盒设定</h3>
          <button
            type="button"
            onClick={onSaveSettings}
            disabled={!draftIsDirty || busySessionId === sandbox.id}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--ink-border)] px-2.5 py-1.5 text-xs disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" /> {draftIsDirty ? '保存设定' : '已保存'}
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-xs">
            <span className="text-[var(--ink-text-muted)]">跑团名称</span>
            <input
              value={draft.title}
              onChange={(event) => updateDraft(setDraft, 'title')(event.target.value)}
              className="w-full rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg)] px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-[var(--ink-text-muted)]">玩家角色</span>
            <input
              value={draft.playerCharacter}
              onChange={(event) => updateDraft(setDraft, 'playerCharacter')(event.target.value)}
              className="w-full rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg)] px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-xs md:col-span-2">
            <span className="text-[var(--ink-text-muted)]">场景 / 世界设定</span>
            <textarea
              rows={3}
              value={draft.scenario}
              onChange={(event) => updateDraft(setDraft, 'scenario')(event.target.value)}
              className="w-full resize-y rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg)] px-3 py-2 text-sm"
              placeholder="写下本次跑团独立使用的设定；不会自动读取作品世界观。"
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-[var(--ink-text-muted)]">AI 角色 / 主持人</span>
            <input
              value={draft.aiCharacter}
              onChange={(event) => updateDraft(setDraft, 'aiCharacter')(event.target.value)}
              className="w-full rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg)] px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-[var(--ink-text-muted)]">沙盒状态笔记</span>
            <textarea
              rows={2}
              value={draft.stateNotes}
              onChange={(event) => updateDraft(setDraft, 'stateNotes')(event.target.value)}
              className="w-full resize-y rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg)] px-3 py-2 text-sm"
              placeholder="记录只属于这次跑团的状态或约定。"
            />
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-card)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--ink-border)] px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">对话记录</h3>
            <p className="mt-0.5 text-[10px] text-[var(--ink-text-muted)]">
              每轮先保存用户消息，再请求 AI。
            </p>
          </div>
          {sandbox.turnStatus === 'running' && busySessionId === sandbox.id && (
            <span role="status" className="text-xs text-[var(--ink-accent)]">
              AI 正在回应…
            </span>
          )}
        </div>
        <div className="max-h-[52vh] min-h-44 space-y-3 overflow-y-auto p-4">
          {sandbox.messages.length === 0 ? (
            <p className="py-10 text-center text-xs text-[var(--ink-text-muted)]">
              开始一段独立、非正史的跑团对话。
            </p>
          ) : (
            sandbox.messages.map((message) => (
              <article
                key={message.id}
                className={`rounded-xl border p-3 ${
                  message.role === 'user'
                    ? 'ml-8 border-[var(--ink-border)] bg-[var(--ink-bg)]'
                    : 'mr-8 border-[var(--ink-accent)]/25 bg-[var(--ink-accent)]/5'
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold text-[var(--ink-text-muted)]">
                    {message.role === 'user' ? '玩家' : 'AI 跑团'}
                  </span>
                  {message.role === 'assistant' && (
                    <button
                      type="button"
                      onClick={() => onPromote(message)}
                      className="text-[10px] text-[var(--ink-accent)] hover:underline"
                    >
                      转为待审提案
                    </button>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.text}</p>
              </article>
            ))
          )}
          {hasInterruptedTurn && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <p role="status" className="text-xs text-amber-600">
                {sandbox.lastError || '上一轮未完成；用户消息仍已保存。'}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={onRetry}
                  disabled={!isAiAvailable || isBusy}
                  className="inline-flex items-center gap-1 rounded-md bg-[var(--ink-accent)] px-2.5 py-1.5 text-xs text-white disabled:opacity-50"
                >
                  <RotateCcw className="h-3 w-3" /> 重试本轮
                </button>
                <button
                  type="button"
                  onClick={onAbandon}
                  disabled={isBusy}
                  className="rounded-md border border-[var(--ink-border)] px-2.5 py-1.5 text-xs"
                >
                  放弃重试
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="border-t border-[var(--ink-border)] p-3">
          <textarea
            aria-label="输入跑团行动"
            rows={3}
            value={messageDraft}
            onChange={(event) => setMessageDraft(event.target.value)}
            disabled={sandbox.turnStatus !== 'ready' || isBusy}
            className="w-full resize-y rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg)] px-3 py-2 text-sm disabled:opacity-60"
            placeholder="描述玩家的行动或发言…"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] text-[var(--ink-text-muted)]">
              {!draft.scenario.trim()
                ? '请先填写并保存场景设定。'
                : isAiAvailable
                  ? '仅发送沙盒设定与最近对话。'
                  : 'AI 通道不可用；本地记录仍可查看和编辑。'}
            </span>
            <button
              type="button"
              onClick={onSend}
              disabled={
                !messageDraft.trim() ||
                !draft.scenario.trim() ||
                !isAiAvailable ||
                sandbox.turnStatus !== 'ready' ||
                isBusy
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--ink-accent)] px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" /> 发送回合
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
