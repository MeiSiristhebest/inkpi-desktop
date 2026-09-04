import { describe, it, expect } from 'vitest';
import { generateNextCodeByRule } from './codeRule';

describe('Domain: generateNextCodeByRule (纯业务规则计算器)', () => {
  it('当没有 codeRule 时返回空字符串', () => {
    expect(generateNextCodeByRule(undefined, [])).toBe('');
    expect(generateNextCodeByRule('', [])).toBe('');
  });

  it('按照前缀与数字位宽自动递增序号', () => {
    const rows = [
      { id: '1', projectId: 'p1', tabId: 't1', data: { '序号': 'N0001' }, createdAt: 1, updatedAt: 1 },
      { id: '2', projectId: 'p1', tabId: 't1', data: { '序号': 'N0002' }, createdAt: 2, updatedAt: 2 },
    ];
    const next = generateNextCodeByRule('N{0000}', rows);
    expect(next).toBe('N0003');
  });

  it('当 rows 为空时返回首个序号', () => {
    const next = generateNextCodeByRule('ITEM-{000}', []);
    expect(next).toBe('ITEM-001');
  });

  it('智能识别乱序或已存在最大编号', () => {
    const rows = [
      { id: '1', projectId: 'p1', tabId: 't1', data: { '编号': 'SEC-009' }, createdAt: 1, updatedAt: 1 },
      { id: '2', projectId: 'p1', tabId: 't1', data: { '编号': 'SEC-002' }, createdAt: 2, updatedAt: 2 },
    ];
    const next = generateNextCodeByRule('SEC-{000}', rows);
    expect(next).toBe('SEC-010');
  });
});
