import type { TableRowRecord } from '../../types';

export function generateNextCodeByRule(
  codeRule: string | undefined,
  rows: TableRowRecord[]
): string {
  if (!codeRule) return '';

  const prefixMatch = codeRule.match(/^(.*)\{(\d+)\}$/);
  if (!prefixMatch) return '';

  const prefix = prefixMatch[1];
  const digits = prefixMatch[2].length;
  let maxNum = 0;

  for (const r of rows) {
    const val = r.data['序号'] || r.data['编号'] || '';
    if (typeof val === 'string' && val.startsWith(prefix)) {
      const n = parseInt(val.slice(prefix.length), 10);
      if (!isNaN(n) && n > maxNum) {
        maxNum = n;
      }
    }
  }

  return prefix + String(maxNum + 1).padStart(digits, '0');
}
