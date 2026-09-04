/**
 * 章节 HTML 文档渲染器（呈现层适配）。
 *
 * 把「导出为可双击打开的网页文档」所需的 <style> 排版与 <title> 包装从领域层移出，
 * 领域层（chapterExporter）只负责纯文本 / Markdown 转换，不再包含任何 CSS / DOM 结构。
 * 这里集中承载呈现细节（字体、缩进、颜色），便于统一调整导出样式。
 */

/** 转义 HTML 特殊字符，避免标题破坏文档结构 */
const escapeHtml = (s: string): string =>
  (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/**
 * 将章节正文（已是 HTML 片段）包装为独立、可双击打开的网页文档。
 * @param title 章节标题（会做 HTML 转义）
 * @param bodyHtml 章节正文 HTML 片段
 */
export const renderChapterHtmlDocument = (title: string, bodyHtml: string): string => {
  const body = bodyHtml || ''
  return `<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n<title>${escapeHtml(
    title,
  )}</title>\n<style>body{font-family:system-ui,-apple-system,'PingFang SC','Microsoft YaHei',serif;max-width:42rem;margin:2rem auto;padding:0 1rem;line-height:1.9;color:#222}p{text-indent:2em;margin:.6em 0}</style>\n</head>\n<body>\n${body}\n</body>\n</html>`
}
