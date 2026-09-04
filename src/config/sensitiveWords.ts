// 默认敏感词库（离线确定性扫描用）。
// 评审 §2.1 指出该表曾在 CheckTools 与 SensitiveModal 两处重复定义，
// 现统一收口到此共享模块，避免漂移。
export const DEFAULT_SENSITIVE_WORDS = [
  '涉毒',
  '涉暴',
  '涉赌',
  '违禁品',
  '色情低俗',
  '反动言论',
  '血腥残忍',
  '极端恐怖',
]
