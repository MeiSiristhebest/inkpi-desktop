import { describe, it, expect } from 'vitest'
import { ALL_AVAILABLE_PLUGINS } from '../../core/pluginRegistry'
import {
  LEAN_PLUGIN_IDS,
  RECOMMENDED_PLUGIN_IDS,
  pluginIdsFor,
  projectTypeFor,
} from './projectDefaults'

const catalog = new Map(ALL_AVAILABLE_PLUGINS.map((plugin) => [plugin.id, plugin]))

/**
 * 面板上的按钮直接写着「N 件」，所以预设名单里的每个 id 都必须真的存在于工具全集里 ——
 * 少一件就是又一次「显示的状态和实际的状态不是一回事」。
 */
describe('新建项目的工具预设（§P3.6）', () => {
  it('预设里的每一件工具都真的存在于全集中，按钮上的数量才不是空头数字', () => {
    for (const id of [...LEAN_PLUGIN_IDS, ...RECOMMENDED_PLUGIN_IDS]) {
      expect(catalog.has(id), `工具 ${id} 不在 ALL_AVAILABLE_PLUGINS 里`).toBe(true)
    }
  })

  it('精简是推荐的子集，两者不是同一套按钮的两种写法', () => {
    expect(new Set(RECOMMENDED_PLUGIN_IDS).size).toBe(RECOMMENDED_PLUGIN_IDS.length)
    expect(new Set(LEAN_PLUGIN_IDS).size).toBe(LEAN_PLUGIN_IDS.length)
    expect(LEAN_PLUGIN_IDS.every((id) => RECOMMENDED_PLUGIN_IDS.includes(id))).toBe(true)
    expect(RECOMMENDED_PLUGIN_IDS.length).toBeGreaterThan(LEAN_PLUGIN_IDS.length)
  })

  it('精简只留「翻开第一章就用得上」的那几类，推荐覆盖全部类别', () => {
    const categoriesOf = (ids: readonly string[]) =>
      new Set(ids.map((id) => catalog.get(id)?.category))
    expect([...categoriesOf(LEAN_PLUGIN_IDS)].sort()).toEqual(['craft', 'lore', 'review'])

    const everyCategory = new Set(ALL_AVAILABLE_PLUGINS.map((plugin) => plugin.category))
    const recommended = categoriesOf(RECOMMENDED_PLUGIN_IDS)
    for (const category of everyCategory) {
      expect(recommended.has(category), `推荐组合漏掉了 ${category} 类`).toBe(true)
    }
  })

  it('三种组合各自解出一套不同的工具，自定义那一路听作者的', () => {
    const custom = ['living-codex', 'iron-chamber']
    expect(pluginIdsFor('lite', custom)).toBe(LEAN_PLUGIN_IDS)
    expect(pluginIdsFor('recommended', custom)).toBe(RECOMMENDED_PLUGIN_IDS)
    expect(pluginIdsFor('custom', custom)).toEqual(custom)
    expect(projectTypeFor('lite')).toBe('lite')
    expect(projectTypeFor('recommended')).toBe('full')
    expect(projectTypeFor('custom')).toBe('custom')
  })
})
