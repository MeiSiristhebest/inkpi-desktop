import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTableViewModel, type TableDomainWriteService } from './useTableViewModel'
import { useCardViewModel, type CardDomainWriteService } from './useCardViewModel'
import { useFormViewModel, type FormDomainWriteService } from './useFormViewModel'
import type { TableRecordRepository } from '../ports/tableRecordRepository'
import type { CardRecordRepository } from '../ports/cardRecordRepository'
import type { FormDataRepository } from '../ports/formDataRepository'
import type { TableRowRecord, CardRecord } from '../types'

describe('Presentation Model: useTableViewModel', () => {
  let inMemoryRows: TableRowRecord[] = []
  let domSaveTableRow: ReturnType<typeof vi.fn>
  let domDeleteTableRow: ReturnType<typeof vi.fn>
  const mockRepo: TableRecordRepository = {
    getRows: async (pId, tId) => inMemoryRows.filter((r) => r.projectId === pId && r.tabId === tId),
    saveRow: async (row) => row,
    deleteRow: async () => undefined,
  }

  // 领域服务 spy：把写入镜像到读取用的内存数组，并记录调用参数。
  const mockDomainService = (): TableDomainWriteService => ({
    saveTableRow: async (row: TableRowRecord) => {
      domSaveTableRow(row)
      const idx = inMemoryRows.findIndex((r) => r.id === row.id)
      if (idx >= 0) inMemoryRows[idx] = row
      else inMemoryRows.push(row)
    },
    deleteTableRow: async (id: string) => {
      domDeleteTableRow(id)
      inMemoryRows = inMemoryRows.filter((r) => r.id !== id)
    },
  })

  beforeEach(() => {
    inMemoryRows = []
    domSaveTableRow = vi.fn()
    domDeleteTableRow = vi.fn()
  })

  it('支持根据 codeRule 自动分配编号并完成 CRUD', async () => {
    const { result } = renderHook(() =>
      useTableViewModel({
        projectId: 'p1',
        tabId: 't1',
        codeRule: 'N{0000}',
        repository: mockRepo,
        domainService: mockDomainService(),
      }),
    )

    // 新增行
    act(() => {
      result.current.createRow()
    })
    expect(result.current.editingRow).not.toBeNull()
    expect(result.current.editingRow?.data['编号']).toBe('N0001')

    // 修改内容并保存 -> 监听写入是否经 DomainApplicationService
    act(() => {
      result.current.setEditingRow({
        ...result.current.editingRow!,
        data: { ...result.current.editingRow!.data, 名称: '太虚剑宗' },
      })
    })

    await act(async () => {
      await result.current.saveEditing()
    })

    expect(domSaveTableRow).toHaveBeenCalledTimes(1)
    expect(domSaveTableRow.mock.calls[0][0].data['名称']).toBe('太虚剑宗')
    expect(result.current.rows.length).toBe(1)
    expect(result.current.rows[0].data['名称']).toBe('太虚剑宗')

    // 删除行
    await act(async () => {
      await result.current.deleteRow(result.current.rows[0].id)
    })
    expect(domDeleteTableRow).toHaveBeenCalledTimes(1)
    expect(result.current.rows.length).toBe(0)
  })
})

describe('Presentation Model: useCardViewModel', () => {
  let inMemoryCards: CardRecord[] = []
  let domSaveCard: ReturnType<typeof vi.fn>
  let domDeleteCard: ReturnType<typeof vi.fn>
  const mockCardRepo: CardRecordRepository = {
    getCards: async (pId, tId) =>
      inMemoryCards.filter((c) => c.projectId === pId && c.tabId === tId),
    saveCard: async (card) => card,
    deleteCard: async () => undefined,
  }

  // 领域服务 spy：把写入镜像到读取用的内存数组，并记录调用参数。
  const mockDomainService = (): CardDomainWriteService => ({
    saveCard: async (card: CardRecord) => {
      domSaveCard(card)
      const idx = inMemoryCards.findIndex((c) => c.id === card.id)
      if (idx >= 0) inMemoryCards[idx] = card
      else inMemoryCards.push(card)
    },
    deleteCard: async (id: string) => {
      domDeleteCard(id)
      inMemoryCards = inMemoryCards.filter((c) => c.id !== id)
    },
  })

  beforeEach(() => {
    inMemoryCards = []
    domSaveCard = vi.fn()
    domDeleteCard = vi.fn()
  })

  it('支持卡片档案的新增、命名回退、编辑与删除', async () => {
    const { result } = renderHook(() =>
      useCardViewModel({
        projectId: 'p1',
        tabId: 'card-tab',
        repository: mockCardRepo,
        domainService: mockDomainService(),
      }),
    )

    act(() => {
      result.current.createCard()
    })
    expect(result.current.editingCard).not.toBeNull()

    // 未指定名称时保存，默认回退为 '未命名卡片'，且写入必须经 DomainApplicationService
    await act(async () => {
      await result.current.saveEditing()
    })
    expect(domSaveCard).toHaveBeenCalledTimes(1)
    expect(result.current.cards[0].name).toBe('未命名卡片')

    // 删除卡片
    await act(async () => {
      await result.current.deleteCard(result.current.cards[0].id)
    })
    expect(domDeleteCard).toHaveBeenCalledTimes(1)
    expect(result.current.cards.length).toBe(0)
  })
})

describe('Presentation Model: useFormViewModel', () => {
  let inMemoryStore: Record<string, Record<string, unknown>> = {}
  let domSaveForm: ReturnType<typeof vi.fn>
  const mockFormRepo: FormDataRepository = {
    getFormData: async (pId, tId) => {
      const key = `${pId}::${tId}`
      return inMemoryStore[key] || {}
    },
    saveFormData: async () => undefined,
  }

  // 领域服务 spy：把写入镜像到读取用的内存 store，并记录调用参数。
  const mockDomainService = (): FormDomainWriteService => ({
    saveForm: async (projectId, tabId, data) => {
      domSaveForm(projectId, tabId, data)
      inMemoryStore[`${projectId}::${tabId}`] = data
    },
  })

  beforeEach(() => {
    inMemoryStore = {}
    domSaveForm = vi.fn()
  })

  it('支持设定表单字段变更与状态脏检查保存', async () => {
    const { result } = renderHook(() =>
      useFormViewModel({
        projectId: 'p1',
        tabId: 'worldview-form',
        repository: mockFormRepo,
        domainService: mockDomainService(),
      }),
    )

    act(() => {
      result.current.updateField('力量体系', '练气、筑基、金丹')
    })
    expect(result.current.formData['力量体系']).toBe('练气、筑基、金丹')
    expect(result.current.isSaved).toBe(false)

    await act(async () => {
      await result.current.save()
    })
    expect(domSaveForm).toHaveBeenCalledTimes(1)
    expect(domSaveForm.mock.calls[0][0]).toBe('p1')
    expect(domSaveForm.mock.calls[0][1]).toBe('worldview-form')
    expect(result.current.isSaved).toBe(true)
    expect(inMemoryStore['p1::worldview-form']?.['力量体系']).toBe('练气、筑基、金丹')
  })
})
