import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTableViewModel } from './useTableViewModel';
import { useCardViewModel } from './useCardViewModel';
import { useFormViewModel } from './useFormViewModel';
import type { TableRecordRepository } from '../ports/tableRecordRepository';
import type { CardRecordRepository } from '../ports/cardRecordRepository';
import type { FormDataRepository } from '../ports/formDataRepository';
import type { TableRowRecord, CardRecord } from '../types';

describe('Presentation Model: useTableViewModel', () => {
  let inMemoryRows: TableRowRecord[] = [];
  const mockRepo: TableRecordRepository = {
    getRows: async (pId, tId) => inMemoryRows.filter((r) => r.projectId === pId && r.tabId === tId),
    saveRow: async (row) => {
      const idx = inMemoryRows.findIndex((r) => r.id === row.id);
      if (idx >= 0) inMemoryRows[idx] = row;
      else inMemoryRows.push(row);
    },
    deleteRow: async (id) => {
      inMemoryRows = inMemoryRows.filter((r) => r.id !== id);
    },
  };

  beforeEach(() => {
    inMemoryRows = [];
  });

  it('支持根据 codeRule 自动分配编号并完成 CRUD', async () => {
    const { result } = renderHook(() =>
      useTableViewModel({
        projectId: 'p1',
        tabId: 't1',
        codeRule: 'N{0000}',
        repository: mockRepo,
      })
    );

    // 新增行
    act(() => {
      result.current.createRow();
    });
    expect(result.current.editingRow).not.toBeNull();
    expect(result.current.editingRow?.data['编号']).toBe('N0001');

    // 修改内容并保存
    act(() => {
      result.current.setEditingRow({
        ...result.current.editingRow!,
        data: { ...result.current.editingRow!.data, '名称': '太虚剑宗' },
      });
    });

    await act(async () => {
      await result.current.saveEditing();
    });

    expect(result.current.rows.length).toBe(1);
    expect(result.current.rows[0].data['名称']).toBe('太虚剑宗');

    // 删除行
    await act(async () => {
      await result.current.deleteRow(result.current.rows[0].id);
    });
    expect(result.current.rows.length).toBe(0);
  });
});

describe('Presentation Model: useCardViewModel', () => {
  let inMemoryCards: CardRecord[] = [];
  const mockCardRepo: CardRecordRepository = {
    getCards: async (pId, tId) => inMemoryCards.filter((c) => c.projectId === pId && c.tabId === tId),
    saveCard: async (card) => {
      const idx = inMemoryCards.findIndex((c) => c.id === card.id);
      if (idx >= 0) inMemoryCards[idx] = card;
      else inMemoryCards.push(card);
    },
    deleteCard: async (id) => {
      inMemoryCards = inMemoryCards.filter((c) => c.id !== id);
    },
  };

  beforeEach(() => {
    inMemoryCards = [];
  });

  it('支持卡片档案的新增、命名回退、编辑与删除', async () => {
    const { result } = renderHook(() =>
      useCardViewModel({
        projectId: 'p1',
        tabId: 'card-tab',
        repository: mockCardRepo,
      })
    );

    act(() => {
      result.current.createCard();
    });
    expect(result.current.editingCard).not.toBeNull();

    // 未指定名称时保存，默认回退为 '未命名卡片'
    await act(async () => {
      await result.current.saveEditing();
    });
    expect(result.current.cards[0].name).toBe('未命名卡片');

    // 删除卡片
    await act(async () => {
      await result.current.deleteCard(result.current.cards[0].id);
    });
    expect(result.current.cards.length).toBe(0);
  });
});

describe('Presentation Model: useFormViewModel', () => {
  let inMemoryStore: Record<string, any> = {};
  const mockFormRepo: FormDataRepository = {
    getFormData: async (pId, tId) => {
      const key = `${pId}::${tId}`;
      return inMemoryStore[key] || {};
    },
    saveFormData: async (pId, tId, data) => {
      const key = `${pId}::${tId}`;
      inMemoryStore[key] = data;
    },
  };

  beforeEach(() => {
    inMemoryStore = {};
  });

  it('支持设定表单字段变更与状态脏检查保存', async () => {
    const { result } = renderHook(() =>
      useFormViewModel({
        projectId: 'p1',
        tabId: 'worldview-form',
        repository: mockFormRepo,
      })
    );

    act(() => {
      result.current.updateField('力量体系', '练气、筑基、金丹');
    });
    expect(result.current.formData['力量体系']).toBe('练气、筑基、金丹');
    expect(result.current.isSaved).toBe(false);

    await act(async () => {
      await result.current.save();
    });
    expect(result.current.isSaved).toBe(true);
    expect(inMemoryStore['p1::worldview-form']?.['力量体系']).toBe('练气、筑基、金丹');
  });
});
