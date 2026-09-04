import type { ConfirmDialog } from '../ports/confirmDialog'

/** 默认确认对话框：委托浏览器 window.confirm，返回 Promise 以便 await。 */
export const confirmDialog: ConfirmDialog = {
  async confirm(message: string): Promise<boolean> {
    return window.confirm(message)
  },
}
