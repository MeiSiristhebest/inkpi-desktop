import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { OpenAICodexAccountSummary } from '@inkpi/protocol'
import type { OpenAICodexAssistant } from '../../ports/aiGateway'
import { OpenAICodexSettings } from './OpenAICodexSettings'

const accountA: OpenAICodexAccountSummary = {
  accountId: 'codex-account-a',
  email: 'codex@example.test',
  connected: true,
  reauthRequired: false,
}

function createAssistant(overrides: Partial<OpenAICodexAssistant> = {}): OpenAICodexAssistant {
  return {
    getStatus: vi.fn().mockResolvedValue({ available: true, accounts: [accountA] }),
    startSignIn: vi.fn().mockResolvedValue({
      attemptId: 'codex-attempt',
      authorizationUrl: 'https://auth.openai.com/api/accounts/authorize?client_id=dynamic',
    }),
    signInStatus: vi.fn().mockResolvedValue({ status: 'pending' }),
    disconnect: vi.fn(async ({ accountId }) => ({ accountId, remoteRevocationConfirmed: true })),
    openAuthorizationUrl: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe('OpenAICodexSettings account isolation', () => {
  it('adds the selected account route with a configurable per-turn reasoning effort', async () => {
    const assistant = createAssistant()
    const onAddModel = vi.fn()
    const onAccountCredentialStatusChange = vi.fn()
    render(
      <OpenAICodexSettings
        assistant={assistant}
        onAddModel={onAddModel}
        onAccountCredentialStatusChange={onAccountCredentialStatusChange}
      />,
    )

    await screen.findByText('GPT-6.1 Terra · Codex 路由')
    fireEvent.change(screen.getByRole('combobox', { name: 'Codex 思考档位' }), {
      target: { value: 'high' },
    })
    fireEvent.click(screen.getByRole('button', { name: '添加或更新此账号的 GPT-6.1 Terra 路由' }))

    expect(onAddModel).toHaveBeenCalledWith(accountA, 'high')
    await waitFor(() =>
      expect(onAccountCredentialStatusChange).toHaveBeenCalledWith(accountA.accountId, true),
    )
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByText(/允许下一次授权的账号将模型请求/)).not.toBeInTheDocument()
  })

  it('uses the separate Codex sign-in RPC without Plan-consent parameters', async () => {
    const newAccount: OpenAICodexAccountSummary = {
      accountId: 'codex-account-new',
      email: 'new-codex@example.test',
      connected: true,
      reauthRequired: false,
    }
    const assistant = createAssistant({
      getStatus: vi.fn().mockResolvedValue({ available: true, accounts: [] }),
      signInStatus: vi.fn().mockResolvedValue({ status: 'connected', account: newAccount }),
    })

    render(<OpenAICodexSettings assistant={assistant} onAddModel={vi.fn()} />)
    await waitFor(() => expect(assistant.getStatus).toHaveResolved())
    fireEvent.click(screen.getByRole('button', { name: '连接 Codex 账号' }))

    await waitFor(() => {
      expect(assistant.startSignIn).toHaveBeenCalledWith({})
      expect(assistant.openAuthorizationUrl).toHaveBeenCalledWith(
        'https://auth.openai.com/api/accounts/authorize?client_id=dynamic',
      )
    })
    await screen.findByText(/Codex 账号已连接/)
    expect(assistant.signInStatus).toHaveBeenCalledWith({ attemptId: 'codex-attempt' })
    expect(assistant.startSignIn).not.toHaveBeenCalledWith(
      expect.objectContaining({ enablePlanUsage: expect.anything() }),
    )
  })
})
