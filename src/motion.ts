/**
 * InkPi 动效规范 — 基于 motion (framer-motion v13) 的统一弹簧物理系统
 *
 * 设计原则：
 *   - Apple HIG：所有动效必须有物理感（弹簧阻尼），不允许线性匀速
 *   - Notion：克制、不抢戏，动效服务于内容，而非展示自身
 *   - 可访问性：所有动效尊重 prefers-reduced-motion（motion 自动处理）
 *
 * 使用方式：
 *   import { spring, variants, transition } from '@/motion'
 *   <motion.div {...variants.fadeUp} transition={spring.default} />
 *
 * 绝不在组件内内联写死 duration / ease，全部从这里取。
 */

// ─── 一、弹簧参数集（Spring Presets）───────────────────────────────────────────
// 参数含义：
//   stiffness  = 弹性系数（越大越快弹回，越小越软）
//   damping    = 阻尼（越小越弹跳，越大越平稳停止）
//   mass       = 质量（越大越有惯性，越慢启动）
//
// 所有参数均参考 iOS / macOS CoreAnimation 的公开物理常数。

export const spring = {
  /** 默认弹簧：大多数 UI 元素的通用选择（按钮、卡片、开关） */
  default: { type: 'spring' as const, stiffness: 400, damping: 30, mass: 0.8 },

  /** 轻柔弹簧：大面积元素入场（详情页推入、设置面板）*/
  gentle: { type: 'spring' as const, stiffness: 280, damping: 26, mass: 1 },

  /** 弹跳弹簧：强调性小元素（徽章、提示、通知点） */
  bouncy: { type: 'spring' as const, stiffness: 500, damping: 22, mass: 0.6 },

  /** 极快弹簧：微交互反馈（hover 高亮、焦点环） */
  snappy: { type: 'spring' as const, stiffness: 600, damping: 35, mass: 0.5 },

  /** 缓慢弹簧：大型叙事性过渡（未来页面级路由切换） */
  slow: { type: 'spring' as const, stiffness: 180, damping: 24, mass: 1.2 },
} as const

// ─── 二、非弹簧时序（Tween Presets）──────────────────────────────────────────
// 仅用于：透明度淡入淡出（opacity）、颜色过渡、纯 CSS 属性
// 不适合位移 / 缩放（必须用 spring）

export const tween = {
  /** 标准淡入淡出 */
  fade: { type: 'tween' as const, duration: 0.18, ease: [0.2, 0.8, 0.2, 1] as const },
  /** 快速色彩/背景切换 */
  color: { type: 'tween' as const, duration: 0.12, ease: 'easeOut' as const },
} as const

// ─── 三、动效变体（Variants）──────────────────────────────────────────────────
// 规范：
//   initial  = 进入前的初始状态
//   animate  = 进入后的目标状态
//   exit     = 离开时的状态（需配合 AnimatePresence）

export const variants = {
  /** 向上淡入（列表项、卡片、提示框） */
  fadeUp: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 4 },
  },

  /** 向下淡入（下拉菜单、工具提示） */
  fadeDown: {
    initial: { opacity: 0, y: -8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -4 },
  },

  /** 纯淡入淡出（overlay、遮罩层） */
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },

  /** 从右推入（详情页 drill-down，类 iOS 导航） */
  slideInFromRight: {
    initial: { opacity: 0, x: 16 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -8 },
  },

  /** 从左推入（返回上一级） */
  slideInFromLeft: {
    initial: { opacity: 0, x: -16 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 8 },
  },

  /** 从底部弹入（抽屉 Drawer、移动端 Sheet） */
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 16 },
  },

  /** 缩放弹入（模态框、弹出菜单、气泡） */
  scaleIn: {
    initial: { opacity: 0, scale: 0.94 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.96 },
  },
} as const

// ─── 四、列表交错动效（Stagger）──────────────────────────────────────────────
// 用法：在父容器上设置 stagger.container，子元素设置 stagger.item

export const stagger = {
  /** 父容器：控制子元素的交错时间 */
  container: (staggerSec = 0.05) => ({
    animate: { transition: { staggerChildren: staggerSec } },
  }),

  /** 子元素变体 */
  item: {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 3 },
  },
} as const

// ─── 五、手势交互（Gesture Props）────────────────────────────────────────────
// 直接展开到 motion.button / motion.div 上

export const gesture = {
  /** 标准按钮触感（Primary / Secondary Button） */
  button: {
    whileHover: { scale: 1.02 },
    whileTap: { scale: 0.97 },
  },

  /** 轻微悬停高亮（列表行、卡片行） */
  listRow: {
    whileTap: { scale: 0.995 },
  },

  /** 图标按钮（工具栏小图标） */
  iconButton: {
    whileHover: { scale: 1.1 },
    whileTap: { scale: 0.9 },
  },

  /** 危险操作按钮（删除） */
  dangerButton: {
    whileHover: { scale: 1.05 },
    whileTap: { scale: 0.95 },
  },
} as const

// ─── 六、布局动画辅助（Layout）───────────────────────────────────────────────
// layout prop 让 motion 自动计算元素尺寸变化并平滑过渡
// layoutId 实现共享元素过渡（同一 layoutId 的两个元素之间会有"飞翔"动效）

export const layout = {
  /** 高度/宽度自适应展开收起（替代 CSS max-height hack） */
  expand: {
    layout: true as const,
    transition: { type: 'spring' as const, stiffness: 320, damping: 28 },
  },
} as const
