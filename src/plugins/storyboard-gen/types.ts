import type {
  CameraShotType,
  ShotFrame,
  CharacterVisualCard,
  StoryboardSceneRecord,
} from "../../ports/storyboardRepository"

export type {
  CameraShotType,
  ShotFrame,
  CharacterVisualCard,
  StoryboardSceneRecord,
}

export interface ClimaxStoryboardExtraction {
  sceneTitle: string
  coreConflict: string
  frames: ShotFrame[]
  suggestedCharacters: CharacterVisualCard[]
}

