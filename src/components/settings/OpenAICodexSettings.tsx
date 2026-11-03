import { useEffect, useRef, useState, type FC } from 'react'
import { ExternalLink, LoaderCircle, ShieldCheck, Unplug } from 'lucide-react'
import type { OpenAICodexAccountSummary, OpenAICodexConnection } from '@inkpi/protocol'
import type { OpenAICodexAssistant } from '../../ports/aiGateway'
import type { ThinkingLevel } from '../../core/settings'

interface OpenAICodexSettingsProps {
  assistant?: OpenAICodexAssistant
  onAddModel: (account: OpenAICodexAccountSummary, reasoningEffort: ThinkingLevel) => void
  onAccountCredentialStatusChange?: (accountId: string, configured: boolean) => void
}

const BUTTON =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] px-3 py-1.5 text-[12px] font-medium text-[var(--ink-text)] transition-colors hover:border-[var(--ink-accent)] hover:text-[var(--ink-accent)] disabled:cursor-not-allowed disabled:opacity-50'

const UNAVAILABLE_CONNECTION: OpenAICodexConnection = { available: false, accounts: [] }

const REASONING_EFFORTS: { value: ThinkingLevel; label: string }[] = [
  { value: 'none', label: '关闭' },
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'xhigh', label: '极高' },
]

