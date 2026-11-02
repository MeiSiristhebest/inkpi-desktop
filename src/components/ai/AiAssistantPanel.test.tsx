import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { referenceLibraryService } from '../../services/referenceLibraryService'
import type { DesktopPreparedContextCoverage } from '../../types/aiContextCoverage'
import { AiAssistantPanel } from './AiAssistantPanel'

const desktopPreparedCoverage: DesktopPreparedContextCoverage = {
  version: 1,
  documentText: { sourceCharacters: 100, includedCharacters: 50, rangeStart: 50, rangeEnd: 100 },
  selectionText: {
    explicitSelection: true,
    sourceCharacters: 8,
    includedCharacters: 8,
    rangeStart: 60,
    rangeEnd: 68,
  },
  semanticBlocks: { count: 1, characters: 100 },
  neighboringDocuments: { count: 0, characters: 0 },
  storyState: { attached: false, recordCount: 0 },
  storyContext: { recordCount: 0, canonicalFactCount: 0, hypothesisCount: 0 },
  jit: { entityCount: 0, promiseCount: 0 },
}

describe('AiAssistantPanel Component', () => {
  it('should render empty state when no messages provided', () => {
    render(
      <AiAssistantPanel
        messages={[]}
        input=""
        busy={false}
        connected={true}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('副驾驶')).toBeInTheDocument()
    expect(screen.getByText('活动中心')).toBeInTheDocument()
    expect(screen.getByText('与 InkPi Agent 对话')).toBeInTheDocument()
  })

  it('should switch to activity center when activity tab is clicked', () => {
    render(
      <AiAssistantPanel
        messages={[]}
        input=""
        busy={false}
        connected={true}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /活动中心/ }))
    expect(screen.getByTestId('ai-activity-center')).toBeInTheDocument()
    expect(screen.getByText('所有后台任务已完成，无挂起活动')).toBeInTheDocument()
  })

  it('should render user and assistant messages and handle input & send', () => {
    const onInputChange = vi.fn()
    const onSend = vi.fn()
    const onClose = vi.fn()

    render(
      <AiAssistantPanel
        messages={[
          { role: 'user', text: '续写下一段' },
          { role: 'assistant', text: '夜幕降临，月光洒在废墟上。' },
        ]}
        input="修改一下描写"
        busy={false}
        connected={true}
        onInputChange={onInputChange}
        onSend={onSend}
        onClose={onClose}
      />,
    )

    expect(screen.getByText('续写下一段')).toBeInTheDocument()
    expect(screen.getByText('夜幕降临，月光洒在废墟上。')).toBeInTheDocument()

    const input = screen.getByPlaceholderText('向 InkPi 下达写作指令…')
    fireEvent.change(input, { target: { value: '写得生动一些' } })
    expect(onInputChange).toHaveBeenCalledWith('写得生动一些')

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSend).toHaveBeenCalled()

    const closeBtn = screen.getByRole('button', { name: '收起' })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
  })

  it('shows prepared context coverage on the sent user message, not as a provider receipt', () => {
    render(
      <AiAssistantPanel
        messages={[
          {
            role: 'user',
            text: '请分析这一章',
            desktopPreparedContextCoverage: desktopPreparedCoverage,
          },
        ]}
        input=""
        busy={false}
        connected={true}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    const disclosure = screen.getByTestId('chat-context-coverage-0')
    expect(disclosure).toHaveTextContent('Desktop 预备上下文（不是最终 Runtime/Provider 请求）')
    expect(disclosure).toHaveTextContent('正文片段：50/100 个 UTF-16 字符')
    expect(disclosure).toHaveTextContent('最终请求由 Runtime 与 Provider 在执行阶段组装')
  })

  it('requires per-task reference selection and clears it after sending', async () => {
    const source = {
      id: 'ref-urban',
      title: '都市交通资料',
      originalFileName: 'urban.md',
      format: 'md' as const,
      text: '北京地铁线路资料',
      tags: ['都市'],
      contentFingerprint: 'fingerprint',
      importedAt: 1,
      updatedAt: 1,
    }
    const listSources = vi
      .spyOn(referenceLibraryService, 'listProjectSources')
      .mockResolvedValue([{ source, attached: true }])
    const onSend = vi.fn()
    render(
      <AiAssistantPanel
        messages={[]}
        input="分析都市交通"
        busy={false}
        connected={true}
        projectId="project-1"
        onInputChange={vi.fn()}
        onSend={onSend}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { name: /本次 AI 参考资料/ }))
    const checkbox = await screen.findByRole('checkbox', { name: '选择参考资料 都市交通资料' })
    expect(checkbox).not.toBeChecked()
    fireEvent.click(checkbox)
    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    expect(onSend).toHaveBeenCalledWith([source.id])
    expect(checkbox).not.toBeChecked()
    listSources.mockRestore()
  })

  it('should show thinking spinner when busy and show offline placeholder when disconnected', () => {
    render(
      <AiAssistantPanel
        messages={[]}
        input=""
        busy={true}
        connected={false}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText('InkPi 正在思考…')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('离线模式：无法调用 AI')).toBeInTheDocument()
  })

  it('should NOT send on Enter while IME composing (prevents mid-pinyin submit)', () => {
    const onSend = vi.fn()
    render(
      <AiAssistantPanel
        messages={[]}
        input="续"
        busy={false}
        connected={true}
        onInputChange={vi.fn()}
        onSend={onSend}
        onClose={vi.fn()}
      />,
    )
    const input = screen.getByPlaceholderText('向 InkPi 下达写作指令…')
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('should send when the 发送 button is clicked', () => {
    const onSend = vi.fn()
    render(
      <AiAssistantPanel
        messages={[]}
        input="续写下一段"
        busy={false}
        connected={true}
        onInputChange={vi.fn()}
        onSend={onSend}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByText('发送'))
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('should disable input + send button when offline', () => {
    render(
      <AiAssistantPanel
        messages={[]}
        input=""
        busy={false}
        connected={false}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    const input = screen.getByPlaceholderText('离线模式：无法调用 AI') as HTMLInputElement
    expect(input.disabled).toBe(true)
    expect((screen.getByText('发送') as HTMLButtonElement).disabled).toBe(true)
  })

  it('should disable input + send button while busy', () => {
    render(
      <AiAssistantPanel
        messages={[]}
        input="续写下一段"
        busy={true}
        connected={true}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    const input = screen.getByPlaceholderText('向 InkPi 下达写作指令…') as HTMLInputElement
    expect(input.disabled).toBe(true)
    expect((screen.getByText('发送') as HTMLButtonElement).disabled).toBe(true)
  })

  it('should disable the send button when input is only whitespace', () => {
    render(
      <AiAssistantPanel
        messages={[]}
        input="   "
        busy={false}
        connected={true}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect((screen.getByText('发送') as HTMLButtonElement).disabled).toBe(true)
  })

  it('should support initialTab="activity" and show badge for workspace results', () => {
    const onTabChange = vi.fn()
    render(
      <AiAssistantPanel
        messages={[]}
        input=""
        busy={false}
        connected={true}
        initialTab="activity"
        onTabChange={onTabChange}
        results={[
          {
            id: 'res-1',
            taskId: 't-1',
            scope: { workspaceId: 'ws-1', workspaceRevision: 1 },
            kind: 'story-plan',
            title: '故事线草案',
            summary: '',
            status: 'result',
            provenance: { timestamp: 1000 },
            createdAt: 1000,
            updatedAt: 1000,
          },
        ]}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByTestId('ai-activity-center')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '副驾驶' }))
    expect(onTabChange).toHaveBeenCalledWith('chat')
  })

  it('shows the pre-send request scope above the composer (P3.15)', () => {
    render(
      <AiAssistantPanel
        messages={[]}
        input="继续"
        busy={false}
        connected={true}
        onInputChange={vi.fn()}
        onSend={vi.fn()}
        onClose={vi.fn()}
        requestScope={{
          hasChapter: true,
          chapterTitle: '断谷之夜',
          selectionChars: 12,
          storyFactCount: 5,
          historyTurns: 3,
        }}
      />,
    )

    expect(
      screen.getByText(
        '本次请求将发送：当前章节《断谷之夜》 · 选中文本 · 设定 5 项 · 上文 3 条对话',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('发送')).toBeInTheDocument()
  })
})
