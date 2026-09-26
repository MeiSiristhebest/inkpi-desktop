// 新建项目的领域定义（§P3.6）。书架表单只呈现这里写下的规则：
// 每个选项都必须在数据层留下看得见的差别，否则它不该出现在表单上。

import type { ProjectRecord } from '../../types'

/**
 * 从哪里开始。空白与示范在数据层是两条不同的种子路径（INV-05）：
 * 示范会注入成套的样例设定与人物，空白一条事实都不编。
 */
export type ProjectStarter = 'blank' | 'demo'

/** 工具组合。决定这本书打开后左栏里第一件可用的工具有哪些。 */
export type ToolingCombo = 'lite' | 'recommended' | 'custom'

/** 题材候选 —— 书架卡片上那枚标签显示的就是它。 */
export const PROJECT_GENRES = ['东方玄幻', '都市现实', '科幻', '悬疑', '历史', '其他'] as const

/**
 * 精简：只收「翻开第一章就用得上、且只读作者已经写下的正文」的工具 ——
 * 一本新书的设定卡片加四条质检。
 */
export const LEAN_PLUGIN_IDS: readonly string[] = [
  'living-codex',
  'narrative-linter',
  'consistency-sentinel',
  'safe-gate',
  'water-meter',
  'describe-palette',
]

/** 推荐：精简 + 每个类别里门槛最低的连载工具。 */
export const RECOMMENDED_PLUGIN_IDS: readonly string[] = [
  ...LEAN_PLUGIN_IDS,
  'scene-beats',
  'volume-master',
  'clue-weaver',
  'emotion-curve',
  'reader-hook',
  'paywall-sentry',
  'sprint-arena',
  'geography-map',
  'faction-matrix',
  'dialogue-distiller',
  'rhythm-metronome',
  'press-forge',
  'scrapbook-recycler',
]

/** 一次「新建项目」提交：字段全部会被持久化，没有一个只是装饰。 */
export interface NewProjectForm {
  name: string
  genre: string
  cover: string
  /** 建书表单不收简介，之后在卡片菜单里补；只有内置示范项目自带一句 */
  intro?: string
  starter: ProjectStarter
  tooling: ToolingCombo
  /** tooling === 'custom' 时作者逐件勾出来的集合 */
  customPluginIds: readonly string[]
}

export const pluginIdsFor = (
  tooling: ToolingCombo,
  customPluginIds: readonly string[],
): readonly string[] =>
  tooling === 'lite'
    ? LEAN_PLUGIN_IDS
    : tooling === 'recommended'
      ? RECOMMENDED_PLUGIN_IDS
      : customPluginIds

export const projectTypeFor = (tooling: ToolingCombo): ProjectRecord['projectType'] =>
  tooling === 'lite' ? 'lite' : tooling === 'custom' ? 'custom' : 'full'
