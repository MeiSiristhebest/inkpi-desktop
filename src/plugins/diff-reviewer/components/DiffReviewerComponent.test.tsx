import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { DiffReviewerMasterView } from "./DiffReviewerMasterView"
import { DiffReviewerDrawer } from "./DiffReviewerDrawer"

describe("DiffReviewer UI Components", () => {
  it("DiffReviewerMasterView renders correctly", () => {
    render(<DiffReviewerMasterView projectId="p1" />)
    expect(screen.getByText(/双栏 Plan\/Apply 审校与合并器/)).toBeDefined()
  })

  it("DiffReviewerDrawer renders correctly with stats", () => {
    render(
      <DiffReviewerDrawer
        projectId="p1"
        currentText="林凡走在大街上。"
      />
    )
    expect(screen.getByText(/双栏审校随动/)).toBeDefined()
  })
})
