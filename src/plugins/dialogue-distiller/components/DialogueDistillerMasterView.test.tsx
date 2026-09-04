import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DialogueDistillerMasterView } from './DialogueDistillerMasterView'

vi.mock('../../../adapters/indexedDbDialogueVoiceprintRepository', () => ({
  indexedDbDialogueVoiceprintRepository: {
    getAll: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../../../adapters/indexedDbCodexEntityRepository', () => ({
  indexedDbCodexEntityRepository: {
    getAll: vi.fn().mockResolvedValue([
      { id: 'c1', name: '陆沉', category: 'character', projectId: 'p1' },
      { id: 'c2', name: '林夕', category: 'character', projectId: 'p1' },
    ]),
  },
}))

describe('DialogueDistillerMasterView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders heading, extract textbox and presets', async () => {
    render(<DialogueDistillerMasterView projectId="p1" />)
    expect(screen.getByText('角色对白声纹分析仪')).toBeDefined()
    expect(screen.getByText(/言语风格测度学/)).toBeDefined()
    expect(screen.getByText(/经典角色语言风格指纹对照/)).toBeDefined()
  })

  it('triggers extraction and comparison upon clicking buttons', async () => {
    render(<DialogueDistillerMasterView projectId="p1" />)
    const extractBtn = screen.getByText('提取并解析声纹')
    fireEvent.click(extractBtn)

    const compareBtn = screen.getByText('比对')
    fireEvent.click(compareBtn)

    await waitFor(() => {
      expect(screen.getByText(/余弦相似度/)).toBeDefined()
    })
  })
})
