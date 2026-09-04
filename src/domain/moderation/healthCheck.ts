// 数据结构健康体检的领域规则（纯函数，零依赖，可脱离环境单测）。
// 从 CheckTools 组件外移（评审 §2.3）：组件只负责 I/O（经仓储端口加载行），
// 规则本身与 React / db 无关。

export interface HealthIssue {
  id: string
  severity: 'error' | 'warn' | 'info'
  category: string
  title: string
  detail: string
}

export interface TableRowInput {
  id: string
  data: Record<string, any>
}

export interface HealthTabContext {
  id: string
  name: string
  displayCol?: string
}

/** 编号唯一性扫描：同一 tab 内「编号」字段出现多次即视为冲突 */
export const findDuplicateCodes = (rows: TableRowInput[], tab: HealthTabContext): HealthIssue[] => {
  const issues: HealthIssue[] = []
  const codeMap = new Map<string, string[]>()
  const displayCol = tab.displayCol || '名称'
  for (const r of rows) {
    const code = String(r.data?.['编号'] || '').trim()
    if (!code) continue
    const arr = codeMap.get(code) || []
    arr.push(String(r.data?.[displayCol] || r.id))
    codeMap.set(code, arr)
  }
  for (const [code, names] of codeMap) {
    if (names.length > 1) {
      issues.push({
        id: `dup-${tab.id}-${code}`,
        severity: 'error',
        category: '编号冲突',
        title: `《${tab.name}》编号「${code}」重复`,
        detail: `以下条目使用了相同的编号：${names.join('、')}。重复会导致交叉引用错位。`,
      })
    }
  }
  return issues
}

/** 主标识必填空扫描：displayCol 字段留空的条目 */
export const findMissingDisplayNames = (rows: TableRowInput[], tab: HealthTabContext): HealthIssue[] => {
  const issues: HealthIssue[] = []
  if (!tab.displayCol) return issues
  for (const r of rows) {
    const val = String(r.data?.[tab.displayCol] || '').trim()
    if (!val) {
      issues.push({
        id: `empty-${tab.id}-${r.id}`,
        severity: 'warn',
        category: '必填项留空',
        title: `《${tab.name}》存在未命名的条目`,
        detail: `字段「${tab.displayCol}」未填写，会影响大纲关联与全书检索。`,
      })
    }
  }
  return issues
}
