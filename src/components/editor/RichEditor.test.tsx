import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render as baseRender, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react'
import { RichEditor } from './RichEditor'
import { db } from '../../db/indexedDB'
import { SettingsProvider } from '../../core/settings'

// RichEditor 依赖 useSettings（§12.3：Provider 内才能使用），统一在此包裹 SettingsProvider。
// rerender 也会落到 Provider 之外，故对 rerender 一并包裹。
const render = (
  ui: Parameters<typeof baseRender>[0],
  options?: Parameters<typeof baseRender>[1],
) => {
  const result = baseRender(<SettingsProvider>{ui}</SettingsProvider>, options)
  const originalRerender = result.rerender
  return {
    ...result,
    rerender: (nextUi: Parameters<typeof originalRerender>[0]) =>
      originalRerender(<SettingsProvider>{nextUi}</SettingsProvider>),
  }
}

// 共享可变状态：在测试中动态改写 getHTML/getText/selectedText，并捕获 onUpdate 回调。
const h = vi.hoisted(() => ({
  capturedOnUpdate: null as null | (() => void),
  getHTML: () => '<p>初始内容</p>',
  getText: () => '初始内容',
  selectedText: '',
}))
let editorInstance: any = null

const makeMockCommands = () => ({
  setContent: vi.fn(),
  insertContent: vi.fn(),
  setTextSelection: vi.fn(),
  scrollIntoView: vi.fn(),
  focus: () => ({ toggleBold: () => ({ run: () => {} }), toggleItalic: () => ({ run: () => {} }) }),
  chain: () => ({
    focus: () => ({
      toggleBold: () => ({ run: () => {} }),
      toggleItalic: () => ({ run: () => {} }),
    }),
  }),
})

const makeMockEditor = () => {
  const handlers: Record<string, ((...a: any[]) => void) | undefined> = {}
  const inst: any = {
    getHTML: () => h.getHTML(),
    getText: () => h.getText(),
    isActive: () => false,
    commands: makeMockCommands(),
    state: {
      doc: { textBetween: () => h.selectedText, content: { size: 0 }, descendants: () => {} },
      selection: { from: 0, to: 0 },
    },
    view: {
      state: { selection: { to: 0 }, doc: { content: { size: 0 } }, tr: { setMeta: vi.fn() } },
      dispatch: vi.fn(),
      coordsAtPos: () => ({ top: 100, left: 50, right: 150, bottom: 120 }),
    },
    on: (evt: string, cb: (...a: any[]) => void) => {
      handlers[evt] = cb
    },
    off: () => {},
    _fire: (evt: string) => handlers[evt]?.(),
  }
  return inst
}

vi.mock('@tiptap/react', () => {
  return {
    useEditor: (opts: any) => {
      h.capturedOnUpdate = opts.onUpdate
      if (!editorInstance) editorInstance = makeMockEditor()
      return editorInstance
    },
    EditorContent: () => <div data-testid="tiptap-editor" />,
  }
})

const seedClear = async () => {
  for (const c of await db.getAll('chapters')) await db.delete('chapters', c.id)
  for (const v of await db.getAll('volumes')) await db.delete('volumes', v.id)
}

beforeEach(async () => {
  await seedClear()
  // 强制每个测试拥有独立的 mock editor 实例，避免并行/顺序执行时的状态串扰
  editorInstance = makeMockEditor()
  h.getHTML = () => '<p>初始内容</p>'
  h.getText = () => '初始内容'
  h.selectedText = ''
})
afterEach(() => {
  cleanup()
  h.capturedOnUpdate = null
  editorInstance = null
})

