/**
 * 确认对话框端口（抽象）。
 *
 * 把 window.confirm 这一阻塞式浏览器副作用隔离为可注入依赖，
 * 视图只调用 confirm(message) 拿到 Promise<boolean>，测试可注入自动应答的桩。
 */
export interface ConfirmDialog {
  confirm(message: string): Promise<boolean>
}
