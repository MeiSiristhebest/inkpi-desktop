import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { OpenAIChatGPTPlanAccountSummary, OpenAIChatGPTPlanModel } from '@inkpi/protocol'
import type { ChatGPTPlanAssistant } from '../../ports/aiGateway'
import { ChatGPTPlanSettings } from './ChatGPTPlanSettings'

const accountA: OpenAIChatGPTPlanAccountSummary = {
  accountId: 'account-a',
  email: 'a@example.test',
  connected: true,
  sharing: true,
  reauthRequired: false,
}
const accountB: OpenAIChatGPTPlanAccountSummary = {
  accountId: 'account-b',
  email: 'b@example.test',
  connected: true,
  sharing: true,
  reauthRequired: false,
}
const modelA: OpenAIChatGPTPlanModel = {
  accountId: accountA.accountId,
  id: 'gpt-model',
  name: 'Model A',
}
const modelB: OpenAIChatGPTPlanModel = {
  accountId: accountB.accountId,
  id: 'gpt-model',
  name: 'Model B',
}

function createAssistant(overrides: Partial<ChatGPTPlanAssistant> = {}): ChatGPTPlanAssistant {
  return {
    getStatus: vi.fn().mockResolvedValue({ available: true, accounts: [accountA, accountB] }),
    startSignIn: vi
      .fn()
      .mockResolvedValue({ attemptId: 'attempt-1', authorizationUrl: 'https://auth.openai.com/' }),
    signInStatus: vi.fn().mockResolvedValue({ status: 'pending' }),
    listModels: vi.fn(async ({ accountId }) => [
      accountId === accountB.accountId ? modelB : modelA,
    ]),
    disconnect: vi.fn(async ({ accountId }) => ({ accountId, remoteRevocationConfirmed: true })),
    openAuthorizationUrl: vi.fn(async () => undefined),
    openUsageSettings: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe('ChatGPTPlanSettings account ownership', () => {
  it('loads and disconnects only the selected account and adds its model as an owned route', async () => {
    const assistant = createAssistant()
    const onAddModel = vi.fn()
    const onAccountUsageStatusChange = vi.fn()
    render(
      <ChatGPTPlanSettings
        assistant={assistant}
        onAddModel={onAddModel}
        onAccountUsageStatusChange={onAccountUsageStatusChange}
      />,
    )

    await waitFor(() =>
      expect(assistant.listModels).toHaveBeenCalledWith({ accountId: accountA.accountId }),
    )
    fireEvent.change(screen.getByRole('combobox', { name: 'ChatGPT 账号' }), {
      target: { value: accountB.accountId },
    })
    await waitFor(() =>
      expect(assistant.listModels).toHaveBeenLastCalledWith({ accountId: accountB.accountId }),
    )

    fireEvent.click(screen.getByRole('button', { name: '添加所选账号模型' }))
    expect(onAddModel).toHaveBeenCalledWith(modelB)
    expect(onAccountUsageStatusChange).toHaveBeenCalledWith(accountA.accountId, true)
    expect(onAccountUsageStatusChange).toHaveBeenCalledWith(accountB.accountId, true)

    vi.mocked(assistant.signInStatus).mockResolvedValue({ status: 'connected', account: accountB })
    fireEvent.click(screen.getByRole('button', { name: '重新授权所选账号' }))
    await waitFor(() =>
      expect(assistant.startSignIn).toHaveBeenCalledWith({
        accountId: accountB.accountId,
        enablePlanUsage: true,
      }),
    )
    await screen.findByText('ChatGPT 账号已连接。选择可用模型后添加到 AI 服务。')

    fireEvent.click(screen.getByRole('button', { name: '断开所选账号' }))
    await waitFor(() =>
      expect(assistant.disconnect).toHaveBeenCalledWith({ accountId: accountB.accountId }),
    )
    expect(
      (screen.getByRole('combobox', { name: 'ChatGPT 账号' }) as HTMLSelectElement).value,
    ).toBe(accountA.accountId)
  })

  it('creates a separate account registration without reusing the selected account id', async () => {
    const newAccount: OpenAIChatGPTPlanAccountSummary = {
      accountId: 'account-c',
      email: 'c@example.test',
      connected: true,
      sharing: true,
      reauthRequired: false,
    }
    const assistant = createAssistant({
      getStatus: vi.fn().mockResolvedValue({ available: true, accounts: [] }),
      startSignIn: vi.fn().mockResolvedValue({
        attemptId: 'attempt-new',
        authorizationUrl: 'https://auth.openai.com/',
      }),
      signInStatus: vi.fn().mockResolvedValue({ status: 'connected', account: newAccount }),
      listModels: vi.fn(async () => [{ ...modelA, accountId: newAccount.accountId }]),
    })
    render(<ChatGPTPlanSettings assistant={assistant} onAddModel={vi.fn()} />)

    await waitFor(() => expect(assistant.getStatus).toHaveResolved())
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: '连接账号' }))

    await waitFor(() => {
      expect(assistant.startSignIn).toHaveBeenCalledWith({ enablePlanUsage: true })
      expect(assistant.openAuthorizationUrl).toHaveBeenCalledWith('https://auth.openai.com/')
      expect(assistant.listModels).toHaveBeenCalledWith({ accountId: newAccount.accountId })
    })
    expect(
      (screen.getByRole('combobox', { name: 'ChatGPT 账号' }) as HTMLSelectElement).value,
    ).toBe(newAccount.accountId)
  })
})
