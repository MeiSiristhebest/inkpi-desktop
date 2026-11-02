import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { clock } from '../../../adapters/clock'
import { distillationReviewInbox } from '../../../ai/proposals/distillationReviewInbox'
import type {
  DistillationAcceptOverrides,
  DistillationItem,
} from '../../../ai/proposals/distillationReviewInbox'
import { requireTextResult } from '../../../ai/results/taskResults'
import {
  EMPTY_ROLEPLAY_DRAFT,
  createRoleplayTaskForTurn,
  isRoleplayDraftEqual,
  roleplayDraftFromSession,
  type RoleplayDraft,
} from '../../../domain/roleplay/roleplaySandboxModel'
import type { RoleplayMessage, RoleplaySession } from '../../../domain/roleplay/roleplaySession'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { roleplaySandboxService } from '../../../services/roleplaySandboxService'

export interface RoleplaySandboxController {
  sessions: RoleplaySession[]
  selectedSession: RoleplaySession | undefined
  selectedSessionId: string | null
  selectSession: (sandbox: RoleplaySession) => void
  createSession: () => Promise<void>
  draft: RoleplayDraft
  setDraft: Dispatch<SetStateAction<RoleplayDraft>>
  draftIsDirty: boolean
  saveDraft: (sandbox?: RoleplaySession) => Promise<RoleplaySession | undefined>
  messageDraft: string
  setMessageDraft: Dispatch<SetStateAction<string>>
  pendingProposals: DistillationItem[]
  loading: boolean
  busySessionId: string | null
  isAiAvailable: boolean
  sendTurn: () => Promise<void>
  retryTurn: (sandbox: RoleplaySession) => Promise<void>
  abandonTurn: (sandbox: RoleplaySession) => Promise<void>
  reviewOpen: boolean
  setReviewOpen: Dispatch<SetStateAction<boolean>>
  promotionMessage: RoleplayMessage | null
  dismissPromotion: () => void
  proposalTitle: string
  setProposalTitle: Dispatch<SetStateAction<string>>
  proposalSummary: string
  setProposalSummary: Dispatch<SetStateAction<string>>
  openPromotion: (message: RoleplayMessage) => void
  promoteMessage: () => Promise<void>
  acceptProposal: (itemId: string, overrides?: DistillationAcceptOverrides) => Promise<void>
  rejectProposal: (itemId: string) => Promise<void>
  notice: string | null
  error: string | null
}

const isRoleplayProposal = (item: DistillationItem) => item.taskId.startsWith('roleplay:')

