import { describe, it, expect } from 'vitest'
import { findDuplicateCodes, findMissingDisplayNames } from './healthCheck'

const tab = { id: 'characters', name: '人物', displayCol: '名称' }

describe('healthCheck 领域规则', () => {
  it('findDuplicateCodes 捕获同一 tab 内重复编号', () => {
    const rows = [
      { id: 'r1', data: { 编号: '001', 名称: '张三' } },
      { id: 'r2', data: { 编号: '001', 名称: '李四' } },
      { id: 'r3', data: { 编号: '002', 名称: '王五' } },
    ]
    const issues = findDuplicateCodes(rows, tab)
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('error')
    expect(issues[0].title).toContain('编号「001」重复')
    expect(issues[0].detail).toContain('张三')
    expect(issues[0].detail).toContain('李四')
  })

  it('findDuplicateCodes 忽略空编号', () => {
    const rows = [
      { id: 'r1', data: { 名称: '张三' } },
      { id: 'r2', data: { 名称: '李四' } },
    ]
    expect(findDuplicateCodes(rows, tab)).toHaveLength(0)
  })

  it('findMissingDisplayNames 捕获必填留空', () => {
    const rows = [
      { id: 'r1', data: { 编号: '001', 名称: '张三' } },
      { id: 'r2', data: { 编号: '002' } }, // 名称空
    ]
    const issues = findMissingDisplayNames(rows, tab)
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('warn')
    expect(issues[0].category).toBe('必填项留空')
  })

  it('findMissingDisplayNames 在无 displayCol 时返回空', () => {
    expect(findMissingDisplayNames([{ id: 'r1', data: {} }], { id: 't', name: 'T' })).toHaveLength(0)
  })
})
