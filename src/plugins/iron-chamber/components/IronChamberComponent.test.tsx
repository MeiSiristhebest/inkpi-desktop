import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { IronChamberMasterView } from "./IronChamberMasterView"
import { IronChamberDrawer } from "./IronChamberDrawer"

describe("IronChamber UI Components", () => {
  it("IronChamberMasterView renders correctly", () => {
    render(<IronChamberMasterView projectId="p1" />)
    expect(screen.getByText(/黑曜石小黑屋/)).toBeDefined()
  })

  it("IronChamberDrawer renders correctly", () => {
    render(
      <IronChamberDrawer
        projectId="p1"
        currentText="林凡走在大街上。"
      />
    )
    expect(screen.getByText(/小黑屋心流守卫/)).toBeDefined()
  })
})
