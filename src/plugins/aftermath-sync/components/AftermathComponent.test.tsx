import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { AftermathMasterView } from "./AftermathMasterView"
import { AftermathDrawer } from "./AftermathDrawer"

describe("AftermathSync UI Components", () => {
  it("AftermathMasterView renders correctly", () => {
    render(<AftermathMasterView projectId="p1" />)
    expect(screen.getByText(/章后桥段设定回写器/)).toBeDefined()
  })

  it("AftermathDrawer renders correctly", () => {
    render(
      <AftermathDrawer
        projectId="p1"
        currentText="林凡突破到了金丹初期。"
      />
    )
    expect(screen.getByText(/设定回写提案/)).toBeDefined()
  })
})
