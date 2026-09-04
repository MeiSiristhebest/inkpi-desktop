import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { PovGuardMasterView } from "./PovGuardMasterView"
import { PovGuardDrawer } from "./PovGuardDrawer"

describe("PovGuard UI Components", () => {
  it("PovGuardMasterView renders correctly", () => {
    render(<PovGuardMasterView projectId="p1" />)
    expect(screen.getByText(/POV 心智防火墙/)).toBeDefined()
  })

  it("PovGuardDrawer renders correctly with analysis stats", () => {
    render(
      <PovGuardDrawer
        projectId="p1"
        currentText="林凡走在大街上。"
      />
    )
    expect(screen.getByText(/POV 心智防火墙/)).toBeDefined()
  })
})
