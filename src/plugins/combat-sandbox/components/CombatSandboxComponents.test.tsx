import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { CombatSandboxMasterView } from './CombatSandboxMasterView'
import { CombatSandboxDrawer } from './CombatSandboxDrawer'
import { indexedDbCombatSandboxRepository } from '../../../adapters/indexedDbCombatSandboxRepository'

vi.mock('../../../adapters/indexedDbCombatSandboxRepository', () => ({
  indexedDbCombatSandboxRepository: {
    getAll: vi.fn().mockResolvedValue([
      {
        id: 'duel-1',
        projectId: 'p1',
        protagonistName: '韩立',
        protagonistTier: '筑基初期',
        protagonistRankValue: 10,
        enemyName: '王蝉少主',
        enemyTier: '金丹初期',
        enemyRankValue: 20,
        stakes: '逃离燕家堡',
        beats: [
          {
            phase: 'probing',
            attacker: '王蝉少主',
            moveName: '试探',
            tacticDescription: '冷笑',
            damageOrConsequence: '避开',
          },
        ],
        compensatoryAssets: ['天阶辟邪神雷'],
        breachAudit: {
          isBreached: false,
          tierDifference: 10,
          riskLevel: 'SAFE',
          diagnostic: '合格',
          compensatoryFactorsNeeded: [],
        },
        updatedAt: Date.now(),
      },
    ]),
    save: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('CombatSandbox Components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders CombatSandboxMasterView and allows saving duel', async () => {
    render(<CombatSandboxMasterView projectId="p1" />)

    expect(screen.getByText(/东方玄幻战力与拆招沙盘/)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/四段博弈标准拆招链/)).toBeInTheDocument()
    })

    const saveBtn = screen.getByText('保存对决演武')
    fireEvent.click(saveBtn)
    expect(indexedDbCombatSandboxRepository.save).toHaveBeenCalled()
  })

  it('renders CombatSandboxDrawer with live duel parameters', async () => {
    render(
      <CombatSandboxDrawer
        projectId="p1"
        currentText="韩立祭出法宝，与王蝉少主展开激烈交手对轰！"
      />
    )

    expect(screen.getByText(/战力对招随动感知/)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/韩立 \(筑基初期\)/)).toBeInTheDocument()
      expect(screen.getByText(/王蝉少主 \(金丹初期\)/)).toBeInTheDocument()
    })
  })
})
