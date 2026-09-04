import type {
  ReaderPersonaType,
  ShadowDanmakuRecord,
} from "../../ports/shadowReaderRepository"

export type { ReaderPersonaType, ShadowDanmakuRecord }

export interface ShadowSimulationResult {
  danmakus: Omit<ShadowDanmakuRecord, "id" | "projectId" | "createdAt">[]
  toxicAlertCount: number
  sentimentSummary: {
    rage: number
    applause: number
    suspicious: number
    excited: number
  }
}
