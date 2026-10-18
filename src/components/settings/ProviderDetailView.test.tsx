import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ModelConfig } from '../../core/settings'
import { ProviderDetailView, type ProviderDetailViewProps } from './ProviderDetailView'

type ModelFetchResult = Awaited<ReturnType<NonNullable<ProviderDetailViewProps['onFetchModels']>>>
type ProviderTestResult = Awaited<ReturnType<NonNullable<ProviderDetailViewProps['onTest']>>>

const modelConfig: ModelConfig = {
  id: 'private-model',
  name: 'Private model',
  provider: 'openrouter',
  baseUrl: 'https://openrouter.ai/api/v1',
  credentialConfigured: true,
  availableModelIds: ['private-model'],
  availableModelCatalog: [
    {
      id: 'private-model',
      contextTokens: 128000,
      promptPricePerToken: '0.00000015',
      completionPricePerToken: '0.0000006',
    },
  ],
  catalogFetchedAt: '2026-10-12T00:00:00.000Z',
}

describe('ProviderDetailView provider catalog scope', () => {
  it('exposes connection testing as a busy, disabled button', async () => {
    let resolveTest!: (value: ProviderTestResult) => void
    const onTest = vi.fn(
      () =>
        new Promise<ProviderTestResult>((resolve) => {
          resolveTest = resolve
        }),
    )

    render(
      <ProviderDetailView
        initialConfig={modelConfig}
        onBack={vi.fn()}
        onSave={vi.fn()}
        onTest={onTest}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '测试连接' }))

    const testingButton = screen.getByRole('button', { name: '测试中…' })
    expect(testingButton).toBeDisabled()
    expect(testingButton).toHaveAttribute('aria-busy', 'true')

    resolveTest({ ok: true, msg: '连接成功' })

    await waitFor(() => expect(screen.getByRole('button', { name: '测试连接' })).toBeEnabled())
  })

  it('exposes model catalog fetching as a busy, disabled button', async () => {
    let resolveFetch!: (value: ModelFetchResult) => void
    const onFetchModels = vi.fn(
      () =>
        new Promise<ModelFetchResult>((resolve) => {
          resolveFetch = resolve
        }),
    )

    render(
      <ProviderDetailView
        initialConfig={modelConfig}
        onBack={vi.fn()}
        onSave={vi.fn()}
        onFetchModels={onFetchModels}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '获取列表' }))

    const fetchingButton = screen.getByRole('button', { name: '获取中…' })
    expect(fetchingButton).toBeDisabled()
    expect(fetchingButton).toHaveAttribute('aria-busy', 'true')

    resolveFetch({
      status: 200,
      latency: 12,
      modelIds: ['private-model'],
      catalogModels: [{ id: 'private-model' }],
    })

    await waitFor(() => expect(screen.getByRole('button', { name: '获取列表' })).toBeEnabled())
  })

  it('does not reuse another credential catalog when the refreshed response omits metadata', async () => {
    const onSave = vi.fn()
    const onFetchModels = vi.fn().mockResolvedValue({
      status: 200,
      latency: 12,
      modelIds: ['private-model'],
      catalogModels: [{ id: 'private-model', contextTokens: 32000 }],
    })

    render(
      <ProviderDetailView
        initialConfig={modelConfig}
        onBack={vi.fn()}
        onSave={onSave}
        onFetchModels={onFetchModels}
      />,
    )

    expect(screen.getByText(/输入 \$0\.15\/1M/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('API Key 接口密钥'), {
      target: { value: 'new-provider-key' },
    })
    expect(screen.queryByText(/输入 \$0\.15\/1M/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('获取列表'))
    await waitFor(() =>
      expect(onFetchModels).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1',
        'new-provider-key',
        'openrouter',
      ),
    )
    fireEvent.click(screen.getByText('保存服务'))

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0][0].availableModelCatalog).toEqual([
      { id: 'private-model', contextTokens: 32000 },
    ])
    expect(onSave.mock.calls[0][0].catalogFetchedAt).toBeTruthy()
  })

  it('drops the old catalog snapshot when the endpoint changes without a fresh read', async () => {
    const onSave = vi.fn()
    render(<ProviderDetailView initialConfig={modelConfig} onBack={vi.fn()} onSave={onSave} />)

    fireEvent.change(screen.getByLabelText('API Base URL 接口地址'), {
      target: { value: 'https://proxy.example.test/v1' },
    })
    expect(screen.getByLabelText('上下文窗口 (tokens)')).toHaveValue(null)
    fireEvent.click(screen.getByText('保存服务'))

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    expect(onSave.mock.calls[0][0].availableModelCatalog).toBeUndefined()
    expect(onSave.mock.calls[0][0].catalogFetchedAt).toBeUndefined()
  })
})
