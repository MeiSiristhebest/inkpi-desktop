import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { NarrativeLinterMasterView } from "./NarrativeLinterMasterView"
import { NarrativeLinterDrawer } from "./NarrativeLinterDrawer"
import { DesktopPluginHostProvider } from "../../../core/pluginHostContext"

const { getChaptersByProject } = vi.hoisted(() => ({
  getChaptersByProject: vi.fn(),
}))

vi.mock("../../../adapters/indexedDbProjectRepository", () => ({
  indexedDbProjectRepository: { getChaptersByProject },
}))

describe("NarrativeLinter UI Components", () => {
  beforeEach(() => {
    getChaptersByProject.mockResolvedValue([
      {
        id: "chapter-1",
        projectId: "p1",
        volumeId: "v1",
        title: "第一章",
        order: 1,
        content: "<p>第一章正文</p>",
        revision: 1,
      },
      {
        id: "chapter-2",
        projectId: "p1",
        volumeId: "v1",
        title: "第二章",
        order: 2,
        content: "<h2>第二章</h2><p>第二章正文</p>",
        revision: 4,
      },
    ])
  })

  it("NarrativeLinterMasterView renders correctly", () => {
    render(<NarrativeLinterMasterView projectId="p1" />)
    expect(screen.getByText(/360\+ 文学质量与人设门禁/)).toBeDefined()
  })

  it("NarrativeLinterDrawer renders correctly with score", () => {
    render(
      <NarrativeLinterDrawer
        projectId="p1"
        currentText="林凡拔出了长剑。"
      />
    )
    expect(screen.getByText(/文学质量门禁巡检/)).toBeDefined()
  })

  it("projects selected chapter HTML into semantic text before rules and AI", async () => {
    const onAiTask = vi.fn(async () => null)
    render(
      <DesktopPluginHostProvider
        projectId="p1"
        activeChapter={null}
        onAiTask={onAiTask}
        isAiConnected
      >
        <NarrativeLinterMasterView projectId="p1" />
      </DesktopPluginHostProvider>,
    )

    const selector = await screen.findByRole("combobox")
    expect(screen.getByDisplayValue("第一章正文")).toBeInTheDocument()
    fireEvent.change(selector, { target: { value: "chapter-2" } })

    const textarea = screen.getByRole("textbox")
    await waitFor(() => expect(textarea).toHaveValue("第二章\n第二章正文"))
    screen.getByRole("button", { name: "AI 叙事深度体检" }).click()

    expect(onAiTask).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({
        payload: expect.objectContaining({
          analysisInput: { chapter: { id: "chapter-2", order: 2, title: "第二章" }, text: "第二章\n第二章正文" },
        }),
      }),
    }))
  })
})
