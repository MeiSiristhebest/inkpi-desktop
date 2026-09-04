import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { ScrapbookMasterView } from "./ScrapbookMasterView"
import { ScrapbookDrawer } from "./ScrapbookDrawer"

describe("ScrapbookRecycler UI Components", () => {
  it("ScrapbookMasterView renders correctly", () => {
    render(<ScrapbookMasterView projectId="p1" />)
    expect(screen.getByText(/废稿灵感碎纸机回收站/)).toBeDefined()
  })

  it("ScrapbookDrawer renders correctly", () => {
    render(
      <ScrapbookDrawer
        projectId="p1"
        currentText="林凡走在大街上。"
      />
    )
    expect(screen.getByText(/废稿灵感推荐/)).toBeDefined()
  })
})
