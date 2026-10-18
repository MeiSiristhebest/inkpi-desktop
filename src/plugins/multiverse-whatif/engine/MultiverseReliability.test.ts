import { describe, expect, it } from 'vitest'
import { MultiverseEngine } from './MultiverseEngine'
const canon = [
  { index: 1, title: '前', summary: '开会', entities: [] },
  { index: 2, title: '分', summary: '拒绝采访', entities: ['记者'] },
  { index: 3, title: '后', summary: '刊物发行', entities: ['编辑'] },
]
describe('premise-bound branch planning', () => {
  it('preserves canon before the fork and marks unprovided branch consequences unknown', () => {
    const result = MultiverseEngine.simulateFork(canon, 2, '接受采访，但保留匿名')
    expect(result.nodes[0].eventSummary).toBe('开会')
    expect(result.divergencePremise).toBe('接受采访，但保留匿名')
    expect(result.nodes[2].divergenceLevel).toBeNull()
    expect(JSON.stringify(result)).not.toMatch(/宗门|杀戮|黑化|35|危机提前/)
  })
  it('rejects missing fork chapters and duplicate chapter positions', () => {
    expect(() => MultiverseEngine.simulateFork(canon, 4, '采访')).toThrow()
    expect(() => MultiverseEngine.simulateFork([...canon, canon[1]], 2, '采访')).toThrow()
  })
})
