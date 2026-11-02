import { MessageCircle, Plus, ShieldCheck } from 'lucide-react'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { DistillationInboxModal } from '../../../components/ai/DistillationInboxModal'
import { Modal } from '../../../ui/molecules/Modal'
import { RoleplaySessionPanel } from './RoleplaySessionPanel'
import { useRoleplaySandboxController } from '../hooks/useRoleplaySandboxController'

export const RoleplaySandboxView = ({ projectId }: { projectId: string }) => (
  <RoleplaySandboxProjectView key={projectId} projectId={projectId} />
)

const RoleplaySandboxProjectView = ({ projectId }: { projectId: string }) => {
  const hostContext = useOptionalPluginHostContext()
  const sandbox = useRoleplaySandboxController(projectId)
  const {
    sessions,
    selectedSession,
    selectedSessionId,
    selectSession,
    createSession,
    draft,
    setDraft,
    draftIsDirty,
    saveDraft,
    messageDraft,
    setMessageDraft,
    pendingProposals,
    loading,
    busySessionId,
    isAiAvailable,
    sendTurn,
    retryTurn,
    abandonTurn,
    reviewOpen,
    setReviewOpen,
    promotionMessage,
    dismissPromotion,
    proposalTitle,
    setProposalTitle,
    proposalSummary,
    setProposalSummary,
    openPromotion,
    promoteMessage,
    acceptProposal,
    rejectProposal,
    notice,
    error,
  } = sandbox

  return (
    <section className="mx-auto max-w-6xl space-y-5 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-[var(--ink-accent)]" />
            <h2 className="text-lg font-semibold">AI 跑团沙盒</h2>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[var(--ink-text-muted)]">
            本地保存、可恢复的非正史对话。AI
            只收到当前沙盒设定与对话，不自动附带章节或项目世界观；选中的片段也必须经过提案审查后才会进入作品。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setReviewOpen(true)}
            disabled={pendingProposals.length === 0}
            className="rounded-lg border border-[var(--ink-border)] px-3 py-2 text-xs text-[var(--ink-text)] disabled:opacity-50"
          >
            待审提案（{pendingProposals.length}）
          </button>
          <button
            type="button"
            onClick={() => void createSession()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--ink-accent)] px-3 py-2 text-xs font-medium text-white"
          >
            <Plus className="h-3.5 w-3.5" /> 新建跑团
          </button>
        </div>
      </header>

      <div className="flex items-start gap-4 max-lg:flex-col">
        <aside className="w-full shrink-0 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-card)] p-3 lg:w-64">
          <h3 className="px-2 pb-2 text-xs font-semibold text-[var(--ink-text-muted)]">
            本作品的跑团
          </h3>
          {loading ? (
            <p className="px-2 py-4 text-xs text-[var(--ink-text-muted)]">读取中…</p>
          ) : sessions.length === 0 ? (
            <p className="px-2 py-4 text-xs text-[var(--ink-text-muted)]">尚无跑团记录。</p>
          ) : (
            <div className="space-y-1">
              {sessions.map((sandbox) => (
                <button
                  key={sandbox.id}
                  type="button"
                  onClick={() => selectSession(sandbox)}
                  className={`w-full rounded-lg px-2.5 py-2 text-left text-xs ${
                    selectedSessionId === sandbox.id
                      ? 'bg-[var(--ink-accent)]/15 text-[var(--ink-accent)]'
                      : 'text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)]'
                  }`}
                >
                  <span className="block truncate font-medium">
                    {sandbox.title || '未命名跑团'}
                  </span>
                  <span className="mt-1 block text-[10px] text-[var(--ink-text-muted)]">
                    {sandbox.messages.length} 条消息 ·{' '}
                    {sandbox.turnStatus === 'interrupted'
                      ? '待恢复'
                      : sandbox.turnStatus === 'failed'
                        ? '生成失败'
                        : '已保存'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </aside>

        {selectedSession ? (
          <RoleplaySessionPanel
            sandbox={selectedSession}
            draft={draft}
            setDraft={setDraft}
            draftIsDirty={draftIsDirty}
            messageDraft={messageDraft}
            setMessageDraft={setMessageDraft}
            busySessionId={busySessionId}
            isAiAvailable={isAiAvailable}
            onSaveSettings={() => void saveDraft(selectedSession)}
            onSend={() => void sendTurn()}
            onRetry={() => void retryTurn(selectedSession)}
            onAbandon={() => void abandonTurn(selectedSession)}
            onPromote={openPromotion}
          />
        ) : (
          <div className="min-w-0 flex-1 rounded-xl border border-dashed border-[var(--ink-border)] bg-[var(--ink-bg-card)] p-8 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-[var(--ink-accent)]" />
            <p className="mt-3 text-sm font-medium">开始一个可恢复的跑团沙盒</p>
            <p className="mt-1 text-xs text-[var(--ink-text-muted)]">
              内容只保存在当前作品的沙盒记录中，不直接更改正史。
            </p>
            <button
              type="button"
              onClick={() => void createSession()}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--ink-accent)] px-3 py-2 text-xs text-white"
            >
              <Plus className="h-3.5 w-3.5" /> 新建跑团
            </button>
          </div>
        )}
      </div>

      {notice && (
        <p role="status" className="text-xs text-[var(--ink-text-muted)]">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-500">
          {error}
        </p>
      )}

      {promotionMessage && (
        <Modal onClose={dismissPromotion} ariaLabelledBy="roleplay-proposal-title">
          <div className="w-full max-w-xl space-y-4 p-5">
            <div>
              <h2 id="roleplay-proposal-title" className="text-base font-semibold">
                创建待审提案
              </h2>
              <p className="mt-1 text-xs text-[var(--ink-text-muted)]">
                这是从沙盒中手动选出的片段。提交后仍须在审查箱中明确采纳，才会写入作品。
              </p>
            </div>
            <label className="block space-y-1 text-xs">
              <span>提案标题</span>
              <input
                value={proposalTitle}
                onChange={(event) => setProposalTitle(event.target.value)}
                className="w-full rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg)] px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1 text-xs">
              <span>候选事件 / 摘要</span>
              <textarea
                rows={6}
                value={proposalSummary}
                onChange={(event) => setProposalSummary(event.target.value)}
                className="w-full resize-y rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg)] px-3 py-2 text-sm"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={dismissPromotion}
                className="rounded-lg border border-[var(--ink-border)] px-3 py-2 text-xs"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void promoteMessage()}
                disabled={!proposalTitle.trim() || !proposalSummary.trim()}
                className="rounded-lg bg-[var(--ink-accent)] px-3 py-2 text-xs text-white disabled:opacity-50"
              >
                加入提案审查
              </button>
            </div>
          </div>
        </Modal>
      )}

      {reviewOpen && (
        <DistillationInboxModal
          items={pendingProposals}
          onAccept={acceptProposal}
          onReject={rejectProposal}
          sourceChapters={
            hostContext?.projectId === projectId
              ? hostContext.bookHierarchy.chapters.map(({ id, revision, title }) => ({
                  id,
                  revision,
                  title,
                }))
              : []
          }
          onClose={() => setReviewOpen(false)}
        />
      )}
    </section>
  )
}
