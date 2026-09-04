import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { ShadowReaderMasterView } from "./ShadowReaderMasterView"
import { ShadowReaderDrawer } from "./ShadowReaderDrawer"

describe("ShadowReader UI Components", () => {
  it("ShadowReaderMasterView renders correctly", () => {
    render(<ShadowReaderMasterView projectId="p1" />)
    expect(screen.getByText(/读者弹幕与毒点预判模拟器/)).toBeDefined()
  })

  it("ShadowReaderDrawer renders correctly", () => {
    render(
      <ShadowReaderDrawer
        projectId="p1"
        currentText="林凡一剑封喉！全场寂静，倒吸一口凉气！"
      />
    )
    expect(screen.getByText(/读者弹幕哨兵/)).toBeDefined()
  })
})

