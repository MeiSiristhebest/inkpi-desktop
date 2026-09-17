import { describe, it, expect } from 'vitest'
import type { ModelConfig } from '../../core/settings'
import { modelConfigToRoute, buildRoutesFromModelConfigs } from './modelConfigRouteAdapter'
import { CapabilityRouter } from './capabilityRouter'
import { createDeepReasoningTask, createContinueTask } from '../tasks/taskFactories'
import { projectContent } from '../../domain/content'

describe('modelConfigRouteAdapter', () => {
  const deepseekReasoner: ModelConfig = {
    id: 'deepseek-reasoner',
    name: 'DeepSeek R1',
    provider: 'deepseek',
    supportsThinking: true,
    contextWindow: 64000,
  }

  const gpt4o: ModelConfig = {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    contextWindow: 128000,
  }

  const ollamaLlama: ModelConfig = {
    id: 'llama3:8b',
    name: 'Local Llama',
    provider: 'ollama',
    enabled: true,
  }

  it('correctly identifies reasoning model and capabilities', () => {
    const route = modelConfigToRoute(deepseekReasoner, true)
    expect(route.id).toBe('deepseek::deepseek-reasoner')
    expect(route.capabilities).toContain('creative-reasoning')
    expect(route.capabilities).toContain('reasoning')
    expect(route.modelCapabilities?.reasoning).toBe(true)
    expect(route.priority).toBeGreaterThanOrEqual(100)
  })

  it('builds prioritized routes and allows CapabilityRouter to route tasks appropriately', () => {
    const routes = buildRoutesFromModelConfigs(
      [deepseekReasoner, gpt4o, ollamaLlama],
      gpt4o, // gpt4o is default
    )

    expect(routes.length).toBe(3)
    const router = new CapabilityRouter(routes)

    const doc = projectContent('ch-1', '测试文本', 1)

    // 1. 普通续写任务：由高优先级的默认模型 (gpt4o) 承接
    const continueTask = createContinueTask({
      taskId: 't-continue',
      workspaceId: 'ws-1',
      document: doc,
    })
    const continueDecision = router.select(continueTask)
    expect(continueDecision.route.id).toBe('openai::gpt-4o')

    // 2. 深度推理任务：需要 reasoning 能力，由具备 reasoning 的 deepseek-reasoner 承接
    const reasoningTask = createDeepReasoningTask({
      taskId: 't-reason',
      workspaceId: 'ws-1',
      document: doc,
      question: '分析主线矛盾',
    })
    const reasoningDecision = router.select(reasoningTask)
    expect(reasoningDecision.route.id).toBe('deepseek::deepseek-reasoner')
  })

  it('skips disabled models in route building', () => {
    const disabledModel: ModelConfig = {
      id: 'disabled-model',
      name: 'Disabled',
      provider: 'custom',
      enabled: false,
    }

    const routes = buildRoutesFromModelConfigs([disabledModel, gpt4o], null)
    expect(routes.some((r) => r.modelId === 'disabled-model')).toBe(false)
    expect(routes.some((r) => r.modelId === 'gpt-4o')).toBe(true)
  })
})
