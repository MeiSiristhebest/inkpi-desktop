import { useState, useMemo, type FC } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Search, RefreshCw, Plus, X, ChevronDown, Check, ArrowLeft } from 'lucide-react'
import {
  type ModelConfig,
  type ThinkingLevel,
  type ProviderType,
  PROVIDER_META,
} from '../../core/settings'
import {
  lookupCatalogModel,
  formatTokenCount,
  type ModelCatalogSnapshot,
} from '../../core/modelCatalog'
import { fetchModelIds } from '../../adapters/modelProviderProbe'
import { fieldLabel, inputCls, PrimaryButton, SecondaryButton, Switch } from './SettingsShared'
import { spring, variants, gesture } from '../../motion'

export interface ProviderDetailViewProps {
  initialConfig?: ModelConfig | null
  onBack: () => void
  onSave: (config: ModelConfig) => void
  onTest?: (baseUrl: string, apiKey: string) => Promise<{ ok: boolean; msg: string }>
}

const THINKING_CHOICES: { level: ThinkingLevel; label: string }[] = [
  { level: 'none', label: '关闭' },
  { level: 'low', label: '最低' },
  { level: 'medium', label: '低' },
  { level: 'high', label: '中' },
  { level: 'xhigh', label: '高' },
  { level: 'max', label: '极高' },
]

