import { describe, it, expect, vi, beforeEach } from 'vitest'
import { pluginEventBus } from './pluginEventBus'
import { ChekhovRadarEngine } from '../plugins/chekhov-radar/engine/ChekhovRadarEngine'
import { readerHookEngine } from '../plugins/reader-hook/engine/ReaderHookEngine'

describe('Cross-Plugin EventBus Reactive Dataflow', () => {
  beforeEach(() => {
    pluginEventBus.clear()
  })

  it('chekhov-radar提及伏笔时，应当正确广播 FORESHADOW_PLANTED 事件', () => {
    const listener = vi.fn()
    pluginEventBus.on('FORESHADOW_PLANTED', listener)

    const guns = [
      {
        id: 'g-1',
        projectId: 'proj-1',
        gunName: '玄天残卷',
        plantChapterOrder: 3,
        plantSnippet: '得此残卷',
        rustingDistance: 0,
        isRustingAlert: false,
        category: 'item',
        status: 'incubating' as const,
        description: '神秘残卷',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]

    const chapterText = '林凡拿出怀中的玄天残卷，眸光深邃。'
    ChekhovRadarEngine.checkMentionedGuns(guns, chapterText, 'proj-1')

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'proj-1',
        gunName: '玄天残卷',
        plantChapterOrder: 3,
        category: 'item',
      }),
    )
  })

  it('reader-hook审计章节时，应当正确广播 CHAPTER_CONTENT_AUDITED 事件', () => {
    const listener = vi.fn()
    pluginEventBus.on('CHAPTER_CONTENT_AUDITED', listener)

    const text = '天穹崩塌，巨兽睁开了猩红巨眸！这一切究竟该何去何从？'
    readerHookEngine.auditChapterEnding({
      projectId: 'proj-88',
      chapterId: 'ch-12',
      content: text,
    })

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'proj-88',
        chapterId: 'ch-12',
      }),
    )
  })

  it('验证事件总线对后期挂载组件具备自动 Replay 回放能力（解决跨插件懒加载时序问题）', () => {
    // 1. 发射源在组件订阅前先行广播
    const text = '天穹崩塌，巨兽睁开了猩红巨眸！'
    readerHookEngine.auditChapterEnding({
      projectId: 'proj-replay',
      chapterId: 'ch-replay',
      content: text,
    })

    // 2. 模拟懒加载抽屉组件（如 EmotionCurveDrawer）在后续时机挂载并调用 .on 订阅
    const lateSubscriber = vi.fn()
    const unsub = pluginEventBus.on('CHAPTER_CONTENT_AUDITED', lateSubscriber)

    // 3. 断言后挂载的订阅者通过 Replay 成功接收到了历史事件
    expect(lateSubscriber).toHaveBeenCalledTimes(1)
    expect(lateSubscriber).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'proj-replay',
        chapterId: 'ch-replay',
      }),
    )

    unsub()
  })
})
