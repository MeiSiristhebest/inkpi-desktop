import type {
  CliffhangerType,
  PacingStatus,
  CliffhangerSuggestion,
  RhythmRadarReportRecord,
} from "../../ports/rhythmRadarRepository"

export type {
  CliffhangerType,
  PacingStatus,
  CliffhangerSuggestion,
  RhythmRadarReportRecord,
}

export interface ChapterTensionPoint {
  chapterOrder: number
  tensionScore: number
}
