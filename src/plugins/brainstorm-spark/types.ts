export type DilemmaType =
  | 'dead_end' // 必死绝境
  | 'moral_dilemma' // 两难道德/抉择
  | 'identity_leak' // 身份暴雷暴露
  | 'clue_fracture' // 逻辑断线/迷雾
  | 'resource_depleted' // 弹尽粮绝
  | 'hostage_threat' // 挚友被执/人质受制

export interface SparkSolution {
  operatorId: string
  operatorName: string
  corePrinciple: string
  concretePlot: string
  twistImpact: 'subtle' | 'dramatic' | 'earthshaking'
  pros: string
  cons: string
}

export interface BrainstormSpark {
  id: string
  projectId: string
  dilemmaType: DilemmaType
  dilemmaTitle: string
  coreProblem: string
  currentSituation: string
  protagonistGoal: string
  enemyAdvantage: string
  selectedSolution?: SparkSolution
  generatedSolutions: SparkSolution[]
  tags: string[]
  updatedAt: number
}
