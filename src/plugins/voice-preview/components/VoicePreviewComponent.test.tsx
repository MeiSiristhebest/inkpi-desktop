import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { VoicePreviewMasterView } from "./VoicePreviewMasterView"
import { VoicePreviewDrawer } from "./VoicePreviewDrawer"

describe("VoicePreview UI Components", () => {
  it("VoicePreviewMasterView renders correctly", () => {
    render(<VoicePreviewMasterView projectId="p1" />)
    expect(screen.getByText(/角色拟真有声对白试听器/)).toBeDefined()
  })

  it("VoicePreviewDrawer renders correctly", () => {
    render(
      <VoicePreviewDrawer
        projectId="p1"
        currentText='林凡冷笑道：“今日之辱，来日必报！”'
      />
    )
    expect(screen.getByText(/广播剧对白试听/)).toBeDefined()
  })
})

