import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { NarrativeLinterMasterView } from "./NarrativeLinterMasterView"
import { NarrativeLinterDrawer } from "./NarrativeLinterDrawer"

describe("NarrativeLinter UI Components", () => {
  it("NarrativeLinterMasterView renders correctly", () => {
    render(<NarrativeLinterMasterView projectId="p1" />)
    expect(screen.getByText(/360\+ 文学质量与人设门禁/)).toBeDefined()
  })

  it("NarrativeLinterDrawer renders correctly with score", () => {
    render(
      <NarrativeLinterDrawer
        projectId="p1"
        currentText="林凡拔出了长剑。"
      />
    )
    expect(screen.getByText(/文学质量门禁巡检/)).toBeDefined()
  })
})
