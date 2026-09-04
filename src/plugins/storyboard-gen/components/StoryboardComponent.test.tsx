import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { StoryboardMasterView } from "./StoryboardMasterView"
import { StoryboardDrawer } from "./StoryboardDrawer"

describe("StoryboardGen UI Components", () => {
  it("StoryboardMasterView renders correctly", () => {
    render(<StoryboardMasterView projectId="p1" />)
    expect(screen.getByText(/角色立绘与分镜生成器/)).toBeDefined()
    expect(screen.getByText(/电影视听“起承转合”四格高潮分镜提炼/)).toBeDefined()
  })

  it("StoryboardDrawer renders correctly with text preview", () => {
    render(
      <StoryboardDrawer
        projectId="p1"
        currentText="林凡眼神冰冷，握紧手中的断剑，周围剑气如龙卷般肆虐！"
      />
    )
    expect(screen.getByText(/名场面四格分镜/)).toBeDefined()
    expect(screen.getByText(/镜头就绪/)).toBeDefined()
  })
})


