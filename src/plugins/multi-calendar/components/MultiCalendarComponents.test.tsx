import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MultiCalendarMasterView } from './MultiCalendarMasterView'
import { MultiCalendarDrawer } from './MultiCalendarDrawer'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { indexedDbMultiCalendarRepository } from '../../../adapters/indexedDbMultiCalendarRepository'

const { mockUseActiveWriting } = vi.hoisted(() => ({ mockUseActiveWriting: vi.fn() }))

vi.mock('../../../core/activeWritingContext', () => ({
  useOptionalActiveWritingContext: mockUseActiveWriting,
}))

vi.mock('../../../adapters/indexedDbProjectRepository', () => ({
  indexedDbProjectRepository: {
    getChaptersByProject: vi.fn().mockResolvedValue([
      {
        id: 'ch-1',
        projectId: 'p1',
        volumeId: 'vol-1',
        title: '启程出山',
        order: 1,
      },
      {
        id: 'ch-2',
        projectId: 'p1',
        volumeId: 'vol-1',
        title: '大乱将至',
        order: 2,
      },
    ]),
    getVolumesByProject: vi.fn().mockResolvedValue([
      { id: 'vol-1', projectId: 'p1', title: '第一卷', order: 1 },
      { id: 'vol-2', projectId: 'p1', title: '第二卷', order: 2 },
    ]),
  },
}))

