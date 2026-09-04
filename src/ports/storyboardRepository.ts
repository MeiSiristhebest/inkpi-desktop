export type CameraShotType = "establishing_wide" | "medium_confrontation" | "dutch_closeup" | "impact_wide"

export interface ShotFrame {
  id: string
  shotOrder: number // 1: 起, 2: 承, 3: 转, 4: 合
  shotType: CameraShotType
  shotLabel: string // "远景全景·环境入胜", "中景对峙·剑拔弩张", "特写倾斜·绝命反转", "广角高潮·余波震撼"
  description: string
  compositionGuide: "rule_of_thirds" | "diagonal_impact" | "leading_sightlines" | "center_monumental"
  lightingMood: string // "冷峻月光", "赤炎残阳", "雷暴雷光", "幽暗地窟"
  visualPrompt: string
}

export interface CharacterVisualCard {
  characterId: string
  characterName: string
  visualFeatures: string // 发型发色、服饰装束、兵器配饰、神态气场
  stableDiffusionPrompt: string
}

export interface StoryboardSceneRecord {
  id: string
  projectId: string
  chapterId: string
  sceneTitle: string
  shotFrames: ShotFrame[]
  characterCards: CharacterVisualCard[]
  createdAt: number
}

export interface StoryboardRepository {
  getAll(projectId: string): Promise<StoryboardSceneRecord[]>
  getByChapter(chapterId: string): Promise<StoryboardSceneRecord[]>
  get(id: string): Promise<StoryboardSceneRecord | undefined>
  save(record: StoryboardSceneRecord): Promise<void>
  delete(id: string): Promise<void>
}

