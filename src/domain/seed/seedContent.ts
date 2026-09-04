// 首次启动的示范章节正文（领域层示例内容）。
//
// 与种子「结构」(domain/seed.ts 的 buildSeedVolumes / buildSeedChapters) 刻意分离：
// 种子结构只负责卷/章的骨架与从属关系，示范正文作为可独立维护的示例内容放在此处，
// 避免业务示例文案散落在纯结构逻辑中（评审 §1.2）。

export interface SeedChapterContent {
  title: string
  content: string
  wordCount: number
  order: number
}

/** 三章示范正文（带 HTML，可直接喂给 TipTap）。 */
export const SEED_CHAPTER_CONTENTS: SeedChapterContent[] = [
  {
    title: '第001章 寒潭惊变',
    content:
      '<p>　　夜幕低垂，寒风卷着碎雪拍打在窗棂上，发出刺耳的呜咽声。</p><p>　　少年盘膝坐在冰冷的青石地面上，周身三尺之内，隐隐泛起微弱的淡青色毫光。他下意识地握紧了手中的断剑，感知着丹田深处那一缕若有若无的清凉灵气。</p><p>　　“三年了。”少年低声呢喃，眸子深处掠过一丝冷冽，“沧澜宗欠我的，也该一笔笔算回来了。”</p>',
    wordCount: 156,
    order: 0,
  },
  {
    title: '第002章 锈剑之鸣',
    content: '<p>　　更深露重，窗外的风声渐渐平息。</p>',
    wordCount: 16,
    order: 1,
  },
  {
    title: '第003章 破局斩妄',
    content: '<p>　　天色将明未明之际，院外传来了急促的脚步声。</p>',
    wordCount: 22,
    order: 2,
  },
]