export const ProviderDetailView: FC<ProviderDetailViewProps> = ({
  initialConfig,
  onBack,
  onSave,
  onTest,
}) => {
  const isEditing = Boolean(initialConfig?.id)

  const [service, setService] = useState<string>(() => {
    if (initialConfig?.provider && initialConfig.provider !== 'custom') {
      return initialConfig.provider
    }
    return 'custom'
  })
  const [name, setName] = useState(initialConfig?.name ?? '')
  const [baseUrl, setBaseUrl] = useState(initialConfig?.baseUrl ?? '')
  const [apiKey, setApiKey] = useState(initialConfig?.apiKey ?? '')
  const [apiFormat, setApiFormat] = useState('OpenAI Chat Completions')

  // 测试连接状态
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  // 模型选择与拉取状态
  const [fetching, setFetching] = useState(false)
  const [fetchedIds, setFetchedIds] = useState<string[]>([])
  const [customModelInput, setCustomModelInput] = useState('')
  const [modelSearch, setModelSearch] = useState('')

  // 当前勾选的模型 ID 集合
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (initialConfig?.availableModelIds && initialConfig.availableModelIds.length > 0) {
      return Array.from(new Set(initialConfig.availableModelIds))
    }
    if (initialConfig?.id) return [initialConfig.id]
    return []
  })

  // 展开配置的模型 ID
  const [expandedModelId, setExpandedModelId] = useState<string>(() => {
    return initialConfig?.id || ''
  })

  // 每个模型的个性化微调配置映射
  const [modelOverrides, setModelOverrides] = useState<
    Record<
      string,
      {
        alias?: string
        contextWindow?: number
        maxTokens?: number
        thinkingLevel?: ThinkingLevel
        supportsImages?: boolean
        supportsDocuments?: boolean
        availableForSubagents?: boolean
      }
    >
  >(() => {
    if (!initialConfig?.id) return {}
    return {
      [initialConfig.id]: {
        alias: initialConfig.alias,
        contextWindow: initialConfig.contextWindow,
        maxTokens: initialConfig.maxTokens,
        thinkingLevel: initialConfig.thinkingLevel,
        supportsImages: initialConfig.supportsImages,
        supportsDocuments: (initialConfig as any).supportsDocuments,
        availableForSubagents: (initialConfig as any).availableForSubagents,
      },
    }
  })

  // 全量候选模型列表：严格只来源于：
  // 1. 本服务已经保存过的可用模型 ID (initialConfig.availableModelIds)
  // 2. 点击「获取列表」从该端点真实拉取到的模型 ID (fetchedIds)
  // 3. 用户手动填写的初始模型 ID (initialConfig.id)
  // 坚决不提前塞入内置静态全量目录！没拉取就是没拉取，必须真实！
  const allCandidateRows = useMemo(() => {
    const map = new Map<string, { id: string; entry?: ModelCatalogSnapshot }>()

    // 1. 本服务历史上已持久化拉取到的模型
    ;(initialConfig?.availableModelIds ?? []).forEach((id) => {
      map.set(id, { id, entry: lookupCatalogModel(id) })
    })

    // 2. 本次点击「获取列表」从真实端点拉取到的模型
    fetchedIds.forEach((id) => {
      if (!map.has(id)) map.set(id, { id, entry: lookupCatalogModel(id) })
    })

    // 3. 当前初始 ID（若已保存过）
    if (initialConfig?.id && !map.has(initialConfig.id)) {
      map.set(initialConfig.id, {
        id: initialConfig.id,
        entry: lookupCatalogModel(initialConfig.id),
      })
    }

    return Array.from(map.values())
  }, [initialConfig, fetchedIds])

  // 搜索过滤后的模型列表
  const visibleRows = useMemo(() => {
    const q = modelSearch.trim().toLowerCase()
    if (!q) return allCandidateRows
    return allCandidateRows.filter((r) => {
      return r.id.toLowerCase().includes(q) || (r.entry?.name.toLowerCase().includes(q) ?? false)
    })
  }, [allCandidateRows, modelSearch])

  // 全选/半选状态
  const allVisibleSelected =
    visibleRows.length > 0 && visibleRows.every((r) => selectedIds.includes(r.id))
  const someVisibleSelected =
    visibleRows.some((r) => selectedIds.includes(r.id)) && !allVisibleSelected

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      const visibleSet = new Set(visibleRows.map((r) => r.id))
      setSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)))
    } else {
      const next = new Set(selectedIds)
      visibleRows.forEach((r) => next.add(r.id))
      setSelectedIds(Array.from(next))
      if (!expandedModelId && visibleRows[0]) {
        setExpandedModelId(visibleRows[0].id)
      }
    }
  }

  const toggleModel = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds((prev) => prev.filter((x) => x !== id))
      if (expandedModelId === id) {
        const remaining = selectedIds.filter((x) => x !== id)
        setExpandedModelId(remaining[0] || '')
      }
    } else {
      setSelectedIds((prev) => [...prev, id])
      setExpandedModelId(id)
      if (!modelOverrides[id]) {
        const entry = lookupCatalogModel(id)
        if (entry) {
          setModelOverrides((prev) => ({
            ...prev,
            [id]: {
              contextWindow: entry.contextWindow,
              maxTokens: entry.maxTokens,
              thinkingLevel: entry.supportsThinking ? 'high' : 'none',
              supportsImages: Boolean(entry.supportsVision),
            },
          }))
        }
      }
    }
  }

  const handleFetchList = async () => {
    const targetUrl =
      baseUrl || (service ? PROVIDER_META[service as ProviderType]?.defaultBaseUrl : '')
    if (!targetUrl) {
      setTestResult({ ok: false, msg: '请先填写接口地址' })
      return
    }
    setFetching(true)
    try {
      const ids = await fetchModelIds(targetUrl, apiKey)
      setFetchedIds((prev) => Array.from(new Set([...prev, ...ids])))
      setTestResult({ ok: true, msg: `成功拉取到 ${ids.length} 个模型` })
      if (selectedIds.length === 0 && ids.length > 0) {
        setSelectedIds([ids[0]])
        setExpandedModelId(ids[0])
      }
    } catch (e: any) {
      setTestResult({ ok: false, msg: e?.message || '获取模型列表失败' })
    } finally {
      setFetching(false)
    }
  }

  const handleTestConnection = async () => {
    if (!baseUrl) {
      setTestResult({ ok: false, msg: '请先填写接口地址' })
      return
    }
    if (onTest) {
      setTesting(true)
      try {
        const res = await onTest(baseUrl, apiKey)
        setTestResult(res)
      } catch (e: any) {
        setTestResult({ ok: false, msg: e?.message || '连接超时' })
      } finally {
        setTesting(false)
      }
    }
  }

  const addCustomModel = () => {
    const id = customModelInput.trim()
    if (!id) return
    if (!selectedIds.includes(id)) {
      setSelectedIds((prev) => [...prev, id])
    }
    setExpandedModelId(id)
    if (!modelOverrides[id]) {
      const entry = lookupCatalogModel(id)
      if (entry) {
        setModelOverrides((prev) => ({
          ...prev,
          [id]: {
            contextWindow: entry.contextWindow,
            maxTokens: entry.maxTokens,
            thinkingLevel: entry.supportsThinking ? 'high' : 'none',
            supportsImages: Boolean(entry.supportsVision),
          },
        }))
      }
    }
    setCustomModelInput('')
  }

  const handleSave = () => {
    const primaryId = expandedModelId || selectedIds[0] || initialConfig?.id || ''
    if (!primaryId) {
      setTestResult({ ok: false, msg: '请至少选择一个模型' })
      return
    }

    const currentOverride = modelOverrides[primaryId] || {}
    const entry = lookupCatalogModel(primaryId)

    const saved: ModelConfig = {
      id: primaryId,
      name: name.trim() || initialConfig?.name || primaryId,
      provider: (service === 'custom' ? 'custom' : service) as ProviderType,
      baseUrl: baseUrl.trim() || undefined,
      apiKey: apiKey.trim() || undefined,
      availableModelIds: selectedIds.length > 0 ? selectedIds : [primaryId],
      alias: currentOverride.alias?.trim() || undefined,
      contextWindow:
        currentOverride.contextWindow ?? entry?.contextWindow ?? initialConfig?.contextWindow,
      maxTokens: currentOverride.maxTokens ?? entry?.maxTokens ?? initialConfig?.maxTokens,
      thinkingLevel: currentOverride.thinkingLevel ?? initialConfig?.thinkingLevel ?? 'none',
      supportsThinking:
        currentOverride.thinkingLevel && currentOverride.thinkingLevel !== 'none'
          ? true
          : Boolean(entry?.supportsThinking),
      supportsImages: currentOverride.supportsImages ?? entry?.supportsVision,
      enabled: initialConfig?.enabled ?? true,
    }

    onSave(saved)
  }

  return (
    <motion.div className="space-y-6" {...variants.slideInFromRight} transition={spring.gentle}>
      {/* 顶部面包屑与操作栏 */}
      <div className="flex items-center justify-between pb-4 border-b border-[var(--ink-border)] select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <motion.button
            type="button"
            onClick={onBack}
            {...gesture.button}
            transition={spring.snappy}
            className="p-1.5 rounded-lg text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer flex items-center gap-1 text-[13px] font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回模型列表</span>
          </motion.button>
          <span className="text-[var(--ink-text-faint)]">/ </span>
          <h3 className="text-[14px] font-semibold text-[var(--ink-text)] truncate">
            {isEditing ? `编辑服务：${initialConfig?.name || initialConfig?.id}` : '添加 AI 服务'}
          </h3>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <SecondaryButton onClick={handleTestConnection} disabled={testing}>
            {testing ? '测试中…' : '测试连接'}
          </SecondaryButton>
          <SecondaryButton onClick={onBack}>取消</SecondaryButton>
          <PrimaryButton onClick={handleSave}>保存服务</PrimaryButton>
        </div>
      </div>

      {/* 测试结果提示条：AnimatePresence 驱动入场 / 离场 */}
      <AnimatePresence>
        {testResult && (
          <motion.div
            {...variants.fadeDown}
            transition={spring.default}
            className={`text-[12px] px-3.5 py-2 rounded-xl border flex items-center gap-2 ${
              testResult.ok
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-600'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
            <span>{testResult.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 凭证配置卡片 */}
      <div className="rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-5 space-y-4 shadow-2xs">
        {/* 服务类型选择 */}
        <div>
          <label className={fieldLabel}>服务提供商</label>
          <div className="relative">
            <select
              value={service}
              onChange={(e) => {
                const s = e.target.value
                setService(s)
                if (s !== 'custom') {
                  const m = PROVIDER_META[s as ProviderType]
                  if (m?.defaultBaseUrl) setBaseUrl(m.defaultBaseUrl)
                  if (!name) setName(m?.label || s)
                }
              }}
              className={`${inputCls} appearance-none cursor-pointer`}
            >
              {Object.entries(PROVIDER_META).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-[var(--ink-text-faint)] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* 名称 与 接口地址 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={fieldLabel}>服务显示名称</label>
            <input
              type="text"
              value={name}
              placeholder="例如 我的主力模型"
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={fieldLabel}>API Base URL 接口地址</label>
            <input
              type="text"
              value={baseUrl}
              placeholder="https://api.example.com/v1"
              onChange={(e) => setBaseUrl(e.target.value)}
              className={`${inputCls} font-mono`}
            />
          </div>
        </div>

        {/* API 密钥 与 接口格式 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={fieldLabel}>API Key 接口密钥</label>
            <input
              type="password"
              value={apiKey}
              placeholder={isEditing ? '留空则保留已保存的密钥' : 'sk-...'}
              onChange={(e) => setApiKey(e.target.value)}
              className={`${inputCls} font-mono`}
            />
            <span className="block text-[10.5px] text-[var(--ink-text-faint)] mt-1">
              留空则保留已保存的密钥；本地模型（如 Ollama）可免填。
            </span>
          </div>
          <div>
            <label className={fieldLabel}>接口协议格式</label>
            <div className="relative">
              <select
                value={apiFormat}
                onChange={(e) => setApiFormat(e.target.value)}
                className={`${inputCls} appearance-none cursor-pointer`}
              >
                <option value="OpenAI Chat Completions">OpenAI Chat Completions (标准格式)</option>
                <option value="Anthropic Messages">Anthropic Messages</option>
                <option value="Google Generative AI">Google Generative AI</option>
                <option value="OpenAI Codex Responses">OpenAI Codex Responses</option>
              </select>
              <ChevronDown className="w-4 h-4 text-[var(--ink-text-faint)] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* ── 核心双栏面板（左侧选模型，右侧配模型，与设计基线 100% 对齐） ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 左栏：该服务的模型 */}
        <div className="rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4 flex flex-col h-[420px] shadow-2xs">
          {/* 标题栏 */}
          <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-[var(--ink-border)]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSelectAll}
                title={allVisibleSelected ? '取消全选' : '全选'}
                className="w-4 h-4 rounded border border-[var(--ink-border-strong)] flex items-center justify-center cursor-pointer bg-[var(--ink-bg)] text-[var(--ink-text)]"
              >
                {allVisibleSelected ? (
                  <Check className="w-3 h-3" />
                ) : someVisibleSelected ? (
                  <span className="w-2 h-0.5 bg-[var(--ink-accent)] rounded-full" />
                ) : null}
              </button>
              <span className="text-[13px] font-semibold text-[var(--ink-text)]">该服务的模型</span>
              <SecondaryButton
                onClick={handleFetchList}
                disabled={fetching}
                className="!px-2 !py-0.5 !text-[11px]"
              >
                <RefreshCw className={`w-3 h-3 ${fetching ? 'animate-spin' : ''}`} />
                <span>{fetching ? '获取中…' : '获取列表'}</span>
              </SecondaryButton>
            </div>

            <div className="relative w-36 sm:w-44">
              <Search className="w-3.5 h-3.5 text-[var(--ink-text-faint)] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                placeholder="搜索模型 ID..."
                className="w-full pl-8 pr-2.5 py-1 rounded-lg text-[11.5px] bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none focus:border-[var(--ink-accent)] transition-colors"
              />
            </div>
          </div>

          {/* 滚动模型列表或空状态提示 */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {allCandidateRows.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[var(--ink-text-faint)]">
                <div className="w-10 h-10 rounded-xl bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)] flex items-center justify-center mb-3">
                  <RefreshCw className={`w-5 h-5 ${fetching ? 'animate-spin' : ''}`} />
                </div>
                {fetching ? (
                  <span className="text-[12.5px] font-medium text-[var(--ink-text)]">
                    正在拉取端点可用模型…
                  </span>
                ) : (
                  <div className="space-y-1 text-[12px] max-w-xs leading-relaxed">
                    <p className="text-[var(--ink-text)] font-medium">尚未获取端点模型</p>
                    <p>
                      填写地址与密钥后，点击上方「获取列表」拉取端点模型；或在右侧下方直接输入 ID
                      手动添加。
                    </p>
                  </div>
                )}
              </div>
            ) : visibleRows.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center p-4 text-[12px] text-[var(--ink-text-faint)]">
                没有匹配的模型。
              </div>
            ) : (
              visibleRows.map((r) => {
                const isChecked = selectedIds.includes(r.id)
                const isCurrentExpanded = expandedModelId === r.id
                return (
                  <div
                    key={r.id}
                    onClick={() => toggleModel(r.id)}
                    className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer select-none ${
                      isCurrentExpanded
                        ? 'bg-[var(--ink-accent)]/15 border border-[var(--ink-accent)]/30'
                        : isChecked
                          ? 'bg-[var(--ink-bg-hover)]'
                          : 'hover:bg-[var(--ink-bg-hover)]/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                          isChecked
                            ? 'border-[var(--ink-accent)] bg-[var(--ink-accent)] text-white'
                            : 'border-[var(--ink-border-strong)]'
                        }`}
                      >
                        {isChecked && <Check className="w-2.5 h-2.5" />}
                      </span>
                      <span className="font-mono text-[11.5px] text-[var(--ink-text)] truncate">
                        {r.id}
                      </span>
                      {r.entry?.name && r.entry.name !== r.id && (
                        <span className="text-[10px] text-[var(--ink-text-faint)] truncate max-w-[90px]">
                          {r.entry.name}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-[var(--ink-text-faint)] tabular-nums shrink-0">
                      {formatTokenCount(r.entry?.contextWindow)} ·{' '}
                      {formatTokenCount(r.entry?.maxTokens)}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* 右栏：模型设置 */}
        <div className="rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4 flex flex-col h-[460px] shadow-2xs">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--ink-border)] shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[12.5px] font-semibold text-[var(--ink-text)]">模型设置</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)] font-medium">
                {selectedIds.length}
              </span>
            </div>
            {selectedIds.length > 0 && (
              <span className="text-[11px] text-[var(--ink-text-faint)]">点击卡片展开配置</span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {selectedIds.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[var(--ink-text-faint)]">
                <div className="w-10 h-10 rounded-xl bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)] flex items-center justify-center mb-3">
                  <Check className="w-5 h-5 opacity-40" />
                </div>
                <div className="space-y-1 text-[12px] max-w-xs leading-relaxed">
                  <p className="text-[var(--ink-text)] font-medium">尚未选择模型</p>
                  <p>在左侧勾选你想要启用的模型，它们将出现在这里以供精细配置。</p>
                </div>
              </div>
            ) : (
              selectedIds.map((modelId) => {
                const entry = lookupCatalogModel(modelId)
                const override = modelOverrides[modelId] || {}
                const isExpanded = expandedModelId === modelId

                const ctxVal = override.contextWindow ?? entry?.contextWindow
                const maxVal = override.maxTokens ?? entry?.maxTokens
                const thkVal = override.thinkingLevel ?? (entry?.supportsThinking ? 'high' : 'none')
                const imgVal =
                  override.supportsImages !== undefined
                    ? override.supportsImages
                    : Boolean(entry?.supportsVision)

                return (
                  <div
                    key={modelId}
                    className="rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] p-3 space-y-3 transition-all duration-200 ease-[var(--ink-ease-spring)]"
                  >
                    {/* 头部摘要 */}
                    <div
                      className="flex items-center justify-between gap-2 cursor-pointer select-none"
                      onClick={() => setExpandedModelId(isExpanded ? '' : modelId)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[12.5px] font-semibold text-[var(--ink-text)] truncate">
                          {modelId}
                        </span>
                        <span className="text-[10px] text-[var(--ink-text-faint)] tabular-nums">
                          {formatTokenCount(ctxVal)} · {formatTokenCount(maxVal)}
                        </span>
                        {thkVal && thkVal !== 'none' && (
                          <span className="px-1.5 py-0.5 rounded text-[9.5px] bg-[var(--ink-accent)]/15 text-[var(--ink-accent)] font-medium">
                            {thkVal === 'high' ? '中' : thkVal === 'xhigh' ? '高' : '思考'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleModel(modelId)
                          }}
                          className="p-1 rounded text-[var(--ink-text-faint)] hover:text-rose-500 cursor-pointer"
                          title="移除此模型"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* 展开的精细配置表单 */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          {...variants.fadeUp}
                          transition={spring.gentle}
                          className="pt-2 border-t border-[var(--ink-border)]/60 space-y-3 text-[11.5px] animate-ink-fade-in"
                        >
                          <div>
                            <label className={fieldLabel}>模型别名</label>
                            <input
                              type="text"
                              value={override.alias ?? ''}
                              placeholder="例如 fast"
                              onChange={(e) =>
                                setModelOverrides((prev) => ({
                                  ...prev,
                                  [modelId]: { ...prev[modelId], alias: e.target.value },
                                }))
                              }
                              className={inputCls}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <label className={fieldLabel}>上下文窗口 (tokens)</label>
                              <input
                                type="number"
                                value={ctxVal ?? ''}
                                placeholder={
                                  entry?.contextWindow
                                    ? String(entry.contextWindow)
                                    : '按端点实际规格输入'
                                }
                                onChange={(e) =>
                                  setModelOverrides((prev) => ({
                                    ...prev,
                                    [modelId]: {
                                      ...prev[modelId],
                                      contextWindow: Number(e.target.value) || undefined,
                                    },
                                  }))
                                }
                                className={`${inputCls} font-mono`}
                              />
                            </div>
                            <div>
                              <label className={fieldLabel}>最大输出 (tokens)</label>
                              <input
                                type="number"
                                value={maxVal ?? ''}
                                placeholder={
                                  entry?.maxTokens ? String(entry.maxTokens) : '按端点实际规格输入'
                                }
                                onChange={(e) =>
                                  setModelOverrides((prev) => ({
                                    ...prev,
                                    [modelId]: {
                                      ...prev[modelId],
                                      maxTokens: Number(e.target.value) || undefined,
                                    },
                                  }))
                                }
                                className={`${inputCls} font-mono`}
                              />
                            </div>
                          </div>

                          {/* 思考等级药丸组 */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className={fieldLabel}>思考等级</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {THINKING_CHOICES.map((c) => (
                                <button
                                  key={c.level}
                                  type="button"
                                  onClick={() =>
                                    setModelOverrides((prev) => ({
                                      ...prev,
                                      [modelId]: {
                                        ...prev[modelId],
                                        thinkingLevel: c.level,
                                      },
                                    }))
                                  }
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-150 active:scale-95 cursor-pointer ${
                                    thkVal === c.level
                                      ? 'bg-[var(--ink-accent)] text-white shadow-2xs'
                                      : 'bg-[var(--ink-bg)] text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)] border border-[var(--ink-border)]'
                                  }`}
                                >
                                  {c.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* 附件与调度开关 */}
                          <div>
                            <span className={fieldLabel}>附件能力开关</span>
                            <div className="flex items-center gap-6 flex-wrap pt-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[12px] text-[var(--ink-text)]">
                                  图片 (视觉)
                                </span>
                                <Switch
                                  checked={imgVal}
                                  onChange={(val) =>
                                    setModelOverrides((prev) => ({
                                      ...prev,
                                      [modelId]: {
                                        ...prev[modelId],
                                        supportsImages: val,
                                      },
                                    }))
                                  }
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[12px] text-[var(--ink-text)]">
                                  PDF (文档解析)
                                </span>
                                <Switch
                                  checked={override.supportsDocuments ?? imgVal}
                                  onChange={(val) =>
                                    setModelOverrides((prev) => ({
                                      ...prev,
                                      [modelId]: {
                                        ...prev[modelId],
                                        supportsDocuments: val,
                                      },
                                    }))
                                  }
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[12px] text-[var(--ink-text)]">
                                  可供 AI 自动调度
                                </span>
                                <Switch
                                  checked={override.availableForSubagents ?? false}
                                  onChange={(val) =>
                                    setModelOverrides((prev) => ({
                                      ...prev,
                                      [modelId]: {
                                        ...prev[modelId],
                                        availableForSubagents: val,
                                      },
                                    }))
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })
            )}
          </div>

          {/* 添加自定义模型 */}
          <div className="mt-3 pt-3 border-t border-[var(--ink-border)] shrink-0">
            <label className={fieldLabel}>自定义模型 ID</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customModelInput}
                placeholder="输入模型 ID，如 my-model-v2"
                onChange={(e) => setCustomModelInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCustomModel()
                  }
                }}
                className={`flex-1 ${inputCls} font-mono`}
              />
              <SecondaryButton onClick={addCustomModel}>
                <Plus className="w-3.5 h-3.5" />
                <span>添加</span>
              </SecondaryButton>
            </div>
            <div className="text-[10px] text-[var(--ink-text-faint)] mt-1">
              添加尚未收录在端点列表或新发布的模型 ID。
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
