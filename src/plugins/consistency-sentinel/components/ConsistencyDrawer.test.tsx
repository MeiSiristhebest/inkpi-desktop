import { describe, it, expect, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { ConsistencyDrawer } from './ConsistencyDrawer'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'
import { indexedDbPowerTierRepository } from '../../../adapters/indexedDbPowerTierRepository'
import { indexedDbCombatSandboxRepository } from '../../../adapters/indexedDbCombatSandboxRepository'
import { pluginEventBus } from '../../../core/pluginEventBus'
import type { CombatDuelRecord } from '../../../ports/combatSandboxRepository'

const combatRecord = (breachAudit: CombatDuelRecord['breachAudit']): CombatDuelRecord => ({
  id: 'duel-saved',
  projectId: 'p-event',
  protagonistName: '甲',
  protagonistTier: '一阶',
  protagonistRankValue: 10,
  enemyName: '乙',
  enemyTier: '二阶',
  enemyRankValue: 20,
  stakes: '守住城门',
  beats: [],
  compensatoryAssets: [],
  breachAudit,
  updatedAt: 100,
})

describe('ConsistencyDrawer — 设定自洽写作随动抽屉', () => {
  beforeEach(async () => {
    pluginEventBus.clear()
    await indexedDbPowerTierRepository.delete('p1')
    const all = await indexedDbCodexEntityRepository.getAll()
    await Promise.all(all.map((e) => indexedDbCodexEntityRepository.delete(e.id)))
    const duels = await indexedDbCombatSandboxRepository.getAll('p-event')
    await Promise.all(duels.map((duel) => indexedDbCombatSandboxRepository.delete(duel.id)))
  })

  it('admits it cannot judge tier inversions when nothing is configured (§P2.4)', async () => {
    render(<ConsistencyDrawer projectId="p1" currentText="楚凌霄在洞府打坐修持。" />)
    expect(screen.getByText('设定自洽哨兵')).toBeInTheDocument()
    expect(screen.getByText('未配置阶梯')).toBeInTheDocument()
    expect(await screen.findByText('未套用战力阶梯，越阶倒错无法判定')).toBeInTheDocument()
    expect(screen.getByText('未套用战力阶梯，这里只巡检已标注为已故的角色。')).toBeInTheDocument()
    expect(screen.getByTestId('score-provenance')).toHaveTextContent('来源：即时规则')
  })

  it('reports literal coverage without claiming complete consistency', async () => {
    await indexedDbPowerTierRepository.save({
      projectId: 'p1',
      systemName: '两阶体系',
      tiers: ['练气', '筑基'],
      specialModifiers: [],
      updatedAt: 100,
    })

    render(<ConsistencyDrawer projectId="p1" currentText="楚凌霄在洞府打坐修持。" />)

    await waitFor(() => {
      expect(screen.getByText('未命中字面候选；完整语义尚未审阅')).toBeInTheDocument()
    })
    expect(screen.getByText('体系: 2 阶')).toBeInTheDocument()
  })

  it('displays critical warning when deceased character acts', async () => {
    // 预存已故角色
    await indexedDbCodexEntityRepository.save({
      id: 'e-dead',
      projectId: 'p1',
      name: '方长老',
      aliases: [],
      category: 'character',
      attributes: { status: 'deceased' },
      relations: [],
      summary: '已阵亡的前代长老',
      createdAt: 100,
      updatedAt: 100,
    })

    const text = '方长老冷笑一声走上前，准备出手。'
    render(<ConsistencyDrawer projectId="p1" currentText={text} />)

    await waitFor(() => {
      expect(screen.getByText(/待核对 1 处候选或登记约束/)).toBeInTheDocument()
      expect(screen.getByText('死者复生矛盾')).toBeInTheDocument()
    })
  })

  it('keeps saved combat warnings separate from current chapter text findings', async () => {
    render(
      <ConsistencyDrawer
        projectId="p-event"
        currentText="甲和乙在议事堂会面。"
        currentChapterNumber={8}
      />,
    )

    await screen.findByText('未套用战力阶梯，越阶倒错无法判定')
    act(() => {
      pluginEventBus.emit('POWER_BREACH_DETECTED', {
        recordId: 'duel-1',
        projectId: 'p-event',
        protagonistName: '甲',
        enemyName: '乙',
        tierDiff: 8,
        riskLevel: 'CRITICAL_COLLAPSE',
        diagnostic: '沙盘记录中的约束冲突',
      })
    })

    expect(await screen.findByText('已存档的沙盘预警（未绑定章节）')).toBeInTheDocument()
    expect(screen.getByText('甲 vs 乙 · 阶差 8')).toBeInTheDocument()
    expect(screen.getByText(/重新打开面板后恢复/)).toBeInTheDocument()
    expect(screen.getByText(/没有章节、段落或修订出处/)).toBeInTheDocument()
    expect(screen.getByText('沙盘记录中的约束冲突')).toBeInTheDocument()
    expect(screen.queryByText(/待核对 1 处候选或登记约束/)).not.toBeInTheDocument()
    expect(screen.queryByText('越阶战力失真')).not.toBeInTheDocument()
  })

  it('restores saved reviewed breaches and refreshes them after duel edits', async () => {
    await indexedDbCombatSandboxRepository.save(
      combatRecord({
        isBreached: true,
        tierDifference: 8,
        riskLevel: 'CRITICAL_COLLAPSE',
        status: 'conflict',
        source: 'author-constraint-review',
        diagnostic: '作者确认射程约束冲突',
        compensatoryFactorsNeeded: [],
        violatedConstraintIds: ['constraint-1'],
      }),
    )
    await indexedDbCombatSandboxRepository.save({
      ...combatRecord({
        isBreached: true,
        tierDifference: 9,
        riskLevel: 'CRITICAL_COLLAPSE',
        diagnostic: '旧启发式冲突尚未复核',
        compensatoryFactorsNeeded: [],
      }),
      id: 'duel-legacy-unreviewed',
    })

    render(<ConsistencyDrawer projectId="p-event" currentText="甲和乙在议事堂会面。" />)

    expect(await screen.findByText('已存档的沙盘预警（未绑定章节）')).toBeInTheDocument()
    expect(screen.getByText('甲 vs 乙 · 阶差 8')).toBeInTheDocument()
    expect(screen.getByText('作者确认射程约束冲突')).toBeInTheDocument()
    expect(screen.queryByText('旧启发式冲突尚未复核')).not.toBeInTheDocument()
    expect(screen.queryByText(/待核对 1 处候选或登记约束/)).not.toBeInTheDocument()

    await act(async () => {
      await indexedDbCombatSandboxRepository.save(
        combatRecord({
          isBreached: false,
          tierDifference: 8,
          riskLevel: 'WARNING',
          status: 'needs-review',
          source: 'author-constraint-review',
          diagnostic: '作者尚未确认冲突',
          compensatoryFactorsNeeded: ['补充约束理由'],
          violatedConstraintIds: [],
        }),
      )
      pluginEventBus.emit('COMBAT_DUEL_SAVED', {
        recordId: 'duel-saved',
        projectId: 'p-event',
      })
    })

    await waitFor(() => {
      expect(screen.queryByText('已存档的沙盘预警（未绑定章节）')).not.toBeInTheDocument()
    })
    expect(screen.queryByText('作者确认射程约束冲突')).not.toBeInTheDocument()
  })

  it('keeps separate duel warnings for the same participants and updates by record ID', async () => {
    render(<ConsistencyDrawer projectId="p-event" currentText="甲和乙在议事堂会面。" />)
    await screen.findByText('未套用战力阶梯，越阶倒错无法判定')

    act(() => {
      pluginEventBus.emit('POWER_BREACH_DETECTED', {
        recordId: 'duel-1',
        projectId: 'p-event',
        protagonistName: '甲',
        enemyName: '乙',
        tierDiff: 8,
        riskLevel: 'CRITICAL_COLLAPSE',
        diagnostic: '第一次对决',
      })
      pluginEventBus.emit('POWER_BREACH_DETECTED', {
        recordId: 'duel-2',
        projectId: 'p-event',
        protagonistName: '甲',
        enemyName: '乙',
        tierDiff: 9,
        riskLevel: 'CRITICAL_COLLAPSE',
        diagnostic: '第二次对决',
      })
      pluginEventBus.emit('POWER_BREACH_DETECTED', {
        recordId: 'duel-1',
        projectId: 'p-event',
        protagonistName: '甲',
        enemyName: '乙',
        tierDiff: 10,
        riskLevel: 'CRITICAL_COLLAPSE',
        diagnostic: '第一次对决更新',
      })
    })

    expect(await screen.findByText('甲 vs 乙 · 阶差 10')).toBeInTheDocument()
    expect(screen.getByText('甲 vs 乙 · 阶差 9')).toBeInTheDocument()
    expect(screen.getByText('第一次对决更新')).toBeInTheDocument()
    expect(screen.getByText('第二次对决')).toBeInTheDocument()
    expect(screen.queryByText('第一次对决')).not.toBeInTheDocument()
    expect(screen.queryByText('甲 vs 乙 · 阶差 8')).not.toBeInTheDocument()
  })
})
