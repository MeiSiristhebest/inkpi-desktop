import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { SoundscapeMasterView } from "./SoundscapeMasterView"
import { SoundscapeDrawer } from "./SoundscapeDrawer"

describe("Soundscape UI Components", () => {
  it("SoundscapeMasterView renders correctly", () => {
    render(<SoundscapeMasterView projectId="p1" />)
    expect(screen.getByText(/机械键盘声学与白噪音伴奏/)).toBeDefined()
  })

  it("SoundscapeDrawer renders correctly", () => {
    render(
      <SoundscapeDrawer
        projectId="p1"
        currentText="林凡走在大街上。"
      />
    )
    expect(screen.getByText(/键盘伴奏 HUD/)).toBeDefined()
  })
})
