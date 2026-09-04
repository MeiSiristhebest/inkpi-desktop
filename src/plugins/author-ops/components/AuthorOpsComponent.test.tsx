import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { AuthorOpsMasterView } from "./AuthorOpsMasterView"
import { AuthorOpsDrawer } from "./AuthorOpsDrawer"

describe("AuthorOps UI Components", () => {
  it("AuthorOpsMasterView renders correctly", () => {
    render(<AuthorOpsMasterView projectId="p1" />)
    expect(screen.getByText(/连载运营台账与作者商业名片/)).toBeDefined()
  })

  it("AuthorOpsDrawer renders correctly", () => {
    render(
      <AuthorOpsDrawer
        projectId="p1"
        currentText=""
      />
    )
    expect(screen.getByText(/连载追读哨兵/)).toBeDefined()
  })
})

