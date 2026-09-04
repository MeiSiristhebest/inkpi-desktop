// 章节命名领域规则（评审 §1.6）：默认标题从视图层外移到领域，避免业务默认值散落各处。

/** 新章节的默认标题：第 001 章 未命名（order 从 0 起） */
export const composeChapterTitle = (order: number): string =>
  `第${String(order + 1).padStart(3, '0')}章 未命名`
