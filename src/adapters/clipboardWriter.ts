import type { ClipboardWriter } from '../ports/clipboardWriter'

/** 默认剪贴板写入器：委托浏览器 navigator.clipboard。 */
export const clipboardWriter: ClipboardWriter = {
  async writeText(text: string): Promise<void> {
    await navigator.clipboard.writeText(text)
  },
}
