import type { KeyValueStore } from '../ports/keyValueStore'
import { localStorageKeyValueStore } from '../adapters/localStorageKeyValueStore'

/**
 * 「上次打开的章节」指针。
 *
 * 写入方是编辑器（`components/editor/hooks/useChapterEditorModel.ts`：切章时落盘、
 * 打开项目时恢复到那一章），书架只是读它来把「继续写作」写成具体章节。
 * 两端都用到这个键，所以名字只有这一处；契约测试会钉住编辑器源码里仍是同一字面量。
 */
export const lastActiveChapterKey = (projectId: string): string =>
  `inkpi_last_active_chapter:${projectId}`

/** 上次打开的章节 id；从未打开过或指针被清理时返回 null。 */
export const readLastChapterId = async (
  projectId: string,
  store: KeyValueStore = localStorageKeyValueStore,
): Promise<string | null> => (await store.get(lastActiveChapterKey(projectId))) || null

/**
 * 指针指向的章节标题。章节已被删除时返回 undefined——
 * 与编辑器自己的处理一致：找不到就回到第一章，不拿一个不存在的章节说事。
 */
export const resolveResumeChapterTitle = async <T extends { id: string; title: string }>(
  projectId: string,
  chapters: T[],
  store: KeyValueStore = localStorageKeyValueStore,
): Promise<string | undefined> => {
  const id = await readLastChapterId(projectId, store)
  return id ? chapters.find((c) => c.id === id)?.title : undefined
}
