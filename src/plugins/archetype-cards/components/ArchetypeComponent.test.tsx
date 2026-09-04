import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { ArchetypeMasterView } from "./ArchetypeMasterView"
import { ArchetypeDrawer } from "./ArchetypeDrawer"

describe("ArchetypeCards UI Components", () => {
  it("ArchetypeMasterView renders correctly", () => {
    render(<ArchetypeMasterView projectId="p1" />)
    expect(screen.getByText(/人格原型素材库与叙事母题卡牌/)).toBeDefined()
  })

  it("ArchetypeDrawer renders correctly", () => {
    render(
      <ArchetypeDrawer
        projectId="p1"
        currentText="林凡走在大街上。"
      />
    )
    expect(screen.getByText(/人格原型灵感卡/)).toBeDefined()
  })
})