export function useRoleplaySandboxController(projectId: string): RoleplaySandboxController {
  const hostContext = useOptionalPluginHostContext()
  const aiAssistant = hostContext?.projectId === projectId ? hostContext.aiAssistant : undefined
  const [sessions, setSessions] = useState<RoleplaySession[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [draft, setDraft] = useState<RoleplayDraft>(EMPTY_ROLEPLAY_DRAFT)
  const [messageDraft, setMessageDraft] = useState('')
  const [pendingProposals, setPendingProposals] = useState<DistillationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busySessionId, setBusySessionId] = useState<string | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [promotionMessage, setPromotionMessage] = useState<RoleplayMessage | null>(null)
  const [proposalTitle, setProposalTitle] = useState('')
  const [proposalSummary, setProposalSummary] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedSession = useMemo(
    () => sessions.find((sandbox) => sandbox.id === selectedSessionId),
    [sessions, selectedSessionId],
  )
  const draftIsDirty = selectedSession ? !isRoleplayDraftEqual(selectedSession, draft) : false
  const isAiAvailable = aiAssistant?.isAvailable === true

  const refreshProposals = useCallback(() => {
    setPendingProposals(distillationReviewInbox.listPending(projectId).filter(isRoleplayProposal))
  }, [projectId])

  const upsertSession = useCallback((sandbox: RoleplaySession) => {
    setSessions((current) =>
      [sandbox, ...current.filter((item) => item.id !== sandbox.id)].sort(
        (a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id),
      ),
    )
  }, [])

  useEffect(() => {
    let active = true
    Promise.all([
      roleplaySandboxService.listSessions(projectId),
      distillationReviewInbox.restoreFromStorage(projectId),
    ])
      .then(([loaded]) => {
        if (!active) return
        setSessions(loaded)
        setSelectedSessionId(loaded[0]?.id ?? null)
        setDraft(loaded[0] ? roleplayDraftFromSession(loaded[0]) : EMPTY_ROLEPLAY_DRAFT)
        setPendingProposals(
          distillationReviewInbox.listPending(projectId).filter(isRoleplayProposal),
        )
      })
      .catch(() => {
        if (active) setError('读取本地跑团记录失败。')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [projectId])

  const createSession = async () => {
    setError(null)
    try {
      const sandbox = await roleplaySandboxService.createSession(projectId)
      upsertSession(sandbox)
      setSelectedSessionId(sandbox.id)
      setDraft(roleplayDraftFromSession(sandbox))
      setMessageDraft('')
      setNotice('新跑团已保存在本地；填写场景设定后即可开始。')
    } catch {
      setError('创建本地跑团失败。')
    }
  }

  const selectSession = (sandbox: RoleplaySession) => {
    setSelectedSessionId(sandbox.id)
    setDraft(roleplayDraftFromSession(sandbox))
    setMessageDraft('')
    setError(null)
  }

  const saveDraft = async (sandbox = selectedSession): Promise<RoleplaySession | undefined> => {
    if (!sandbox) return undefined
    setError(null)
    const updated: RoleplaySession = {
      ...sandbox,
      title: draft.title.trim() || '未命名跑团',
      scenario: draft.scenario,
      playerCharacter: draft.playerCharacter,
      aiCharacter: draft.aiCharacter,
      stateNotes: draft.stateNotes,
      revision: sandbox.revision + 1,
      updatedAt: clock.now(),
    }
    try {
      await roleplaySandboxService.saveSession(updated)
      upsertSession(updated)
      setDraft(roleplayDraftFromSession(updated))
      return updated
    } catch {
      setError('保存沙盒设定失败。')
      return undefined
    }
  }

  const executePendingTurn = async (sandbox: RoleplaySession) => {
    const taskId = sandbox.pendingTurnId
    if (!taskId) return
    try {
      if (!aiAssistant) throw new Error('AI channel is unavailable.')
      const result = await aiAssistant.runTask(createRoleplayTaskForTurn(sandbox, projectId))
      if (!result) throw new Error('No task result.')
      const text = requireTextResult(result)
      const completed = await roleplaySandboxService.completeTurn(
        projectId,
        sandbox.id,
        taskId,
        text,
      )
      upsertSession(completed)
      setNotice('本轮回复已保存在本地跑团中；它不会自动写入作品正史。')
    } catch {
      try {
        const failed = await roleplaySandboxService.failTurn(projectId, sandbox.id, taskId)
        upsertSession(failed)
      } catch {
        // Keep the already-persisted user message recoverable if recording the failure also fails.
      }
      setError('本轮生成未完成。对话已保留，可检查连接后重试；作品正史未被修改。')
    }
  }

  const sendTurn = async () => {
    const sandbox = selectedSession
    const text = messageDraft.trim()
    if (!sandbox || !text || busySessionId || !isAiAvailable || !draft.scenario.trim()) return
    setError(null)
    setNotice(null)
    setBusySessionId(sandbox.id)
    try {
      const configured = draftIsDirty ? await saveDraft(sandbox) : sandbox
      if (!configured) return
      const pending = await roleplaySandboxService.beginTurn(projectId, configured.id, text)
      upsertSession(pending)
      setMessageDraft('')
      await executePendingTurn(pending)
    } catch {
      setError('保存或开始本轮失败；请重试。作品正史未被修改。')
    } finally {
      setBusySessionId(null)
    }
  }

  const retryTurn = async (sandbox: RoleplaySession) => {
    if (busySessionId || !isAiAvailable) return
    setError(null)
    setBusySessionId(sandbox.id)
    try {
      const pending = await roleplaySandboxService.retryPendingTurn(projectId, sandbox.id)
      upsertSession(pending)
      await executePendingTurn(pending)
    } catch {
      setError('重试失败；未完成的用户回合仍保留在本地。')
    } finally {
      setBusySessionId(null)
    }
  }

  const abandonTurn = async (sandbox: RoleplaySession) => {
    if (busySessionId) return
    try {
      const ready = await roleplaySandboxService.abandonPendingTurn(projectId, sandbox.id)
      upsertSession(ready)
      setError(null)
      setNotice('已保留未完成的用户消息，并放弃本次重试。')
    } catch {
      setError('无法放弃该回合，请刷新后重试。')
    }
  }

  const openPromotion = (message: RoleplayMessage) => {
    const existing = pendingProposals.find(
      (item) => item.taskId === `roleplay:${selectedSession?.id}:${message.id}`,
    )
    if (existing) {
      setReviewOpen(true)
      return
    }
    setProposalTitle('跑团场景提案')
    setProposalSummary(message.text)
    setPromotionMessage(message)
  }

  const promoteMessage = async () => {
    if (!selectedSession || !promotionMessage) return
    setError(null)
    try {
      const item = await distillationReviewInbox.ingestRoleplayEventCandidate({
        workspaceId: projectId,
        sessionId: selectedSession.id,
        messageId: promotionMessage.id,
        name: proposalTitle,
        summary: proposalSummary,
      })
      setPendingProposals((current) => [item, ...current])
      setPromotionMessage(null)
      setReviewOpen(true)
      setNotice('已送入提案审查；接受前不会写入作品正史。')
    } catch {
      setError('创建待审提案失败；沙盒对话没有改变。')
    }
  }

  const acceptProposal = async (itemId: string, overrides?: DistillationAcceptOverrides) => {
    await distillationReviewInbox.accept(itemId, overrides)
    refreshProposals()
  }

  const rejectProposal = async (itemId: string) => {
    await distillationReviewInbox.reject(itemId)
    refreshProposals()
  }

  return {
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
    dismissPromotion: () => setPromotionMessage(null),
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
  }
}
