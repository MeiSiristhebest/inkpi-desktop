import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AiAssistantPanel } from './AiAssistantPanel'

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
      />
    )
    expect(screen.getByText('AI 副驾驶')).toBeInTheDocument()
    expect(screen.getByText('与 InkPi Agent 对话')).toBeInTheDocument()
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
      />
    )

    expect(screen.getByText('续写下一段')).toBeInTheDocument()
    expect(screen.getByText('夜幕降临，月光洒在废墟上。')).toBeInTheDocument()

    const input = screen.getByPlaceholderText('向 InkPi 下达写作指令…')
    fireEvent.change(input, { target: { value: '写得生动一些' } })
    expect(onInputChange).toHaveBeenCalledWith('写得生动一些')

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSend).toHaveBeenCalled()

    const closeBtn = screen.getByTitle('收起')
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
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
      />
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
      />
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
      />
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
      />
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
      />
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
      />
    )
    expect((screen.getByText('发送') as HTMLButtonElement).disabled).toBe(true)
  })
})
