import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { CombatSandboxMasterView } from './CombatSandboxMasterView'
import { CombatSandboxDrawer } from './CombatSandboxDrawer'
import { indexedDbCombatSandboxRepository } from '../../../adapters/indexedDbCombatSandboxRepository'
import { indexedDbPowerTierRepository } from '../../../adapters/indexedDbPowerTierRepository'
import { pluginEventBus } from '../../../core/pluginEventBus'

vi.mock('../../../adapters/indexedDbCombatSandboxRepository', () => ({
  indexedDbCombatSandboxRepository: {
    getAll: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
  },
}))

const savedDuel = {
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
}

const authorLadder = {
  projectId: 'p1',
  systemName: '星轨九阶',
  tiers: ['觉醒者', '驭星者', '灭世者'],
  specialModifiers: [],
  updatedAt: 1000,
}

describe('CombatSandbox Components', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await indexedDbPowerTierRepository.delete('p1')
    vi.mocked(indexedDbCombatSandboxRepository.getAll).mockResolvedValue([savedDuel] as never)
  })

  // 对决能存盘的前提是作者自己定义过阶梯；这里补的是作者设定，不是插件内置值。
  it('renders a saved duel and allows saving it back', async () => {
    await indexedDbPowerTierRepository.save(authorLadder)
    render(<CombatSandboxMasterView projectId="p1" />)

    expect(screen.getByText(/战力与拆招沙盘/)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByDisplayValue('韩立')).toBeInTheDocument()
    })

    const saveBtn = screen.getByText('保存对决演武')
    await waitFor(() => expect(saveBtn).toBeEnabled())
    fireEvent.click(saveBtn)
    await waitFor(() => expect(indexedDbCombatSandboxRepository.save).toHaveBeenCalled())
  })

  // §P2.4：作者没配置时不能替他摆好一场修真对决，也不能给出任何"看起来正常"的战力结论。
  it('refuses to compute anything while the workspace has no power ladder (P2.4)', async () => {
    vi.mocked(indexedDbCombatSandboxRepository.getAll).mockResolvedValue([])
    render(<CombatSandboxMasterView projectId="p1" />)

    expect(
      await screen.findByText(/本书还没有战力阶梯。先去「战力阶梯与设定巡检哨兵」/),
    ).toBeInTheDocument()
    expect(screen.getByText('战力与拆招沙盘 (Combat Sandbox)')).toBeInTheDocument()
    // 内置的练气→渡劫阶梯不再是下拉框里唯一可选项
    expect(screen.queryByText(/练气期/)).not.toBeInTheDocument()
    expect(screen.queryByText(/渡劫飞升/)).not.toBeInTheDocument()
    // 没有主角/死敌/天阶底牌，也没有挂载时就生成好的四段拆招正文
    expect(screen.queryByText('主角')).not.toBeInTheDocument()
    expect(screen.queryByText('死敌')).not.toBeInTheDocument()
    expect(screen.queryByText('天阶雷法属性克制')).not.toBeInTheDocument()
    expect(screen.queryByText(/第 1 阶段：/)).not.toBeInTheDocument()
    expect(screen.getByText(/还没有拆招链/)).toBeInTheDocument()
    expect(screen.getByText('保存对决演武')).toBeDisabled()
    expect(screen.queryByText(/战力巡检状态：/)).not.toBeInTheDocument()
  })

  it("takes the ladder from the author's own power system, not from a built-in one", async () => {
    vi.mocked(indexedDbCombatSandboxRepository.getAll).mockResolvedValue([])
    await indexedDbPowerTierRepository.save(authorLadder)

    render(<CombatSandboxMasterView projectId="p1" />)
    await screen.findByText(/填写对阵双方的名字/)

    expect(screen.getAllByRole('option', { name: /觉醒者（序位 10）/ })).toHaveLength(2)
    expect(screen.getAllByRole('option', { name: /灭世者（序位 30）/ })).toHaveLength(2)
    expect(screen.queryByText(/筑基期/)).not.toBeInTheDocument()
  })

  // P2.12：巡检结论是渲染期算出来的，事件只能由"保存对决"这个权威写入动作发出。
  it('publishes POWER_BREACH_DETECTED on save, never while merely rendering', async () => {
    vi.mocked(indexedDbCombatSandboxRepository.getAll).mockResolvedValue([])
    await indexedDbPowerTierRepository.save(authorLadder)

    const seen: unknown[] = []
    const unsub = pluginEventBus.on('POWER_BREACH_DETECTED', (payload) => {
      seen.push(payload)
    })

    render(<CombatSandboxMasterView projectId="p1" />)
    // 阶梯是异步读出来的；option 落地前改 select 会被 jsdom 判成非法值，序位会停在 0
    await screen.findByText(/填写对阵双方的名字/)

    fireEvent.change(screen.getByLabelText('主角名'), { target: { value: '沈煜' } })
    fireEvent.change(screen.getByLabelText('对手名'), { target: { value: '裴观澜' } })
    fireEvent.click(screen.getByText('保存对决演武'))
    expect(indexedDbCombatSandboxRepository.save).not.toHaveBeenCalled()
    expect(seen).toHaveLength(0)

    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: '10' } })
    fireEvent.change(selects[1], { target: { value: '30' } })
    fireEvent.click(screen.getByText('保存对决演武'))

    await waitFor(() => expect(indexedDbCombatSandboxRepository.save).toHaveBeenCalled())
    await waitFor(() => expect(seen).toHaveLength(1))
    expect(seen[0]).toMatchObject({ tierDiff: 20, riskLevel: 'CRITICAL_COLLAPSE' })
    unsub()
  })

  it('renders CombatSandboxDrawer with live duel parameters', async () => {
    render(
      <CombatSandboxDrawer
        projectId="p1"
        currentText="韩立祭出法宝，与王蝉少主展开激烈交手对轰！"
      />,
    )

    expect(screen.getByText(/战力对招随动感知/)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/韩立 \(筑基初期\)/)).toBeInTheDocument()
      expect(screen.getByText(/王蝉少主 \(金丹初期\)/)).toBeInTheDocument()
    })
  })
})
