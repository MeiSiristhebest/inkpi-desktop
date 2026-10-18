import { describe, it, expect } from 'vitest'
import { ArchetypeEngine } from './ArchetypeEngine'

describe('ArchetypeEngine (人格原型与母题抽卡引擎)', () => {
  it('抽卡能根据指定分类准确抽取预设卡牌', () => {
    const engine = new ArchetypeEngine({ next: () => 0.1 })
    const cards = engine.drawCards('character_archetype_36', 2)

    expect(cards.length).toBe(2)
    expect(cards[0].category).toBe('character_archetype_36')
    expect(cards[0].name).toBeDefined()
  })

  it('组合角色目标作为可讨论素材，不从卡牌标签推断冲突分数', () => {
    const presets = ArchetypeEngine.getPresetArchetypes()
    const rebel = presets.find((p) => p.id === 'arch-rebel')!
    const ruler = presets.find((p) => p.id === 'arch-ruler')!

    const chem = ArchetypeEngine.calculateChemistry(rebel, ruler)
    expect(chem).not.toHaveProperty('tensionScore')
    expect(chem.coreEthicalConflict).toContain(rebel.coreDesire)
    expect(chem.coreEthicalConflict).toContain(ruler.coreDesire)
    expect(chem.dramaticPrompt).toMatch(/协商|合作|拒绝/)
    expect(chem.dramaticPrompt).not.toMatch(/天然宿敌|不可调和|必然敌对/)
  })
})
