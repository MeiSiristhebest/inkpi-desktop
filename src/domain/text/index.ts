// 文本处理领域模块的聚合出口（仅做 re-export，方便调用方以单一路径导入）。
export { htmlToPlain, countWords } from './textStats'
export {
  formatChineseParagraphs,
  formatByPreset,
  type TypographyPreset,
  fixPunctuation,
  applyFindReplace,
} from './contentFormatter'
export { exportChapter, fontStackFor } from './chapterExporter'
export { analyzeWordFrequency, type WordFrequencyItem, type WordAnalysisResult } from './wordFrequency'
