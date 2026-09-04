import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { RhythmRadarMasterView } from "./RhythmRadarMasterView"
import { RhythmRadarDrawer } from "./RhythmRadarDrawer"

describe("RhythmRadar UI Components", () => {
  it("RhythmRadarMasterView renders correctly", () => {
    render(<RhythmRadarMasterView projectId="p1" />)
    expect(screen.getByText(/剧情节奏与断章雷达/)).toBeDefined()
  })

  it("RhythmRadarDrawer renders correctly", () => {
    render(
      <RhythmRadarDrawer
        projectId="p1"
        currentText="林凡拔剑怒斩！"
      />
    )
    expect(screen.getByText(/断章张力雷达/)).toBeDefined()
  })
})
