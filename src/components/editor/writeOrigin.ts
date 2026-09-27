import { countWords, htmlToPlain } from '../../domain/text/textStats'

/**
 * §P3.10 正文写入来源。
 *
 * 领域层的日产量已经按 `ChapterMutationOrigin` 归因（AI/导入不计入作者当日码字量），
 * 但编辑器悬浮窗的「今日新增」只看文档变长了多少：采纳 AI 续写、批量替换、以及
 * 权威写入路径用 `setContent(…, { emitUpdate: false })` 灌回的整段改写，都会在下一次
 * 击键时被算成作者手打。来源只能在事务边界上区分，所以由写入方打标、统计方读取。
 */
export const WRITE_ORIGIN_META = 'inkpi:writeOrigin'

export type WriteOrigin = 'user-typing' | 'ai' | 'bulk-edit'

type MetaReader = { getMeta(key: string): unknown } | undefined

/** 没有标记的事务就是真实输入（DOM 击键/输入法），默认归给作者。 */
export function readWriteOrigin(transaction: MetaReader): WriteOrigin {
  const tag = transaction?.getMeta(WRITE_ORIGIN_META)
  return tag === 'ai' || tag === 'bulk-edit' ? tag : 'user-typing'
}

export function countsAsAuthorTyping(transaction: MetaReader): boolean {
  return readWriteOrigin(transaction) === 'user-typing'
}

/** 去掉标签与排版空白后的可打印字符数，与编辑器侧 `getText()` 去空白后的量纲一致。 */
export function plainLength(html: string): number {
  return countWords(htmlToPlain(html || ''))
}
