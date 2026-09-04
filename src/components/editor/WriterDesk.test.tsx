import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { WriterDesk } from './WriterDesk'
import { db } from '../../db/indexedDB'
import type { ChapterRecord, VolumeRecord } from '../../types'

// 用内存 mock 替换真实 IndexedDB 调用，便于断言持久化行为
vi.mock('../../db/indexedDB', () => ({
  db: {
    getAll: vi.fn(),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
  uid: (p = 'id') => `${p}-mock-${Math.random().toString(36).slice(2, 8)}`,
}))

const mocked = db as unknown as {
  getAll: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

const vol = (over: Partial<VolumeRecord> = {}): VolumeRecord => ({
  id: 'v1',
  projectId: 'p1',
  title: '第一卷',
  order: 0,
  createdAt: 1,
  updatedAt: 1,
  ...over,
})

const ch = (over: Partial<ChapterRecord> = {}): ChapterRecord => ({
  id: 'c1',
  projectId: 'p1',
  volumeId: 'v1',
  title: '第001章 未命名',
  content: '正文内容',
  wordCount: 4,
  order: 0,
  createdAt: 1,
  updatedAt: 1,
  ...over,
})

const setupMockStore = (
  volumes: VolumeRecord[] = [],
  chapters: ChapterRecord[] = [],
  codex: any[] = [],
) => {
  mocked.getAll.mockImplementation((store: string) => {
    if (store === 'volumes') return Promise.resolve(volumes)
    if (store === 'chapters') return Promise.resolve(chapters)
    if (store === 'codexEntities') return Promise.resolve(codex)
    return Promise.resolve([])
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  setupMockStore([], [])
})
afterEach(() => cleanup())

const ta = () => screen.getByPlaceholderText(/挥洒你的灵感/) as HTMLTextAreaElement

describe('WriterDesk — 空状态与受控守卫', () => {
  it('shows the empty hint and does not crash when typing with no active chapter', async () => {
    render(<WriterDesk projectId="p1" />)
    await waitFor(() => expect(mocked.getAll).toHaveBeenCalled())
    expect(screen.getByText(/还没有分卷/)).toBeInTheDocument()
    fireEvent.change(ta(), { target: { value: '测试' } })
    // activeChapter 为 null -> 受控守卫直接返回，字数保持 0
    expect(screen.getByText('字数：0 字')).toBeInTheDocument()
  })

  it('guards save when no chapter is active (empty state)', async () => {
    render(<WriterDesk projectId="p1" />)
    await waitFor(() => expect(mocked.getAll).toHaveBeenCalled())
    fireEvent.click(screen.getByText('保存'))
    // flushSave 守卫：无 activeChapter 时不写入
    expect(mocked.put).not.toHaveBeenCalled()
  })

  it('guards auto-format when no chapter is active (empty state)', async () => {
    render(<WriterDesk projectId="p1" />)
    await waitFor(() => expect(mocked.getAll).toHaveBeenCalled())
    fireEvent.click(screen.getByText('排版'))
    // handleAutoFormat 守卫：无 activeChapter 时不写入
    expect(mocked.put).not.toHaveBeenCalled()
  })
})

describe('WriterDesk — 卷章树导航', () => {
  it('renders volumes/chapters and filters out other projects', async () => {
    setupMockStore(
      [vol(), vol({ id: 'v2', projectId: 'p2', title: '别的卷' })],
      [ch(), ch({ id: 'c2', projectId: 'p2', volumeId: 'v2', title: '外卷章节' })],
    )
    render(<WriterDesk projectId="p1" />)
    await waitFor(() => expect(screen.getByText('第一卷')).toBeInTheDocument())
    expect(screen.queryByText('别的卷')).not.toBeInTheDocument()
    expect(screen.queryByText('外卷章节')).not.toBeInTheDocument()
    // 章节标题同时出现在目录树与顶栏，故用 getAllByText 计数避免歧义
    expect(screen.getAllByText('第001章 未命名').length).toBeGreaterThan(0)
  })

  it('selects a chapter and loads its content + word count', async () => {
    setupMockStore([vol()], [ch({ content: '你好世界', wordCount: 4 })])
    render(<WriterDesk projectId="p1" />)
    // DOM 顺序中目录树的章节按钮先于顶栏标题，取首个匹配即为目录树项
    const btn = (await screen.findAllByText('第001章 未命名'))[0]
    fireEvent.click(btn)
    expect(ta().value).toBe('你好世界')
    expect(screen.getByText('字数：4 字')).toBeInTheDocument()
  })

  it('creates a volume + chapter when none exist', async () => {
    render(<WriterDesk projectId="p1" />)
    await waitFor(() => expect(mocked.getAll).toHaveBeenCalled())
    fireEvent.click(screen.getByTitle('新建章节'))
    await waitFor(() => expect(screen.getByText('第一卷')).toBeInTheDocument())
    expect(screen.getAllByText('第001章 未命名').length).toBeGreaterThan(0)
    expect(mocked.put).toHaveBeenCalledTimes(2)
  })

  it('appends a chapter under an existing volume without creating a new volume', async () => {
    setupMockStore([vol()], [ch({ id: 'c1', order: 0, title: '第001章 未命名' })])
    render(<WriterDesk projectId="p1" />)
    await screen.findByText('第一卷')
    fireEvent.click(screen.getByTitle('新建章节'))
    await waitFor(() => expect(mocked.put).toHaveBeenCalled())
    const newChapter = mocked.put.mock.calls.find((c) => c[0] === 'chapters')?.[1] as ChapterRecord
    expect(newChapter.title).toMatch(/第002章/)
  })

  it('toggles volume expand/collapse', async () => {
    setupMockStore([vol()], [ch()])
    render(<WriterDesk projectId="p1" />)
    await screen.findByText('第一卷')
    // 展开时：目录树 + 顶栏各一个；折叠后仅剩顶栏一个
    const count = () => screen.queryAllByText('第001章 未命名').length
    expect(count()).toBe(2)
    fireEvent.click(screen.getByText('第一卷'))
    expect(count()).toBe(1)
    fireEvent.click(screen.getByText('第一卷'))
    expect(count()).toBe(2)
  })

  it('sorts volumes and chapters by ascending order', async () => {
    setupMockStore(
      [vol({ id: 'vB', order: 5, title: '第五卷' }), vol({ id: 'vA', order: 0, title: '第零卷' })],
      [
        ch({ id: 'cB', order: 9, title: '第009章 后' }),
        ch({ id: 'cA', order: 0, title: '第000章 前' }),
      ],
    )
    render(<WriterDesk projectId="p1" />)
    const zero = await screen.findByText('第零卷')
    const five = screen.getByText('第五卷')
    // 升序：第零卷应排在第伍卷之前
    expect(zero.compareDocumentPosition(five) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

describe('WriterDesk — 编辑、排版、字号、行距、存盘与随动感知', () => {
  it('updates word count and dirty flag on input', async () => {
    setupMockStore([vol()], [ch()])
    render(<WriterDesk projectId="p1" />)
    fireEvent.change(await screen.findByPlaceholderText(/挥洒你的灵感/), {
      target: { value: '字 字 字' },
    })
    expect(screen.getByText('字数：3 字')).toBeInTheDocument()
    expect(screen.getByText('未保存')).toBeInTheDocument()
  })

  it('auto-formats paragraphs with a full-width indent', async () => {
    setupMockStore([vol()], [ch()])
    render(<WriterDesk projectId="p1" />)
    fireEvent.change(await screen.findByPlaceholderText(/挥洒你的灵感/), {
      target: { value: '第一段\n第二段' },
    })
    fireEvent.click(screen.getByText('排版'))
    await waitFor(() => expect(ta().value).toBe('　　第一段\n\n　　第二段'))
  })

  it('clamps font size between 12 and 24', async () => {
    setupMockStore([vol()], [ch()])
    render(<WriterDesk projectId="p1" />)
    await screen.findByPlaceholderText(/挥洒你的灵感/)
    const minus = screen.getByText('A-')
    const plus = screen.getByText('A+')
    fireEvent.click(minus)
    fireEvent.click(minus)
    fireEvent.click(minus)
    fireEvent.click(minus)
    expect(screen.getByText('12px')).toBeInTheDocument()
    fireEvent.click(minus) // 已到下限，保持
    expect(screen.getByText('12px')).toBeInTheDocument()
    for (let i = 0; i < 12; i++) fireEvent.click(plus)
    expect(screen.getByText('24px')).toBeInTheDocument()
    fireEvent.click(plus) // 已到上限，保持
    expect(screen.getByText('24px')).toBeInTheDocument()
  })

  it('changes line height via the select control', async () => {
    setupMockStore([vol()], [ch()])
    render(<WriterDesk projectId="p1" />)
    fireEvent.change(screen.getByDisplayValue('1.8x 行距'), { target: { value: '1.5' } })
    expect(ta().style.lineHeight).toBe('1.5')
  })

  it('persists the active chapter on manual save', async () => {
    setupMockStore([vol()], [ch()])
    render(<WriterDesk projectId="p1" />)
    await screen.findByPlaceholderText(/挥洒你的灵感/)
    fireEvent.click(screen.getByText('保存'))
    await waitFor(() => expect(mocked.put).toHaveBeenCalled())
  })

  it('reports live stats through the onStats callback', async () => {
    const onStats = vi.fn()
    setupMockStore([vol()], [ch({ content: 'abcd', wordCount: 4 })])
    render(<WriterDesk projectId="p1" onStats={onStats} />)
    // 等待数据加载后基于章节内容上报（挂载时的首次调用字数为 0）
    await waitFor(() => expect(onStats.mock.calls.at(-1)?.[0]?.wordCount).toBe(4))
  })

  it('runs the typewriter viewport effect (incl. line-height fallback) without crashing', async () => {
    // jsdom 默认返回可解析的 lineHeight，这里强制为空以覆盖 `||` 回退分支
    const spy = vi
      .spyOn(window, 'getComputedStyle')
      .mockReturnValue({ lineHeight: '' } as unknown as CSSStyleDeclaration)
    setupMockStore([vol()], [ch({ content: 'abc' })])
    render(<WriterDesk projectId="p1" isTypewriter />)
    const area = await screen.findByPlaceholderText(/挥洒你的灵感/)
    fireEvent.change(area, { target: { value: 'typing in typewriter' } })
    expect((area as HTMLTextAreaElement).value).toBe('typing in typewriter')
    spy.mockRestore()
  })

  it('auto-saves to IndexedDB after the debounce window (800ms)', async () => {
    setupMockStore([vol()], [ch()])
    render(<WriterDesk projectId="p1" />)
    const area = await screen.findByPlaceholderText(/挥洒你的灵感/)
    fireEvent.change(area, { target: { value: '自动保存的内容' } })
    // 等待防抖定时器（AUTOSAVE_MS = 800）触发 flushSave -> db.put
    await waitFor(
      () =>
        expect(mocked.put).toHaveBeenCalledWith(
          'chapters',
          expect.objectContaining({ content: '自动保存的内容' }),
        ),
      { timeout: 2000 },
    )
    // 保存后应恢复「已保存」标记
    expect(screen.getByText('已保存')).toBeInTheDocument()
  })

  it('toggles living-codex side drawer in writer toolbar', async () => {
    setupMockStore([vol()], [ch()])
    render(<WriterDesk projectId="p1" />)
    expect(screen.getByTitle('切换活体世界观随动抽屉')).toBeInTheDocument()
    expect(screen.getByText('活体世界观待命')).toBeInTheDocument()

    // 点击切换按钮折叠
    fireEvent.click(screen.getByTitle('切换活体世界观随动抽屉'))
    expect(screen.queryByText('活体世界观待命')).not.toBeInTheDocument()

    // 再次点击展开
    fireEvent.click(screen.getByTitle('切换活体世界观随动抽屉'))
    expect(screen.getByText('活体世界观待命')).toBeInTheDocument()
  })
})
