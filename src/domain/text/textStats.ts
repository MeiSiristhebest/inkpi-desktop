// 纯文本统计与 HTML→纯文本转换（领域层，无 React / 无 DOM 依赖，便于单测）。

/** 把 TipTap 产出的 HTML 转成纯文本（去标签，块级元素间保留换行） */
export const htmlToPlain = (html: string): string => {
  // 在块级元素闭合与 <br> 处插入换行，保证段落结构在纯文本中得以保留
  const withBreaks = (html || '')
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
  if (typeof document === 'undefined') {
    // 测试 / SSR 环境：用极简的正则去标签兜底
    return withBreaks.replace(/<[^>]+>/g, '\n').replace(/\n{2,}/g, '\n').trim()
  }
  const doc = new DOMParser().parseFromString(withBreaks, 'text/html')
  return (doc.body.textContent || '').replace(/\n{2,}/g, '\n').trim()
}

/** 汉字去空白实时字数：剔除所有空白后的纯文本长度 */
export const countWords = (text: string): number => (text || '').replace(/\s+/g, '').length
