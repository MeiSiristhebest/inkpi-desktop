// 首次启动的卷章种子数据（领域层，无 React / 无 DOM / 无 IndexedDB 依赖）。
// 从原 components/editor/richEditorUtils 抽到此处，切断 core → components 的反向依赖：
// 现在 core/projectService 与 components/editor/RichEditor 都只依赖这个纯领域模块。

import type { VolumeRecord, ChapterRecord } from '../types'
import { LEGACY_PROJECT_ID } from '../config'
import type { IdGenerator } from '../ports/idGenerator'
import type { Clock } from '../ports/clock'
import { SEED_CHAPTER_CONTENTS } from './seed/seedContent'

let seedSeq = 0
const fallbackIdGenerator: IdGenerator = {
  generate: (prefix: string) => `${prefix}-seed-${++seedSeq}`,
}
const fallbackClock: Clock = {
  now: () => 1700000000000 + ++seedSeq,
}

/**
 * 为指定项目生成两份默认分卷（仅当本地无该 project 的卷章时写入）。
 *
 * ID 与时间戳均通过注入的 IdGenerator / Clock 取得，领域层保持纯函数、
 * 不依赖运行时时间源，避免种子 ID 与 projectId 无关导致多项目互相覆盖。
 */
export const buildSeedVolumes = (
  projectId: string = LEGACY_PROJECT_ID,
  idGen: IdGenerator = fallbackIdGenerator,
  clock: Clock = fallbackClock,
): VolumeRecord[] => {
  const now = clock.now()
  return [
    {
      id: idGen.generate('vol'),
      projectId,
      title: '第一卷 · 苍云初醒',
      order: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: idGen.generate('vol'),
      projectId,
      title: '第二卷 · 星罗万象',
      order: 2,
      createdAt: now,
      updatedAt: now,
    },
  ]
}

/**
 * 为纯净空白项目生成单个默认正文卷（遵循 INV-05：无示范设定、无测试角色侵入）。
 */
export const buildBlankVolumes = (
  projectId: string = LEGACY_PROJECT_ID,
  idGen: IdGenerator = fallbackIdGenerator,
  clock: Clock = fallbackClock,
): VolumeRecord[] => {
  const now = clock.now()
  return [
    {
      id: idGen.generate('vol'),
      projectId,
      title: '正文卷',
      order: 1,
      createdAt: now,
      updatedAt: now,
    },
  ]
}

/**
 * 为纯净空白项目生成单张初始空白章节（内容为空或极简草稿占位，wordCount = 0）。
 */
export const buildBlankChapters = (
  projectId: string = LEGACY_PROJECT_ID,
  volumeId: string = '',
  idGen: IdGenerator = fallbackIdGenerator,
  clock: Clock = fallbackClock,
): ChapterRecord[] => {
  const now = clock.now()
  return [
    {
      id: idGen.generate('ch'),
      projectId,
      volumeId,
      title: '第1章',
      content: '<p></p>',
      wordCount: 0,
      order: 1,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    },
  ]
}

/**
 * 为指定项目生成三章示范正文（带 HTML 内容，可直接喂给 TipTap，供 Demo 示范项目使用）。
 */
export const buildSeedChapters = (
  projectId: string = LEGACY_PROJECT_ID,
  firstVolumeId?: string,
  idGen: IdGenerator = fallbackIdGenerator,
  clock: Clock = fallbackClock,
): ChapterRecord[] => {
  const now = clock.now()
  const volumeId = firstVolumeId ?? ''
  return SEED_CHAPTER_CONTENTS.map((c) => ({
    id: idGen.generate('ch'),
    projectId,
    volumeId,
    title: c.title,
    content: c.content,
    wordCount: c.wordCount,
    order: c.order,
    createdAt: now,
    updatedAt: now,
  }))
}
