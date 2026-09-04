import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { GoldChaptersMasterView } from "./GoldChaptersMasterView"
import { GoldChaptersDrawer } from "./GoldChaptersDrawer"

describe("GoldChaptersEval UI Components", () => {
  it("GoldChaptersMasterView renders correctly", () => {
    render(<GoldChaptersMasterView projectId="p1" />)
    expect(screen.getByText(/黄金三章与签约过稿诊断器/)).toBeDefined()
  })

  it("GoldChaptersDrawer renders correctly", () => {
    render(
      <GoldChaptersDrawer
        projectId="p1"
        currentText="林凡发誓要复仇，觉醒了金手指系统！"
      />
    )
    expect(screen.getByText(/黄金三章过稿探针/)).toBeDefined()
  })
})