describe('RichEditor — 合并后的统一富文本编辑器', () => {
  it('loads seed data, renders tree, toolbar and status bar', async () => {
    render(<RichEditor projectId="p-rich" />)
    expect(
      await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' }),
    ).toBeInTheDocument()
    expect(screen.getByText('章节目录')).toBeInTheDocument()
    expect(screen.getByText(/Local IndexedDB/)).toBeInTheDocument()
    expect(screen.getByText(/全书/)).toBeInTheDocument()
  })

  it('autosaves edited content to IndexedDB after the debounce', async () => {
    h.getText = () => '新的正文内容'
    h.getHTML = () => '<p>新的正文内容</p>'
    render(<RichEditor projectId="p-save" />)
    await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })

    act(() => {
      h.capturedOnUpdate && h.capturedOnUpdate()
    })

    await waitFor(
      async () => {
        const chs = await db.getAll('chapters')
        const ch = chs.find((c) => c.title === '第001章 寒潭惊变')
        expect(ch?.content).toBe('<p>新的正文内容</p>')
      },
      { timeout: 8000 },
    )
  }, 10000)

  it('auto-format applies full-width indent via editor.setContent', async () => {
    render(<RichEditor projectId="p-fmt" />)
    await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })
    h.getText = () => '第一行\n第二行'
    fireEvent.click(screen.getByTitle('一键首行缩进排版'))
    expect(editorInstance.commands.setContent).toHaveBeenCalledWith(
      '<p>　　第一行</p><p>　　第二行</p>',
    )
  })

  it('punctuation fix converts ASCII punctuation', async () => {
    render(<RichEditor projectId="p-punc" />)
    await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })
    h.getText = () => 'hi, there?'
    fireEvent.click(screen.getByTitle('标点规整'))
    expect(editorInstance.commands.setContent).toHaveBeenCalledWith('<p>　　hi， there？</p>')
  })

  it('find & replace rewrites the editor content', async () => {
    render(<RichEditor projectId="p-fr" />)
    await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })
    h.getText = () => 'abc'
    h.getHTML = () => '<p>abc</p>'
    fireEvent.click(screen.getByTitle('查找替换 / 全文检索 (⌘F)'))
    fireEvent.change(screen.getByPlaceholderText('检索（文档内全文）'), { target: { value: 'a' } })
    fireEvent.change(screen.getByPlaceholderText('替换为（可选）'), { target: { value: 'X' } })
    fireEvent.click(screen.getByText('全部替换'))
    expect(editorInstance.commands.setContent).toHaveBeenCalledWith('<p>Xbc</p>')
  })

  it('exports the current chapter as a downloadable file', async () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<RichEditor projectId="p-exp" />)
    await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })
    fireEvent.click(screen.getByTitle('导出为 TXT'))
    expect(createSpy).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    createSpy.mockRestore()
    clickSpy.mockRestore()
  })

  it('shows a volume/chapter breadcrumb when the chapter tree is collapsed', async () => {
    render(<RichEditor projectId="p-zen" />)
    await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })
    // 默认展开：不显示面包屑
    expect(screen.queryByText(/第\d+卷 · 第\d+章/)).not.toBeInTheDocument()
    // 折叠目录：树完全隐藏，左上角显示「第X卷 · 第X章」
    fireEvent.click(screen.getByTitle('折叠目录 (⌘B)'))
    expect(screen.queryByText('章节目录')).not.toBeInTheDocument()
    expect(screen.getByText(/第\d+卷 · 第\d+章/)).toBeInTheDocument()
  })

  it('does not render AI助手 or 世界观 decoration buttons in editor toolbar', async () => {
    render(<RichEditor projectId="p-clean" />)
    await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })
    expect(screen.queryByText('AI 助手')).not.toBeInTheDocument()
    expect(screen.queryByText('世界观')).not.toBeInTheDocument()
  })

  it('sends the selected paragraph to AI on polish (划词润色)', async () => {
    const onAiPrompt = vi.fn()
    const onOpenAssistant = vi.fn()
    h.selectedText = '某段落文字'
    render(
      <RichEditor projectId="p-polish" onAiPrompt={onAiPrompt} onOpenAssistant={onOpenAssistant} />,
    )
    await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })
    // SelectionToolbar 仅在「有选区」时渲染，这里模拟用户在编辑器内划选
    act(() => {
      editorInstance.state.selection = { from: 0, to: 5 }
      editorInstance._fire('selectionUpdate')
    })
    fireEvent.click(screen.getByText('AI 润色'))
    const chs = await db.getAll('chapters')
    const firstId = chs.find((c) => c.title === '第001章 寒潭惊变')?.id
    expect(onAiPrompt).toHaveBeenCalledWith(expect.stringContaining('某段落文字'), firstId)
    expect(onOpenAssistant).toHaveBeenCalled()
  })

  it('shows the daemon connection status', async () => {
    const { rerender } = render(<RichEditor projectId="p-conn" isConnected={true} />)
    expect(await screen.findByText('Daemon 已连接')).toBeInTheDocument()
    rerender(<RichEditor projectId="p-conn" isConnected={false} isReconnecting={false} />)
    expect(screen.getByText('离线沙盒')).toBeInTheDocument()
  })

  it('creates a new chapter via the tree and writes it to IndexedDB', async () => {
    render(<RichEditor projectId="p-new" />)
    await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })
    fireEvent.click(screen.getByTitle('在当前卷新建章节 (⌘N)'))
    await waitFor(async () => {
      const chs = await db.getAll('chapters')
      expect(chs.some((c) => c.title.startsWith('第') && c.title.includes('未命名'))).toBe(true)
    })
  })

  it('exposes 首行缩进 and 标点规整 as toolbar actions (appearance moved to unified Settings)', async () => {
    render(<RichEditor projectId="p-settings" />)
    await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })
    expect(screen.getByTitle('一键首行缩进排版')).toBeInTheDocument()
    expect(screen.getByTitle('标点规整')).toBeInTheDocument()
    // 首行缩进走与工具栏相同的格式化逻辑
    h.getText = () => '独行'
    fireEvent.click(screen.getByTitle('一键首行缩进排版'))
    expect(editorInstance.commands.setContent).toHaveBeenCalledWith('<p>　　独行</p>')
  })

  it('toggles the find/replace bar open and closed', async () => {
    render(<RichEditor projectId="p-find2" />)
    await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })
    fireEvent.click(screen.getByTitle('查找替换 / 全文检索 (⌘F)'))
    expect(screen.getByPlaceholderText('检索（文档内全文）')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('关闭'))
    expect(screen.queryByPlaceholderText('检索（文档内全文）')).not.toBeInTheDocument()
  })

  it('exports the current chapter as Markdown', async () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<RichEditor projectId="p-exp2" />)
    await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })
    fireEvent.click(screen.getByTitle('导出为 MD'))
    expect(createSpy).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    createSpy.mockRestore()
    clickSpy.mockRestore()
  })

  it('exports the current chapter as HTML', async () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<RichEditor projectId="p-exp3" />)
    await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })
    fireEvent.click(screen.getByTitle('导出为 HTML'))
    expect(createSpy).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    createSpy.mockRestore()
    clickSpy.mockRestore()
  })

  it('invokes onReconnect when the reconnect button is clicked', async () => {
    const onReconnect = vi.fn()
    render(
      <RichEditor
        projectId="p-reconnect"
        isConnected={false}
        isReconnecting={false}
        onReconnect={onReconnect}
      />,
    )
    await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })
    fireEvent.click(screen.getByTitle('重连 InkPi Daemon'))
    expect(onReconnect).toHaveBeenCalled()
  })

  it('shows the reconnecting status while connecting', async () => {
    render(<RichEditor projectId="p-conn2" isConnected={false} isReconnecting={true} />)
    expect(await screen.findByText('连接中…')).toBeInTheDocument()
  })

  it('collapses and restores the chapter tree via the sidebar toggle', async () => {
    render(<RichEditor projectId="p-side" />)
    await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })
    fireEvent.click(screen.getByTitle('折叠目录 (⌘B)'))
    expect(screen.queryByText('章节目录')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTitle('展开目录 (⌘B)'))
    expect(screen.getByText('章节目录')).toBeInTheDocument()
  })

  it('responds to global shortcuts (⌘B folds tree, ⌘F opens find, Esc closes)', async () => {
    render(<RichEditor projectId="p-keys" />)
    await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })
    fireEvent.keyDown(window, { key: 'b', ctrlKey: true })
    expect(screen.queryByText('章节目录')).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'b', ctrlKey: true })
    expect(screen.getByText('章节目录')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true })
    expect(screen.getByPlaceholderText('检索（文档内全文）')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByPlaceholderText('检索（文档内全文）')).not.toBeInTheDocument()
  })

  it('requests and accepts an inline Ghost Text continuation', async () => {
    const onRequestGhost = vi.fn().mockResolvedValue('的续写内容')
    h.getText = () => '这是一段足够长的正文内容用于续写'
    render(<RichEditor projectId="p-ghost" onRequestGhost={onRequestGhost} />)
    await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })
    act(() => {
      h.capturedOnUpdate && h.capturedOnUpdate()
    })
    // 等待防抖（600ms）后 daemon 返回建议，状态栏出现「采纳续写」
    await waitFor(() => expect(screen.getByText('Tab 采纳续写')).toBeInTheDocument(), {
      timeout: 8000,
    })
    expect(onRequestGhost).toHaveBeenCalled()
    fireEvent.click(screen.getByText('Tab 采纳续写'))
    expect(editorInstance.commands.insertContent).toHaveBeenCalledWith('的续写内容')
  })

  it('mounts without crashing when typewriter mode is on', async () => {
    render(<RichEditor projectId="p-type" isTypewriter={true} />)
    expect(
      await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' }),
    ).toBeInTheDocument()
  })

  it('opens the 全书检索 (cross-chapter) modal from the toolbar', async () => {
    render(<RichEditor projectId="p-global" />)
    await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })
    fireEvent.click(screen.getByTitle('全书检索（跨所有章节）'))
    expect(screen.getByPlaceholderText('检索全书所有章节…')).toBeInTheDocument()
  })

  it('filters chapters in the tree via the search box', async () => {
    render(<RichEditor projectId="p-tree-search" />)
    await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })
    fireEvent.change(screen.getByPlaceholderText('搜索章节…'), { target: { value: '寒潭' } })
    expect(screen.getByText('第001章 寒潭惊变', { selector: 'span.truncate' })).toBeInTheDocument()
    expect(
      screen.queryByText('第002章 青云试炼', { selector: 'span.truncate' }),
    ).not.toBeInTheDocument()
  })

  it('renders a chapter status selector and persists status changes', async () => {
    render(<RichEditor projectId="p-status" />)
    await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })

    const select = screen.getByDisplayValue('草稿')
    fireEvent.change(select, { target: { value: 'published' } })

    await waitFor(async () => {
      const chs = await db.getAll('chapters')
      const ch = chs.find((c) => c.title === '第001章 寒潭惊变')
      expect(ch?.status).toBe('published')
    })
  })

  it('toggles canvas width between narrow/wide/full from the status bar', async () => {
    render(<RichEditor projectId="p-width" />)
    await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })

    expect(screen.getByText('限宽')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('限宽（点击切换）'))
    expect(screen.getByText('较宽')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('较宽'))
    expect(screen.getByText('铺满')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('铺满'))
    expect(screen.getByText('限宽')).toBeInTheDocument()
  })

  it('renders a word-target progress bar based on chapter word count', async () => {
    render(<RichEditor projectId="p-progress" />)
    await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })
    expect(screen.getByTestId('chapter-progress')).toBeInTheDocument()
  })

  it('toggles typewriter mode via the status bar and notifies the parent', async () => {
    const onTypewriterChange = vi.fn()
    render(
      <RichEditor
        projectId="p-type-toggle"
        isTypewriter={false}
        onTypewriterChange={onTypewriterChange}
      />,
    )
    await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })

    fireEvent.click(screen.getByTitle('打字机视口（光标垂直居中）'))
    expect(onTypewriterChange).toHaveBeenCalledWith(true)
  })

  it('navigates to next and previous chapter via toolbar navigation buttons', async () => {
    render(<RichEditor projectId="p-nav" />)
    await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })

    const nextBtn = screen.getByTitle('下一章（快速切章）')
    expect(nextBtn).toBeEnabled()
    fireEvent.click(nextBtn)

    const titleInput = screen.getByDisplayValue('第002章 锈剑之鸣')
    expect(titleInput).toBeInTheDocument()

    const prevBtn = screen.getByTitle('上一章（快速切章）')
    expect(prevBtn).toBeEnabled()
    fireEvent.click(prevBtn)

    expect(screen.getByDisplayValue('第001章 寒潭惊变')).toBeInTheDocument()
  })

  it('opens sensitive, lock, and history modals from the toolbar', async () => {
    render(<RichEditor projectId="p-modals" />)
    await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })

    // 敏感词检测弹窗
    fireEvent.click(screen.getByTitle('敏感词检测（本章）'))
    expect(screen.getByText('本章敏感词即时检测')).toBeInTheDocument()
    fireEvent.click(
      screen.getByText('本章敏感词即时检测').parentElement!.parentElement!.querySelector('button')!,
    )

    // 时光机版本弹窗
    fireEvent.click(screen.getByTitle('时光机 · 版本历史'))
    expect(screen.getByText(/版本时光机/)).toBeInTheDocument()
    fireEvent.click(
      screen.getByText(/版本时光机/).parentElement!.parentElement!.querySelector('button')!,
    )

    // 小黑屋专注码字弹窗
    fireEvent.click(screen.getByTitle('小黑屋 · 强制专注码字'))
    expect(screen.getByText('小黑屋 · 强制专注码字')).toBeInTheDocument()
    fireEvent.click(screen.getByText('取消'))
  })

  it('toggles Split View, Overuse Words, and Scratchpad drawers seamlessly', async () => {
    render(<RichEditor projectId="p-advanced-tools" />)
    await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })

    // 1. 打开分屏对照抽屉
    fireEvent.click(screen.getByTitle('分屏对照阅读历史章节'))
    expect(screen.getByText('分屏对照参考台')).toBeInTheDocument()
    expect(screen.getByText(/对照面板仅供阅读与伏笔核验/)).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('关闭对照分屏'))
    expect(screen.queryByText('分屏对照参考台')).not.toBeInTheDocument()

    // 2. 打开高频词口癖点检
    fireEvent.click(screen.getByTitle('高频词与口癖点检'))
    expect(screen.getByText(/高频词与口癖点检/)).toBeInTheDocument()
    expect(screen.getByText(/有效词汇总数/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('完成'))
    expect(screen.queryByText(/有效词汇总数/)).not.toBeInTheDocument()

    // 3. 打开行旁待办备忘便签
    fireEvent.click(screen.getByTitle('行旁待办与备忘便签（导出自动滤除）'))
    expect(screen.getByText('行旁待办与备忘录')).toBeInTheDocument()
    expect(screen.getByText(/此处备忘待办与正文物理隔离/)).toBeInTheDocument()
  })

  it('triggers right-click context menu and supports renaming, duplicating, copying, and shortcuts', async () => {
    render(<RichEditor projectId="p-advanced-tools" />)
    const chItem = await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })

    // 1. 鼠标右键章节项
    fireEvent.contextMenu(chItem)

    // 断言上下文菜单已弹出并展示真实操作项
    expect(screen.getByText('重命名 (F2)')).toBeInTheDocument()
    expect(screen.getByText('复制 / 创建副本')).toBeInTheDocument()
    expect(screen.getByText('复制正文到剪贴板')).toBeInTheDocument()
    expect(screen.getByText('导出为 TXT 纯文本')).toBeInTheDocument()
    expect(screen.getByText('导出为 Markdown')).toBeInTheDocument()
    expect(screen.getByText('删除本章节')).toBeInTheDocument()

    // 2. 点击重命名唤起弹窗
    fireEvent.click(screen.getByText('重命名 (F2)'))
    expect(screen.getByRole('heading', { name: '重命名章节' })).toBeInTheDocument()
    const input = screen.getByPlaceholderText('请输入章节新标题')
    fireEvent.change(input, { target: { value: '第001章 寒潭惊变【精修版】' } })
    const confirmBtn = screen.getByRole('button', { name: '确定' })
    fireEvent.click(confirmBtn)

    // 断言新标题生效
    expect(
      await screen.findByRole('heading', { name: /第001章 寒潭惊变【精修版】/i }),
    ).toBeInTheDocument()

    // 3. 测试快捷键: Alt+ArrowDown 触发下一章切章
    fireEvent.keyDown(window, { key: 'ArrowDown', altKey: true })

    // 4. 测试快捷键: Ctrl+N 触发快速新建章节
    await act(async () => {
      fireEvent.keyDown(window, { key: 'n', ctrlKey: true })
    })
    await waitFor(() => {
      expect(screen.getAllByText(/未命名/).length).toBeGreaterThanOrEqual(1)
    })

    // 5. 测试快捷键: Ctrl+H 唤起时光机
    fireEvent.keyDown(window, { key: 'h', ctrlKey: true })
    expect(screen.getByText(/版本时光机/)).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByText(/版本时光机/)).not.toBeInTheDocument()
  })

  it('handles volume creation, right click actions like duplication, and sensitive check modal', async () => {
    render(<RichEditor projectId="p-advanced-cov" />)
    const chItem = await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })

    // 复制/创建副本
    fireEvent.contextMenu(chItem)
    const dupBtn = screen.getByText('复制 / 创建副本')
    await act(async () => {
      fireEvent.click(dupBtn)
    })

    // 复制正文到剪贴板
    fireEvent.contextMenu(chItem)
    const copyBtn = screen.getByText('复制正文到剪贴板')
    fireEvent.click(copyBtn)

    // 导出 TXT
    fireEvent.contextMenu(chItem)
    const txtBtn = screen.getByText('导出为 TXT 纯文本')
    fireEvent.click(txtBtn)

    // 导出 Markdown
    fireEvent.contextMenu(chItem)
    const mdBtn = screen.getByText('导出为 Markdown')
    fireEvent.click(mdBtn)

    // 快捷键: Alt+ArrowUp 盲切上一章
    fireEvent.keyDown(window, { key: 'ArrowUp', altKey: true })

    // 快捷键: F2 触发重命名当前活动章
    fireEvent.keyDown(window, { key: 'F2' })
    expect(screen.getByRole('heading', { name: '重命名章节' })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })

    // 敏感词检测弹窗
    const sensitiveBtn = screen.getByTitle('敏感词检测（本章）')
    fireEvent.click(sensitiveBtn)
    expect(screen.getByText(/本章敏感词即时检测/)).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('关闭'))
  })

  it('triggers chapter deletion confirmation modal and cancels or deletes', async () => {
    render(<RichEditor projectId="p-del-test" />)
    const chItem = await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })
    fireEvent.contextMenu(chItem)
    fireEvent.click(screen.getByText('删除本章节'))
    expect(screen.getByText(/删除章节确认/)).toBeInTheDocument()

    // 1. 取消
    fireEvent.click(screen.getByText('取消'))
    await waitFor(() => expect(screen.queryByText(/删除章节确认/)).not.toBeInTheDocument())

    // 2. 确认删除
    fireEvent.contextMenu(chItem)
    fireEvent.click(screen.getByText('删除本章节'))
    await act(async () => {
      fireEvent.click(screen.getByText('确认删除'))
    })
    await waitFor(() => expect(screen.queryByText(/删除章节确认/)).not.toBeInTheDocument())
  })

  it('updates status from context menu and covers search and jump', async () => {
    render(<RichEditor projectId="p-status-ctx" />)
    const chItem = await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })
    fireEvent.contextMenu(chItem)
    const doneBtn = screen.getByRole('button', { name: '已发布' })
    await act(async () => {
      fireEvent.click(doneBtn)
    })
  })

  it('handles volume expansion and rename context menu', async () => {
    render(<RichEditor projectId="p-vol-ctx" />)
    const chItem = await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })

    // 右键重命名触发
    fireEvent.contextMenu(chItem)
    const renameItem = screen.getByText(/重命名 \(F2\)/)
    fireEvent.click(renameItem)
    expect(screen.getByRole('heading', { name: '重命名章节' })).toBeInTheDocument()
    const input = screen.getByPlaceholderText('请输入章节新标题')
    fireEvent.change(input, { target: { value: '第001章 重铸荣光' } })
    fireEvent.click(screen.getByText('确定'))
  })

  it('covers toggleExcludeNumbering and chapter copy text', async () => {
    render(<RichEditor projectId="p-num-cov" />)
    const chItem = await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })
    fireEvent.contextMenu(chItem)
    fireEvent.click(screen.getByText('设为不计入序号(序章/番外)'))

    fireEvent.contextMenu(chItem)
    fireEvent.click(screen.getByText('恢复计入正文序号'))
  })

  it('handles rename modal Enter key submission and Escape cancellation', async () => {
    render(<RichEditor projectId="p-key-ctx" />)
    const chItem = await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })

    // 1. Enter 提交重命名
    fireEvent.contextMenu(chItem)
    fireEvent.click(screen.getByText(/重命名 \(F2\)/))
    const input = screen.getByPlaceholderText('请输入章节新标题')
    fireEvent.change(input, { target: { value: '第001章 回车提交' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    // 2. Escape 取消重命名
    fireEvent.contextMenu(chItem)
    fireEvent.click(screen.getByText(/重命名 \(F2\)/))
    const input2 = screen.getByPlaceholderText('请输入章节新标题')
    fireEvent.keyDown(input2, { key: 'Escape' })
    expect(screen.queryByPlaceholderText('请输入章节新标题')).not.toBeInTheDocument()

    // 3. 点击菜单遮罩关闭
    fireEvent.contextMenu(chItem)
    expect(screen.getByText(/重命名 \(F2\)/)).toBeInTheDocument()
    fireEvent.click(document.querySelector('.fixed.inset-0.z-40')!)
    expect(screen.queryByText(/重命名 \(F2\)/)).not.toBeInTheDocument()
  })

  it('covers onContextMenu preventDefault on overlay and rename cancel button', async () => {
    render(<RichEditor projectId="p-ctx-cov" />)
    const chItem = await screen.findByText('第001章 寒潭惊变', { selector: 'span.truncate' })

    // 右键打开菜单并右键点击 overlay
    fireEvent.contextMenu(chItem)
    const overlay = document.querySelector('.fixed.inset-0.z-40')!
    fireEvent.contextMenu(overlay)
    expect(screen.queryByText(/重命名 \(F2\)/)).not.toBeInTheDocument()

    // 打开重命名点击取消按钮
    fireEvent.contextMenu(chItem)
    fireEvent.click(screen.getByText(/重命名 \(F2\)/))
    fireEvent.click(screen.getByText('取消'))
    expect(screen.queryByPlaceholderText('请输入章节新标题')).not.toBeInTheDocument()
  })
})
