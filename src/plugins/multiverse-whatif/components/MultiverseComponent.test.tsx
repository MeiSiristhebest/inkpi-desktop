import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MultiverseMasterView } from "./MultiverseMasterView"
import { MultiverseDrawer } from "./MultiverseDrawer"

describe("MultiverseWhatIf UI Components", () => {
  it("MultiverseMasterView renders correctly", () => {
    render(<MultiverseMasterView projectId="p1" />)
    expect(screen.getByText(/平行宇宙因果沙盒推演器/)).toBeDefined()
  })

  it("MultiverseDrawer renders correctly", () => {
    render(
      <MultiverseDrawer
        projectId="p1"
        currentText=""
      />
    )
    expect(screen.getByText(/平行时空沙盒/)).toBeDefined()
  })
})

