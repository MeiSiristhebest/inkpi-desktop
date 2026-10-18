import { describe, expect, it } from 'vitest'
import { MemoryPalaceEngine, MemoryPalaceWorkspaceIndex } from './MemoryPalaceEngine'

const chapter = {
  id: 'c',
  projectId: 'p',
  volumeId: 'v',
  title: '章',
  content: '阿明\n明明再次见阿明。',
  order: 0,
  wordCount: 0,
  revision: 2,
  createdAt: 1,
  updatedAt: 1,
}
const entity = {
  id: 'e',
  projectId: 'p',
  name: '阿明',
  aliases: ['明明'],
  category: 'character',
  summary: '',
  tags: [],
  createdAt: 1,
  updatedAt: 1,
}
describe('literal memory occurrence evidence', () => {
  it('counts every name and alias occurrence with exact source positions', () => {
    const result = MemoryPalaceEngine.searchEntityOccurrences({
      query: '阿明',
      entities: [entity],
      chapters: [chapter],
    })[0]
    expect(result.totalOccurrences).toBe(3)
    expect(result.occurrences?.map((o) => o.offset)).toEqual([0, 3, 8])
  })
  it('does not let callers mutate stored chapters or import another project entity', () => {
    const index = new MemoryPalaceWorkspaceIndex('p')
    const input = { ...chapter }
    index.update(input)
    input.content = ''
    index.snapshot()[0].content = ''
    expect(index.search('阿明', [entity])[0].totalOccurrences).toBe(3)
    expect(index.search('阿明', [{ ...entity, projectId: 'other' }])).toEqual([])
  })
})