export const OpenAICodexSettings: FC<OpenAICodexSettingsProps> = ({
  assistant,
  onAddModel,
  onAccountCredentialStatusChange,
}) => {
  const [connection, setConnection] = useState<OpenAICodexConnection | null>(null)
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [reasoningEffort, setReasoningEffort] = useState<ThinkingLevel>('medium')
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [pendingAccountId, setPendingAccountId] = useState<string | null>(null)
  const [busy, setBusy] = useState<'sign-in' | 'disconnect' | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const accountStatusCallback = useRef(onAccountCredentialStatusChange)
  const currentConnection = assistant ? connection : UNAVAILABLE_CONNECTION
  const selectedAccount = currentConnection?.accounts.find(
    (account) => account.accountId === selectedAccountId,
  )
  const accountConfigured = Boolean(selectedAccount?.connected && !selectedAccount.reauthRequired)

  useEffect(() => {
    accountStatusCallback.current = onAccountCredentialStatusChange
  }, [onAccountCredentialStatusChange])

  useEffect(() => {
    let active = true
    if (!assistant) return

    void assistant
      .getStatus()
      .then((status) => {
        if (!active) return
        setConnection(status)
        setSelectedAccountId((current) =>
          status.accounts.some((account) => account.accountId === current)
            ? current
            : (status.accounts[0]?.accountId ?? ''),
        )
      })
      .catch((error: unknown) => {
        if (active) setMessage(error instanceof Error ? error.message : '无法读取 Codex 连接状态。')
      })

    return () => {
      active = false
    }
  }, [assistant])

  useEffect(() => {
    if (!connection) return
    for (const account of connection.accounts) {
      accountStatusCallback.current?.(
        account.accountId,
        account.connected && !account.reauthRequired,
      )
    }
  }, [connection])

  useEffect(() => {
    if (!assistant || !attemptId) return
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined

    const poll = async () => {
      try {
        const status = await assistant.signInStatus({ attemptId })
        if (!active) return
        if (status.status === 'pending') {
          timer = setTimeout(() => void poll(), 700)
          return
        }

        setAttemptId(null)
        setPendingAccountId(null)
        if (status.status === 'connected') {
          setConnection((current) => {
            const previous = current ?? { available: true, accounts: [] }
            return {
              ...previous,
              accounts: [
                ...previous.accounts.filter(
                  (account) => account.accountId !== status.account.accountId,
                ),
                status.account,
              ],
            }
          })
          setSelectedAccountId(status.account.accountId)
          setMessage('Codex 账号已连接。GPT-6.1 Terra 路由与 ChatGPT 计划用量保持分离。')
        } else {
          setMessage(status.message)
        }
      } catch (error) {
        if (!active) return
        setAttemptId(null)
        setPendingAccountId(null)
        setMessage(error instanceof Error ? error.message : '无法读取 Codex 登录结果。')
      }
    }

    void poll()
    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [assistant, attemptId])

  const startSignIn = async (accountId?: string) => {
    if (!assistant || busy || attemptId) return
    setBusy('sign-in')
    setPendingAccountId(accountId ?? null)
    setMessage(null)
    let started = false
    try {
      const attempt = await assistant.startSignIn(accountId ? { accountId } : {})
      started = true
      setAttemptId(attempt.attemptId)
      await assistant.openAuthorizationUrl(attempt.authorizationUrl)
    } catch (error) {
      if (!started) setPendingAccountId(null)
      setMessage(error instanceof Error ? error.message : '无法打开 OpenAI Codex 登录页面。')
    } finally {
      setBusy(null)
    }
  }

  const disconnect = async () => {
    if (!assistant || !selectedAccount || busy) return
    const accountId = selectedAccount.accountId
    const nextAccount = currentConnection?.accounts.find(
      (account) => account.accountId !== accountId,
    )
    setBusy('disconnect')
    setMessage(null)
    try {
      const result = await assistant.disconnect({ accountId })
      accountStatusCallback.current?.(accountId, false)
      setConnection((current) =>
        current
          ? {
              ...current,
              accounts: current.accounts.filter((account) => account.accountId !== accountId),
            }
          : current,
      )
      setSelectedAccountId((current) =>
        current === accountId ? (nextAccount?.accountId ?? '') : current,
      )
      setMessage(
        result.remoteRevocationConfirmed
          ? 'Codex 账号已从 InkPi 断开，OpenAI 已确认撤销授权。'
          : 'Codex 账号已从 InkPi 本机断开；OpenAI 未确认远端撤销。',
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '无法断开 Codex 账号。')
    } finally {
      setBusy(null)
    }
  }

  const signInPendingFor = (accountId: string | null) =>
    (busy === 'sign-in' || attemptId !== null) && pendingAccountId === accountId

  return (
    <section className="space-y-3 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-[var(--ink-text)]">OpenAI Codex 账号</h3>
          <p className="mt-1 max-w-2xl text-[11.5px] leading-5 text-[var(--ink-text-muted)]">
            使用独立的 Codex 登录凭据，不读取 ChatGPT 计划用量授权，也不与 ChatGPT
            计划账号共享路由。令牌由 Runtime 管理，不会显示或保存为 API Key。
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--ink-border)] px-2.5 py-1 text-[10.5px] text-[var(--ink-text-muted)]">
          <ShieldCheck className="h-3.5 w-3.5" />
          {selectedAccount
            ? selectedAccount.reauthRequired
              ? '需要重新授权'
              : selectedAccount.connected
                ? 'Codex 已连接'
                : '未连接'
            : currentConnection?.available
              ? '未连接'
              : currentConnection
                ? 'Runtime 不可用'
                : '检查连接状态'}
        </span>
      </div>

      {currentConnection && currentConnection.accounts.length > 0 && (
        <label className="flex max-w-xl flex-col gap-1 text-[11.5px] text-[var(--ink-text-muted)]">
          选择 Codex 账号
          <select
            aria-label="Codex 账号"
            value={selectedAccountId}
            onChange={(event) => setSelectedAccountId(event.currentTarget.value)}
            disabled={busy !== null || attemptId !== null}
            className="rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] px-2.5 py-1.5 text-[12px] text-[var(--ink-text)]"
          >
            {currentConnection.accounts.map((account) => (
              <option key={account.accountId} value={account.accountId}>
                {formatAccountLabel(account)}
              </option>
            ))}
          </select>
        </label>
      )}

      {selectedAccount && (
        <p className="text-[12px] text-[var(--ink-text)]">
          {selectedAccount.email || selectedAccount.name || `账号 ${selectedAccount.accountId}`}
        </p>
      )}

      <div className="rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[12px] font-semibold text-[var(--ink-text)]">
              GPT-6.1 Terra · Codex 路由
            </div>
            <p className="mt-1 text-[11px] leading-5 text-[var(--ink-text-muted)]">
              此路由使用所选 Codex 账号的独立授权；不会改变 OpenAI Responses / Azure Responses 的
              API Key 路由。
            </p>
          </div>
          <label className="flex items-center gap-2 text-[11.5px] text-[var(--ink-text-muted)]">
            思考档位
            <select
              aria-label="Codex 思考档位"
              value={reasoningEffort}
              onChange={(event) => setReasoningEffort(event.currentTarget.value as ThinkingLevel)}
              disabled={!accountConfigured || busy !== null || attemptId !== null}
              className="rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] px-2.5 py-1.5 text-[12px] text-[var(--ink-text)]"
            >
              {REASONING_EFFORTS.map((effort) => (
                <option key={effort.value} value={effort.value}>
                  {effort.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          className={`${BUTTON} mt-3`}
          onClick={() => selectedAccount && onAddModel(selectedAccount, reasoningEffort)}
          disabled={!selectedAccount || !accountConfigured || busy !== null || attemptId !== null}
        >
          添加或更新此账号的 GPT-6.1 Terra 路由
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={BUTTON}
          onClick={() => void startSignIn()}
          disabled={
            !assistant || !currentConnection?.available || busy !== null || attemptId !== null
          }
        >
          {signInPendingFor(null) ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ExternalLink className="h-3.5 w-3.5" />
          )}
          {currentConnection?.accounts.length ? '添加 Codex 账号' : '连接 Codex 账号'}
        </button>

        {selectedAccount && (
          <>
            <button
              type="button"
              className={BUTTON}
              onClick={() => void startSignIn(selectedAccount.accountId)}
              disabled={
                !assistant || !currentConnection?.available || busy !== null || attemptId !== null
              }
            >
              {signInPendingFor(selectedAccount.accountId) ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ExternalLink className="h-3.5 w-3.5" />
              )}
              {selectedAccount.reauthRequired || !selectedAccount.connected
                ? '重新连接所选账号'
                : '重新授权所选账号'}
            </button>
            <button
              type="button"
              className={BUTTON}
              onClick={() => void disconnect()}
              disabled={busy !== null || attemptId !== null}
            >
              {busy === 'disconnect' ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Unplug className="h-3.5 w-3.5" />
              )}
              断开所选 Codex 账号
            </button>
          </>
        )}
      </div>

      {attemptId && (
        <p role="status" className="text-[11.5px] text-[var(--ink-text-muted)]">
          正在等待 OpenAI 完成 Codex 授权。完成后此处会更新连接状态。
        </p>
      )}
      {message && (
        <p role="status" className="text-[11.5px] leading-5 text-[var(--ink-text-muted)]">
          {message}
        </p>
      )}
    </section>
  )
}

function formatAccountLabel(account: OpenAICodexAccountSummary): string {
  const label = account.email || account.name || account.accountId
  const state = account.reauthRequired ? '需要重新授权' : account.connected ? '已连接' : '未连接'
  return `${label} · ${state}`
}