const authoredRecord = {
  id: 'calproj-1',
  projectId: 'p1',
  calendars: [
    {
      id: 'cal_ancient',
      name: '上古灵历',
      epochOffsetDays: 0,
      monthsPerYear: 12,
      daysPerMonth: [30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    },
  ],
  chronologyEvents: [],
  updatedAt: Date.now(),
}

vi.mock('../../../adapters/indexedDbMultiCalendarRepository', () => ({
  indexedDbMultiCalendarRepository: {
    get: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('MultiCalendar Components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseActiveWriting.mockReturnValue(null)
    vi.mocked(indexedDbMultiCalendarRepository.get).mockResolvedValue(authoredRecord as any)
  })

  it('renders MultiCalendarMasterView and saves chronology', async () => {
    render(<MultiCalendarMasterView projectId="p1" />)

    expect(screen.getByText(/跨纪元多历法与故事时间轴引擎/)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/平行历法日期换算/)).toBeInTheDocument()
    })

    const saveBtn = screen.getByText('保存历法时间线')
    fireEvent.click(saveBtn)
    expect(indexedDbMultiCalendarRepository.save).toHaveBeenCalled()
  })

  it('labels every calendar number input for assistive technology', async () => {
    render(<MultiCalendarMasterView projectId="p1" />)

    for (const name of [
      '一年月数：',
      '每月天数：',
      '新历法元年偏移（天）',
      '源日期年：',
      '源日期月：',
      '源日期日：',
      '事件日期年：',
      '事件日期月：',
      '事件日期日：',
    ]) {
      expect(screen.getByRole('spinbutton', { name })).toBeInTheDocument()
    }
    expect(screen.getAllByRole('spinbutton')).toHaveLength(9)
  })

  it('renders MultiCalendarDrawer with temporal detection', async () => {
    render(
      <MultiCalendarDrawer
        projectId="p1"
        currentText="那一年正是大炎天历三百年九月十五日，血月当空。"
      />,
    )

    expect(screen.getByText(/多历法时间轴感知/)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/大炎天历三百年九月十五日/)).toBeInTheDocument()
    })
  })

  // §P2.4：作者什么都没配置时，插件不能替他选一套仙侠纪元。内置双历只能显式套用。
  it('starts with no calendar at all instead of the built-in cultivation era (P2.4)', async () => {
    vi.mocked(indexedDbMultiCalendarRepository.get).mockResolvedValue(undefined)
    render(<MultiCalendarMasterView projectId="p1" />)

    expect(await screen.findByText('本书历法体系（0 套）')).toBeInTheDocument()
    expect(screen.getByText(/尚未定义历法。这里不替你选/)).toBeInTheDocument()
    expect(screen.queryByText(/上古灵历 ·/)).not.toBeInTheDocument()
    expect(screen.queryByText(/大炎皇统历 ·/)).not.toBeInTheDocument()
    // With no recorded dates, the interface must report insufficient evidence.
    expect(screen.getByText(/尚未登记章节时间点，无法判断时间线是否一致/)).toBeInTheDocument()
    expect(screen.queryByText(/未发现顺序冲突/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByText(/套用「东方玄幻双历」预设/))
    expect(screen.getByText(/上古灵历 ·/)).toBeInTheDocument()
    expect(screen.getByText('本书历法体系（2 套）')).toBeInTheDocument()
  })

  it('converts nothing until the author defines two calendars, then converts between his own', async () => {
    vi.mocked(indexedDbMultiCalendarRepository.get).mockResolvedValue(undefined)
    render(<MultiCalendarMasterView projectId="p1" />)

    await screen.findByText('本书历法体系（0 套）')
    expect(screen.getByText(/至少定义两套不同的历法才能换算/)).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('例如：圣历、共和历'), {
      target: { value: '圣历' },
    })
    fireEvent.click(screen.getByRole('button', { name: '添加自定义历法' }))

    expect(screen.getByText('本书历法体系（1 套）')).toBeInTheDocument()
    expect(screen.getByText(/圣历 · 12 月\/年/)).toBeInTheDocument()
    expect(screen.getByText(/至少定义两套不同的历法才能换算/)).toBeInTheDocument()
  })

  it('stores a uniquely verified source excerpt with the chronology event', async () => {
    const excerpt = '王都守城人敲响晨钟。'
    const chapterText = `前文。${excerpt}后文。`
    vi.mocked(indexedDbProjectRepository.getChaptersByProject).mockResolvedValue([
      {
        id: 'ch-1',
        projectId: 'p1',
        volumeId: 'vol-1',
        title: '抵达王都',
        order: 1,
        revision: 7,
        content: chapterText,
      } as any,
    ])
    vi.mocked(indexedDbMultiCalendarRepository.get).mockResolvedValue({
      ...authoredRecord,
      chronologyEvents: [],
    } as any)

    render(<MultiCalendarMasterView projectId="p1" />)

    await userEvent.click(await screen.findByRole('combobox', { name: '采用历法' }))
    await userEvent.click(await screen.findByRole('option', { name: '上古灵历' }))
    await userEvent.click(screen.getByRole('combobox', { name: '叙述顺序' }))
    await userEvent.click(await screen.findByRole('option', { name: '主线推进（参与自检）' }))
    fireEvent.change(screen.getByRole('textbox', { name: '事件简介' }), {
      target: { value: '守城人报时' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: '原文时间证据（选填）' }), {
      target: { value: excerpt },
    })
    fireEvent.click(screen.getByRole('button', { name: '登记时间锚点' }))
    fireEvent.click(screen.getByText('保存历法时间线'))

    await waitFor(() => expect(indexedDbMultiCalendarRepository.save).toHaveBeenCalled())
    const saved = vi.mocked(indexedDbMultiCalendarRepository.save).mock.calls.at(-1)?.[0]
    expect(saved?.chronologyEvents[0]).toMatchObject({
      chapterId: 'ch-1',
      sequenceRole: 'mainline',
      eventSummary: '守城人报时',
      provenance: {
        sourceType: 'author',
        factLevel: 'canonical-fact',
        sourceDocumentId: 'ch-1',
        sourceRevision: 7,
        evidence: [
          {
            documentId: 'ch-1',
            excerpt,
            semanticFrom: chapterText.indexOf(excerpt),
            semanticTo: chapterText.indexOf(excerpt) + excerpt.length,
          },
        ],
      },
    })
  })

  it('opens a conflict source at its verified excerpt when the editor is available', async () => {
    const navigateToSource = vi.fn().mockResolvedValue({ status: 'opened', highlighted: true })
    mockUseActiveWriting.mockReturnValue({ navigateToSource })
    vi.mocked(indexedDbProjectRepository.getChaptersByProject).mockResolvedValue([
      {
        id: 'ch-1',
        projectId: 'p1',
        volumeId: 'vol-1',
        title: '離城',
        order: 1,
        revision: 2,
        content: '城门开启。',
      } as any,
      {
        id: 'ch-2',
        projectId: 'p1',
        volumeId: 'vol-1',
        title: '抵达王都',
        order: 2,
        revision: 3,
        content: '众人抵达王都。',
      } as any,
    ])
    vi.mocked(indexedDbMultiCalendarRepository.get).mockResolvedValue({
      ...authoredRecord,
      chronologyEvents: [
        {
          chapterId: 'ch-1',
          chapterOrder: 1,
          chapterTitle: '離城',
          sequenceRole: 'mainline',
          timePoint: {
            calendarId: 'cal_ancient',
            year: 100,
            month: 1,
            day: 1,
            absoluteDayIndex: 10000,
          },
          eventSummary: '離城',
          provenance: {
            sourceType: 'author',
            factLevel: 'canonical-fact',
            sourceDocumentId: 'ch-1',
            sourceRevision: 2,
            evidence: [
              {
                documentId: 'ch-1',
                excerpt: '城门开启。',
                semanticFrom: 0,
                semanticTo: 5,
              },
            ],
          },
        },
        {
          chapterId: 'ch-2',
          chapterOrder: 2,
          chapterTitle: '抵达王都',
          sequenceRole: 'mainline',
          timePoint: {
            calendarId: 'cal_ancient',
            year: 99,
            month: 5,
            day: 1,
            absoluteDayIndex: 9000,
          },
          eventSummary: '抵达',
          provenance: {
            sourceType: 'author',
            factLevel: 'canonical-fact',
            sourceDocumentId: 'ch-2',
            sourceRevision: 3,
            evidence: [
              {
                documentId: 'ch-2',
                excerpt: '众人抵达王都。',
                semanticFrom: 0,
                semanticTo: 7,
              },
            ],
          },
        },
      ],
    } as any)

    render(<MultiCalendarMasterView projectId="p1" />)

    fireEvent.click(await screen.findByRole('button', { name: '打开第 1 章原文证据' }))

    await waitFor(() =>
      expect(navigateToSource).toHaveBeenCalledWith({
        documentId: 'ch-1',
        sourceRevision: 2,
        excerpt: '城门开启。',
        semanticFrom: 0,
        semanticTo: 5,
      }),
    )
    expect(await screen.findByRole('status')).toHaveTextContent('已定位到《離城》的原文。')
  })

  it('reprojects stored chapter order across volumes before checking chronology', async () => {
    vi.mocked(indexedDbProjectRepository.getChaptersByProject).mockResolvedValue([
      { id: 'chapter-1', projectId: 'p1', volumeId: 'vol-1', title: '第一卷起点', order: 1 },
      { id: 'chapter-2', projectId: 'p1', volumeId: 'vol-1', title: '第一卷终点', order: 2 },
      { id: 'chapter-3', projectId: 'p1', volumeId: 'vol-2', title: '第二卷起点', order: 1 },
    ] as any)
    vi.mocked(indexedDbMultiCalendarRepository.get).mockResolvedValue({
      ...authoredRecord,
      chronologyEvents: [
        {
          chapterId: 'chapter-2',
          chapterOrder: 2,
          chapterTitle: '第一卷终点',
          sequenceRole: 'mainline',
          timePoint: {
            calendarId: 'cal_ancient',
            year: 100,
            month: 1,
            day: 1,
            absoluteDayIndex: 10000,
          },
          eventSummary: '先发生的故事时间',
          provenance: { evidence: [{ documentId: 'chapter-2', excerpt: '第一卷终点证据' }] },
        },
        {
          chapterId: 'chapter-3',
          chapterOrder: 1,
          chapterTitle: '第二卷起点',
          sequenceRole: 'mainline',
          timePoint: {
            calendarId: 'cal_ancient',
            year: 99,
            month: 5,
            day: 1,
            absoluteDayIndex: 9000,
          },
          eventSummary: '后发生的故事时间',
          provenance: { evidence: [{ documentId: 'chapter-3', excerpt: '第二卷起点证据' }] },
        },
      ],
    } as any)

    render(<MultiCalendarMasterView projectId="p1" />)

    expect(await screen.findByText(/主线顺序与故事时间有 1 处不一致/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '打开第 2 章原文证据' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '打开第 3 章原文证据' })).toBeInTheDocument()
  })

  it('drawer reports an unconfigured world rather than falling back to the preset (P2.4)', async () => {
    vi.mocked(indexedDbMultiCalendarRepository.get).mockResolvedValue(undefined)
    render(<MultiCalendarDrawer projectId="p1" currentText="平静的一个早晨。" />)

    expect(await screen.findByText('0 套并行历法')).toBeInTheDocument()
    expect(screen.getByText(/尚未定义任何历法/)).toBeInTheDocument()
    expect(screen.queryByText(/时间线流动自检/)).not.toBeInTheDocument()
  })
})
