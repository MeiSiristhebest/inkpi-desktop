import { useEffect, useRef, useState, type FC } from 'react'
import { ExternalLink, LoaderCircle, RefreshCw, ShieldCheck, Unplug } from 'lucide-react'
import type {
  OpenAIChatGPTPlanAccountSummary,
  OpenAIChatGPTPlanConnection,
  OpenAIChatGPTPlanModel,
} from '@inkpi/protocol'
import type { ChatGPTPlanAssistant } from '../../ports/aiGateway'

interface ChatGPTPlanSettingsProps {
  assistant?: ChatGPTPlanAssistant
  onAddModel: (model: OpenAIChatGPTPlanModel) => void
  onAccountUsageStatusChange?: (accountId: string, enabled: boolean) => void
}

const BUTTON =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] px-3 py-1.5 text-[12px] font-medium text-[var(--ink-text)] transition-colors hover:border-[var(--ink-accent)] hover:text-[var(--ink-accent)] disabled:cursor-not-allowed disabled:opacity-50'

export const ChatGPTPlanSettings: FC<ChatGPTPlanSettingsProps> = ({
  assistant,
  onAddModel,
  onAccountUsageStatusChange,
}) => {
  const [connection, setConnection] = useState<OpenAIChatGPTPlanConnection | null>(null)
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [planUsageConsent, setPlanUsageConsent] = useState(false)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [pendingAccountId, setPendingAccountId] = useState<string | null>(null)
  const [busy, setBusy] = useState<'sign-in' | 'models' | 'disconnect' | null>(null)
  const [models, setModels] = useState<OpenAIChatGPTPlanModel[]>([])
  const [selectedModelId, setSelectedModelId] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const usageStatusCallback = useRef(onAccountUsageStatusChange)
  const selectedAccount = connection?.accounts.find(
    (account) => account.accountId === selectedAccountId,
  )
  const planUsageEnabled = Boolean(
    selectedAccount?.connected && selectedAccount.sharing && !selectedAccount.reauthRequired,
  )

  useEffect(() => {
    usageStatusCallback.current = onAccountUsageStatusChange
  }, [onAccountUsageStatusChange])

  useEffect(() => {
    let active = true
    if (!assistant) {
      setConnection({ available: false, accounts: [] })
      setSelectedAccountId('')
      return () => {
        active = false
      }
    }

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
        const initialAccount =
          status.accounts.find((account) => account.accountId === selectedAccountId) ??
          status.accounts[0]
        setPlanUsageConsent(initialAccount?.sharing ?? false)
      })
      .catch((error: unknown) => {
        if (active)
          setMessage(error instanceof Error ? error.message : '无法读取 ChatGPT 连接状态。')
      })

    return () => {
      active = false
    }
  }, [assistant])

  useEffect(() => {
    if (!connection) return
    for (const account of connection.accounts) {
      usageStatusCallback.current?.(
        account.accountId,
        account.connected && account.sharing && !account.reauthRequired,
      )
    }
  }, [connection])

  useEffect(() => {
    if (selectedAccount) {
      setPlanUsageConsent(selectedAccount.sharing)
    } else if (connection?.accounts.length === 0) {
      setPlanUsageConsent(false)
    }
  }, [connection?.accounts.length, selectedAccount?.accountId, selectedAccount?.sharing])

  useEffect(() => {
    let active = true
    setModels([])
    setSelectedModelId('')
    if (
      !assistant ||
      !selectedAccount ||
      !selectedAccount.connected ||
      !selectedAccount.sharing ||
      selectedAccount.reauthRequired
    ) {
      return () => {
        active = false
      }
    }

    void assistant
      .listModels({ accountId: selectedAccount.accountId })
      .then((catalog) => {
        if (!active) return
        setModels(catalog)
        setSelectedModelId((current) =>
          catalog.some((model) => model.id === current) ? current : (catalog[0]?.id ?? ''),
        )
      })
      .catch((error: unknown) => {
        if (active)
          setMessage(error instanceof Error ? error.message : '无法读取 ChatGPT 模型列表。')
      })

    return () => {
      active = false
    }
  }, [
    assistant,
    selectedAccount?.accountId,
    selectedAccount?.connected,
    selectedAccount?.sharing,
    selectedAccount?.reauthRequired,
  ])

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
          setPlanUsageConsent(status.account.sharing)
          if (status.account.sharing) {
            setMessage('ChatGPT 账号已连接。选择可用模型后添加到 AI 服务。')
          } else {
            setModels([])
            setSelectedModelId('')
            setMessage('账号已连接；计划用量未获授权，InkPi 不会用计划额度发送模型请求。')
          }
        } else {
          setMessage(status.message)
        }
      } catch (error) {
        if (!active) return
        setAttemptId(null)
        setPendingAccountId(null)
        setMessage(error instanceof Error ? error.message : '无法读取 ChatGPT 登录结果。')
      }
    }

    void poll()
    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [assistant, attemptId])

  const refreshModels = async () => {
    if (!assistant || !selectedAccount || !planUsageEnabled) return
    setBusy('models')
    setMessage(null)
    try {
      const catalog = await assistant.listModels({ accountId: selectedAccount.accountId })
      setModels(catalog)
      setSelectedModelId((current) =>
        catalog.some((model) => model.id === current) ? current : (catalog[0]?.id ?? ''),
      )
      setMessage(catalog.length > 0 ? '模型列表已更新。' : '当前账号没有可列出的模型。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '无法读取模型列表。')
    } finally {
      setBusy(null)
    }
  }

  const startSignIn = async (accountId?: string) => {
    if (!assistant || busy || attemptId) return
    setBusy('sign-in')
    setPendingAccountId(accountId ?? null)
    setMessage(null)
    let started = false
    try {
      const attempt = await assistant.startSignIn({
        ...(accountId ? { accountId } : {}),
        enablePlanUsage: planUsageConsent,
      })
      started = true
      setAttemptId(attempt.attemptId)
      await assistant.openAuthorizationUrl(attempt.authorizationUrl)
    } catch (error) {
      if (!started) setPendingAccountId(null)
      setMessage(error instanceof Error ? error.message : '无法打开 ChatGPT 登录页面。')
    } finally {
      setBusy(null)
    }
  }

  const openUsageSettings = async () => {
    if (!assistant) return
    try {
      await assistant.openUsageSettings()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '无法打开 OpenAI 用量设置。')
    }
  }

  const disconnect = async () => {
    if (!assistant || !selectedAccount || busy) return
    const accountId = selectedAccount.accountId
    const nextAccount = connection?.accounts.find((account) => account.accountId !== accountId)
    setBusy('disconnect')
    setMessage(null)
    try {
      const result = await assistant.disconnect({ accountId })
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
      setModels([])
      setSelectedModelId('')
      usageStatusCallback.current?.(accountId, false)
      setMessage(
        result.remoteRevocationConfirmed
          ? '账号已从 InkPi 断开，OpenAI 已确认撤销授权。'
          : '账号已从 InkPi 本机断开；OpenAI 未确认远端撤销。',
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '无法断开 ChatGPT 账号。')
    } finally {
      setBusy(null)
    }
  }

  const accountLabel = selectedAccount?.email || selectedAccount?.name
  const signInPendingFor = (accountId: string | null) =>
    (busy === 'sign-in' || attemptId !== null) && pendingAccountId === accountId

  return (
    <section className="space-y-3 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-[var(--ink-text)]">ChatGPT 账号</h3>
          <p className="mt-1 max-w-2xl text-[11.5px] leading-5 text-[var(--ink-text-muted)]">
            使用 OpenAI 的 Sign in with
            ChatGPT。每个账号分别保存客户端注册和凭据；账号连接与计划用量授权分开管理。 InkPi
            不读取或保存 OpenAI API Key。
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--ink-border)] px-2.5 py-1 text-[10.5px] text-[var(--ink-text-muted)]">
          <ShieldCheck className="h-3.5 w-3.5" />
          {selectedAccount
            ? selectedAccount.reauthRequired
              ? '需要重新授权'
              : selectedAccount.connected
                ? planUsageEnabled
                  ? '计划用量已授权'
                  : '仅连接账号'
                : '未连接'
            : connection?.available
              ? '未连接'
              : connection
                ? 'Runtime 不可用'
                : '检查连接状态'}
        </span>
      </div>

      {connection && connection.accounts.length > 0 && (
        <label className="flex max-w-xl flex-col gap-1 text-[11.5px] text-[var(--ink-text-muted)]">
          选择账号
          <select
            aria-label="ChatGPT 账号"
            value={selectedAccountId}
            onChange={(event) => setSelectedAccountId(event.currentTarget.value)}
            disabled={busy !== null || attemptId !== null}
            className="rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] px-2.5 py-1.5 text-[12px] text-[var(--ink-text)]"
          >
            {connection.accounts.map((account) => (
              <option key={account.accountId} value={account.accountId}>
                {formatAccountLabel(account)}
              </option>
            ))}
          </select>
        </label>
      )}

      {selectedAccount && (
        <p className="text-[12px] text-[var(--ink-text)]">
          {accountLabel ? `已选择：${accountLabel}` : `账号 ${selectedAccount.accountId}`}
        </p>
      )}

      <label className="flex cursor-pointer items-start gap-2 text-[11.5px] leading-5 text-[var(--ink-text-muted)]">
        <input
          type="checkbox"
          checked={planUsageConsent}
          onChange={(event) => setPlanUsageConsent(event.currentTarget.checked)}
          className="mt-1 accent-[var(--ink-accent)]"
          disabled={!connection?.available || busy !== null || attemptId !== null}
        />
        <span>
          允许下一次授权的账号将模型请求发送到 OpenAI Responses API 并使用我的 ChatGPT 计划用量。
          OpenAI 会在授权页面单独确认此权限。
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={BUTTON}
          onClick={() => void startSignIn()}
          disabled={!assistant || !connection?.available || busy !== null || attemptId !== null}
        >
          {signInPendingFor(null) ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ExternalLink className="h-3.5 w-3.5" />
          )}
          {connection?.accounts.length ? '添加账号' : '连接账号'}
        </button>

        {selectedAccount && (
          <button
            type="button"
            className={BUTTON}
            onClick={() => void startSignIn(selectedAccount.accountId)}
            disabled={!assistant || !connection?.available || busy !== null || attemptId !== null}
          >
            {signInPendingFor(selectedAccount.accountId) ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ExternalLink className="h-3.5 w-3.5" />
            )}
            {selectedAccount.reauthRequired || !selectedAccount.connected
              ? '重新连接所选账号'
              : planUsageEnabled === planUsageConsent
                ? '重新授权所选账号'
                : planUsageConsent
                  ? '为所选账号授权计划用量'
                  : '关闭所选账号的计划用量'}
          </button>
        )}

        {planUsageEnabled && selectedAccount && (
          <>
            <select
              aria-label="ChatGPT 计划模型"
              value={selectedModelId}
              onChange={(event) => setSelectedModelId(event.currentTarget.value)}
              disabled={models.length === 0 || busy !== null}
              className="min-w-48 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] px-2.5 py-1.5 text-[12px] text-[var(--ink-text)]"
            >
              {models.length === 0 ? (
                <option value="">没有可用模型</option>
              ) : (
                models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} ({model.id})
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              className={BUTTON}
              onClick={() => void refreshModels()}
              disabled={busy !== null}
              aria-label="刷新 ChatGPT 模型列表"
            >
              <RefreshCw
                className={busy === 'models' ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'}
              />
              刷新模型
            </button>
            <button
              type="button"
              className={BUTTON}
              onClick={() => {
                const model = models.find((item) => item.id === selectedModelId)
                if (model) onAddModel(model)
              }}
              disabled={!selectedModelId || busy !== null}
            >
              添加所选账号模型
            </button>
            <button type="button" className={BUTTON} onClick={() => void openUsageSettings()}>
              查看用量设置
            </button>
          </>
        )}

        {selectedAccount && (
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
            断开所选账号
          </button>
        )}
      </div>

      {attemptId && (
        <p role="status" className="text-[11.5px] text-[var(--ink-text-muted)]">
          正在等待 ChatGPT 完成授权。完成后此处会更新连接状态。
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

function formatAccountLabel(account: OpenAIChatGPTPlanAccountSummary): string {
  const label = account.email || account.name || account.accountId
  const state = account.reauthRequired
    ? '需要重新授权'
    : account.connected
      ? account.sharing
        ? '计划用量已授权'
        : '仅连接'
      : '未连接'
  return `${label} · ${state}`
}
