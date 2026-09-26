// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lastActiveChapterKey } from './resumePointer'

/**
 * P1.3：续写指针由编辑器写、书架读，两边靠同一个键名对上。
 * 编辑器那一侧的键是内联字面量（它属于另一个改动栈），所以这里用源码契约把它钉住，
 * 而不是靠「改了名字应该会有人发现」。
 */
const editorHook = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'components',
  'editor',
  'hooks',
  'useChapterEditorModel.ts',
)

describe('续写章节指针（P1.3）', () => {
  it('键名与编辑器落盘时用的是同一个', () => {
    expect(lastActiveChapterKey('p-1')).toBe('inkpi_last_active_chapter:p-1')

    const source = readFileSync(editorHook, 'utf8')
    expect(
      source,
      '编辑器换了续写指针的键名，书架的「继续《章节》」会静默失效：请同步 src/lib/resumePointer.ts',
    ).toContain('`inkpi_last_active_chapter:${projectId}`')
  })
})
