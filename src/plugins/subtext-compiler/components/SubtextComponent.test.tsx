import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { SubtextMasterView } from "./SubtextMasterView"
import { SubtextDrawer } from "./SubtextDrawer"

describe("SubtextCompiler UI Components", () => {
  it("SubtextMasterView renders correctly", () => {
    render(<SubtextMasterView projectId="p1" />)
    expect(screen.getByText(/潜台词与冰山对白双轨编译器/)).toBeDefined()
  })

  it("SubtextDrawer renders correctly", () => {
    render(
      <SubtextDrawer
        projectId="p1"
        currentText="林凡冷笑道：“你休想从我这里得到任何东西。”"
      />
    )
    expect(screen.getByText(/冰山对白探针/)).toBeDefined()
  })
})
