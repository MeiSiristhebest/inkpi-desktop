/**
 * 全局 Z-Index 分层常量规范：
 * - BASE: 0 (常规流内容)
 * - STICKY: 10 (打字机参考线、悬浮微件)
 * - SIDEBAR: 30 (抽屉、侧栏)
 * - POPOVER: 40 (局部浮层、Tooltip)
 * - DROPDOWN: 50 (顶栏下拉菜单、右键上下文菜单)
 * - MODAL: 60 (全屏模态弹窗、确认框、冲突排查弹窗)
 * - TOAST: 70 (系统级全局通知、错误报警)
 */
export const Z_INDEX = {
  BASE: 0,
  STICKY: 10,
  SIDEBAR: 30,
  POPOVER: 40,
  DROPDOWN: 50,
  MODAL: 60,
  TOAST: 70,
} as const
