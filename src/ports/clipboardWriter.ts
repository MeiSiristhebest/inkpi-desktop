/**
 * 剪贴板写入端口（抽象）。
 *
 * 把 navigator.clipboard 这一浏览器副作用从视图层隔离出去，
 * 视图只调用 writeText(...)，具体实现（Web Clipboard / 降级方案 / 测试桩）由适配器决定。
 */
export interface ClipboardWriter {
  writeText(text: string): Promise<void>
}
