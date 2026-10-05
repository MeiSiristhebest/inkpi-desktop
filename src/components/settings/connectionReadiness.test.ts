import { describe, it, expect } from 'vitest'
import {
  classifyProbeStatus,
  deriveAiReadiness,
  deriveRuntimeReadiness,
} from './connectionReadiness'
import type { ModelConfig } from '../../core/settings'

const model = (over: Partial<ModelConfig>): ModelConfig => ({
  id: 'm1',
  name: 'gpt',
  provider: 'openai',
  ...over,
})

describe('deriveRuntimeReadiness — 一个 connected 布尔不再同时代表三件事（P1.18）', () => {
  it('两个信号都没接线时返回 unknown，而不是猜一个离线', () => {
    expect(deriveRuntimeReadiness({})).toBe('unknown')
  })

  it('已连接优先于重连标志', () => {
    expect(deriveRuntimeReadiness({ isConnected: true, isReconnecting: true })).toBe('online')
  })

  it('未连接但在重连中是 connecting，两者皆假才是 offline', () => {
    expect(deriveRuntimeReadiness({ isConnected: false, isReconnecting: true })).toBe('connecting')
    expect(deriveRuntimeReadiness({ isConnected: false, isReconnecting: false })).toBe('offline')
  })
})

describe('deriveAiReadiness — 只看用户真实配了什么', () => {
  it('没有绑定模型是 unavailable', () => {
    expect(deriveAiReadiness({ aiModel: null })).toBe('unavailable')
    expect(deriveAiReadiness({ aiModel: model({ enabled: false }) })).toBe('unavailable')
  })

  it('缺 API Key 是 degraded，补上后是 ready', () => {
    expect(deriveAiReadiness({ aiModel: model({}) })).toBe('degraded')
    expect(deriveAiReadiness({ aiModel: model({ apiKey: 'sk-x' }) })).toBe('ready')
  })

  it('既没有 baseUrl 也没有 provider 默认地址时是 degraded', () => {
    expect(deriveAiReadiness({ aiModel: model({ provider: 'custom', apiKey: 'k' }) })).toBe(
      'degraded',
    )
    expect(
      deriveAiReadiness({
        aiModel: model({ provider: 'custom', apiKey: 'k', baseUrl: 'https://my.llm/v1' }),
      }),
    ).toBe('ready')
  })

  it('本地 Ollama 与内置 Faux 不需要密钥即可用', () => {
    expect(deriveAiReadiness({ aiModel: model({ provider: 'ollama' }) })).toBe('ready')
    expect(deriveAiReadiness({ aiModel: model({ provider: 'faux' }) })).toBe('ready')
  })
})

describe('classifyProbeStatus', () => {
  it('401/403 是鉴权问题，不能和断网混为一谈', () => {
    expect(classifyProbeStatus(401)).toBe('auth-error')
    expect(classifyProbeStatus(403)).toBe('auth-error')
  })

  it('2xx/3xx 可达，其余按无法访问处理', () => {
    expect(classifyProbeStatus(200)).toBe('healthy')
    expect(classifyProbeStatus(302)).toBe('healthy')
    expect(classifyProbeStatus(429)).toBe('unreachable')
    expect(classifyProbeStatus(500)).toBe('unreachable')
  })
})
