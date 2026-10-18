import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioSynthesizerEngine } from './AudioSynthesizerEngine'

class FakeNode {
  connect = vi.fn()
  disconnect = vi.fn()
  start = vi.fn()
  stop = vi.fn()
  onended: (() => void) | null = null
  frequency = { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }
  gain = { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }
}
class FakeContext {
  static instances: FakeContext[] = []
  state = 'running'
  sampleRate = 20
  currentTime = 0
  destination = {}
  nodes: FakeNode[] = []
  resume = vi.fn(async () => {
    this.state = 'running'
  })
  close = vi.fn(async () => {
    this.state = 'closed'
  })
  constructor() {
    FakeContext.instances.push(this)
  }
  private node() {
    const node = new FakeNode()
    this.nodes.push(node)
    return node
  }
  createOscillator = () => this.node()
  createGain = () => this.node()
  createBufferSource = () => this.node()
  createBiquadFilter = () => this.node()
  createBuffer = (_channels: number, length: number) => ({
    getChannelData: () => new Float32Array(length),
  })
}
beforeEach(() => {
  FakeContext.instances = []
  vi.stubGlobal('AudioContext', FakeContext)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
describe('owned audio resources', () => {
  it('silent mode and zero volume create no context or sound nodes', async () => {
    const engine = new AudioSynthesizerEngine()
    await engine.triggerKeyPress('silent', 1)
    await engine.triggerKeyPress('blue', 0)
    expect(FakeContext.instances).toHaveLength(0)
  })
  it('rejects invalid gain values before playing', async () => {
    const engine = new AudioSynthesizerEngine()
    await expect(engine.triggerKeyPress('blue', Infinity)).rejects.toThrow()
    await expect(engine.startAmbience('rain', -1)).rejects.toThrow()
    expect(FakeContext.instances).toHaveLength(0)
  })
  it('disconnects all transient and ambience nodes and closes only its own context', async () => {
    const engine = new AudioSynthesizerEngine({ next: () => 0.5 })
    await engine.triggerKeyPress('blue')
    const context = FakeContext.instances[0]
    const transientNodes = [...context.nodes]
    context.nodes.forEach((node) => node.onended?.())
    expect(transientNodes.every((node) => node.disconnect.mock.calls.length > 0)).toBe(true)
    await engine.startAmbience('rain')
    const ambientNodes = context.nodes.slice(transientNodes.length)
    engine.stopAmbience()
    expect(ambientNodes.every((node) => node.disconnect.mock.calls.length > 0)).toBe(true)
    engine.close()
    expect(context.close).toHaveBeenCalledOnce()
  })
  it('uses actual bell oscillators for temple sound and clears owned timers', async () => {
    vi.useFakeTimers()
    const engine = new AudioSynthesizerEngine()
    await engine.startAmbience('temple')
    expect(
      FakeContext.instances[0].nodes.some(
        (node) => node.frequency.setValueAtTime.mock.calls.length > 0,
      ),
    ).toBe(true)
    engine.close()
    expect(vi.getTimerCount()).toBe(0)
  })
})
