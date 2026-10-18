import { useState, useEffect, useMemo, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { CombatSandboxEngine } from '../engine/CombatSandboxEngine'
import type {
  CombatDuelRecord,
  CombatActionBeat,
  PowerBreachAlert,
  CombatConstraint,
  CombatResourceBudget,
} from '../types'
import type { CodexEntity } from '../../living-codex/types'
import { indexedDbCombatSandboxRepository } from '../../../adapters/indexedDbCombatSandboxRepository'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'
import { indexedDbPowerTierRepository } from '../../../adapters/indexedDbPowerTierRepository'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { pluginEventBus } from '../../../core/pluginEventBus'
import { usePluginAiTask } from '../../../core/usePluginAiTask'
import { PluginAiTaskPanel } from '../../../components/plugins/PluginAiTaskPanel'
import { semanticTextFromContent } from '../../../domain/content'
import { Swords, ShieldAlert, Flame, Zap, BookmarkCheck, Sparkles, Bot } from 'lucide-react'
import { ScoreProvenanceBadge } from '../../../ui/atoms'
import { Select } from '../../../ui/primitives'

export const CombatSandboxMasterView: FC<DesktopPluginViewProps> = (props) => (
  <CombatSandboxProjectView key={props.projectId} {...props} />
)

const CombatSandboxProjectView: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const hostContext = useOptionalPluginHostContext()
  const [selectedDuelId, setSelectedDuelId] = useState<string>('')
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null)

  // 对决配置状态：一律从空白开始。§P2.4 禁止在作者没配置时替他选一套修真阶梯、
  // 两个代号角色和一副"生死存亡"的赌注，再据此给出战力结论。
  const [powerTiers, setPowerTiers] = useState<string[]>([])
  const [protagonistName, setProtagonistName] = useState('')
  const [protagonistRank, setProtagonistRank] = useState(0)
  const [enemyName, setEnemyName] = useState('')
  const [enemyRank, setEnemyRank] = useState(0)
  const [stakes, setStakes] = useState('')

  // 越级补偿要素
  const [assets, setAssets] = useState<string[]>([])
  const [newAssetInput, setNewAssetInput] = useState('')

  // 四段博弈拆招动作列表
  const [beats, setBeats] = useState<CombatActionBeat[]>([])
  const [constraints, setConstraints] = useState<CombatConstraint[]>([])
  const [newConstraint, setNewConstraint] = useState('')
  const [resourceBudgets, setResourceBudgets] = useState<CombatResourceBudget[]>([])
  const [resourceName, setResourceName] = useState('')
  const [resourceInitial, setResourceInitial] = useState('')
  const [resourceCosts, setResourceCosts] = useState('')
  const [parameters, setParameters] = useState<NonNullable<CombatDuelRecord['parameters']>>({})
  const [characters, setCharacters] = useState<CodexEntity[]>([])
  const [systemRules, setSystemRules] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const aiTask = usePluginAiTask('combat-sandbox', [
    projectId,
    protagonistName,
    enemyName,
    protagonistRank,
    enemyRank,
    stakes,
    assets,
    beats,
    constraints,
    resourceBudgets,
    parameters,
    characters,
    systemRules,
  ])

  const ladder = useMemo(() => CombatSandboxEngine.buildLadder(powerTiers), [powerTiers])
  const duelConfigured =
    ladder.length > 0 &&
    protagonistRank > 0 &&
    enemyRank > 0 &&
    protagonistName.trim().length > 0 &&
    enemyName.trim().length > 0

  const loadData = async () => {
    const [all, allCodex, system] = await Promise.all([
      indexedDbCombatSandboxRepository.getAll(projectId),
      indexedDbCodexEntityRepository.getAll(),
      indexedDbPowerTierRepository.get(projectId),
    ])

    setPowerTiers(system?.tiers ?? [])
    setSystemRules(system?.specialModifiers ?? [])
    setCharacters(
      allCodex.filter(
        (entity) => entity.projectId === projectId && entity.category === 'character',
      ),
    )

    const chars = allCodex
      .filter((e) => e.projectId === projectId && e.category === 'character')
      .map((e) => e.name)

    // 只借用作者自己建档的角色名，不替他生成拆招正文
    if (chars.length >= 2 && !protagonistName && !enemyName) {
      setProtagonistName(chars[0])
      setEnemyName(chars[1])
    }

    if (all.length > 0 && !selectedDuelId) {
      const first = all[0]
      setSelectedDuelId(first.id)
      setProtagonistName(first.protagonistName)
      setProtagonistRank(first.protagonistRankValue)
      setEnemyName(first.enemyName)
      setEnemyRank(first.enemyRankValue)
      setStakes(first.stakes)
      setAssets(first.compensatoryAssets)
      setBeats(first.beats)
      setConstraints(first.constraints ?? [])
      setResourceBudgets(first.resourceBudgets ?? [])
      setParameters(first.parameters ?? {})
    }
  }

  useEffect(() => {
    void loadData().catch(() => setSavedSuccessMsg('读取对决或设定失败。'))
  }, [projectId])

  // AI 战斗拆招与越级绝杀推演
  const handleAiCombatRecommend = async () => {
    // 没配置就不发这次昂贵调用：发出去的话题里只有空名字和 0 号序位，模型只能瞎编
    if (!duelConfigured) return
    const analysisInput = {
      ...CombatSandboxEngine.buildAnalysisInput({
        protagonistName,
        enemyName,
        ...parameters,
        constraints,
        beats,
      }),
      authorCharacterRecords: characters.filter((character) =>
        [protagonistName, enemyName].includes(character.name),
      ),
      declaredLadder: powerTiers,
      declaredExceptions: systemRules,
      resourceBudgets,
      protagonist: {
        name: semanticTextFromContent('combat-sandbox-protagonist', protagonistName),
        rank: protagonistRank,
      },
      enemy: { name: semanticTextFromContent('combat-sandbox-enemy', enemyName), rank: enemyRank },
      stakes: semanticTextFromContent('combat-sandbox-stakes', stakes),
      compensatingAssets: assets.map((asset, index) =>
        semanticTextFromContent(`combat-sandbox-asset-${index}`, asset),
      ),
    }

    await aiTask.run(analysisInput)
  }

  const breachAudit: PowerBreachAlert | null = useMemo(() => {
    if (!duelConfigured) return null
    try {
      return CombatSandboxEngine.auditPowerBreach({
        protagonistRank,
        enemyRank,
        compensatoryAssets: assets,
        constraints,
        resourceBudgets,
      })
    } catch (error) {
      return {
        isBreached: false,
        tierDifference: 0,
        riskLevel: 'WARNING',
        status: 'needs-review',
        diagnostic: error instanceof Error ? error.message : '约束参数无效。',
        compensatoryFactorsNeeded: [],
      }
    }
  }, [duelConfigured, protagonistRank, enemyRank, assets, constraints, resourceBudgets])

  const handleRegenerateTemplate = () => {
    if (!protagonistName.trim() || !enemyName.trim()) return
    const tpl = CombatSandboxEngine.generateFourPhaseTemplate(protagonistName, enemyName, {
      ...parameters,
      terrain: parameters.battlefieldTerrain,
    })
    setBeats(tpl.beats)
  }

  const handleAddAsset = () => {
    if (!newAssetInput.trim()) return
    setAssets([...assets, newAssetInput.trim()])
    setNewAssetInput('')
  }

  const handleRemoveAsset = (index: number) => {
    setAssets(assets.filter((_, i) => i !== index))
  }

  const handleSaveDuel = async () => {
    if (!duelConfigured || !breachAudit) return
    const id = selectedDuelId || idGenerator.generate('duel')
    const tierName = (rank: number) =>
      ladder.find((t) => t.rankValue === rank)?.name ?? '自定义序位'
    const record: CombatDuelRecord = {
      id,
      projectId,
      protagonistName,
      protagonistTier: tierName(protagonistRank),
      protagonistRankValue: protagonistRank,
      enemyName,
      enemyTier: tierName(enemyRank),
      enemyRankValue: enemyRank,
      stakes,
      beats,
      compensatoryAssets: assets,
      constraints,
      resourceBudgets,
      parameters,
      breachAudit,
      updatedAt: clock.now(),
    }

    setIsSaving(true)
    try {
      await indexedDbCombatSandboxRepository.save(record)
      // 越级事实只有在对决被存档后才成立，事件也在这里发（P2.12：事实由权威写入路径发布）
      CombatSandboxEngine.publishBreachAlert({
        recordId: id,
        projectId,
        protagonistName,
        enemyName,
        alert: breachAudit,
      })
      pluginEventBus.emit('COMBAT_DUEL_SAVED', { recordId: id, projectId })
      setSavedSuccessMsg('对决拆招沙盘已成功保存！')
      setSelectedDuelId(id)
    } catch {
      setSavedSuccessMsg('保存对决失败，可以重试。')
    } finally {
      setIsSaving(false)
    }
  }

  const handleBeatChange = (index: number, field: keyof CombatActionBeat, value: string) => {
    const copy = [...beats]
    copy[index] = { ...copy[index], [field]: value }
    setBeats(copy)
  }

  const addResourceBudget = () => {
    if (!resourceInitial.trim() || !resourceCosts.trim()) {
      setSavedSuccessMsg('请填写资源初始量与每步消耗。')
      return
    }
    const budget = {
      name: resourceName.trim(),
      initial: Number(resourceInitial),
      consumptionByBeat: resourceCosts
        .trim()
        .split(/[,，\s]+/)
        .map(Number),
    }
    try {
      CombatSandboxEngine.auditResourceBudget(budget)
    } catch (error) {
      setSavedSuccessMsg(error instanceof Error ? error.message : '资源参数无效。')
      return
    }
    if (resourceBudgets.some((resource) => resource.name === budget.name)) {
      setSavedSuccessMsg('资源名称重复，请先删除原条目。')
      return
    }
    setResourceBudgets([...resourceBudgets, budget])
    setResourceName('')
    setResourceInitial('')
    setResourceCosts('')
  }

  return (
    <div className="p-6 h-full flex flex-col space-y-4 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 overflow-y-auto">
      {/* 顶部标题与操作栏 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800 gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <Swords className="w-6 h-6 text-amber-500" />
            战力与拆招沙盘 (Combat Sandbox)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            对照作者的能力、适用条件、资源消耗与战术后果规划对决。阶梯序位不表示物理能量或胜率。
          </p>
          <ScoreProvenanceBadge
            source="rule"
            detail="展示资源余额计算和作者逐项复核；模型推演仍需作者确认"
          />
        </div>

        <div className="flex items-center gap-2">
          {savedSuccessMsg && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {savedSuccessMsg}
            </span>
          )}
          {hostContext?.aiAssistant?.isAvailable && (
            <button
              disabled={aiTask.isRunning || !duelConfigured}
              title={duelConfigured ? undefined : '先配置战力阶梯并填好对阵双方'}
              onClick={handleAiCombatRecommend}
              className="px-3.5 py-1.5 text-xs font-semibold bg-[var(--ink-accent)] text-white rounded-lg transition flex items-center gap-1.5 shadow-sm cursor-pointer hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Bot className="w-4 h-4" /> AI 约束与战术复核
            </button>
          )}
          <PluginAiTaskPanel view={aiTask.view} onRetry={aiTask.retry} />
          <button
            onClick={handleSaveDuel}
            disabled={!duelConfigured || isSaving}
            className="px-3.5 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <BookmarkCheck className="w-4 h-4" /> 保存对决演武
          </button>
        </div>
      </div>

      {/* 战力崩坏巡检看板：没配置就没有结论，包括"看起来没问题"这个结论 */}
      {!duelConfigured || !breachAudit ? (
        <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          {ladder.length === 0
            ? '本书还没有战力阶梯。先去「战力阶梯与设定巡检哨兵」定义或套用流派预设，这里才有阶梯可算。'
            : '填写对阵双方的名字、各自阶梯与底牌后，才会给出越级代价结论。'}
        </div>
      ) : (
        <div
          className={`p-4 rounded-xl border transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            breachAudit.riskLevel === 'CRITICAL_COLLAPSE'
              ? 'bg-rose-50/50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-900 text-rose-800 dark:text-rose-200'
              : breachAudit.riskLevel === 'WARNING'
                ? 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-900 text-amber-800 dark:text-amber-200'
                : 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200'
          }`}
        >
          <div className="space-y-1">
            <div className="font-bold text-sm flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" />
              战力巡检状态：
              {breachAudit.status === 'conflict'
                ? '已列约束存在冲突'
                : breachAudit.status === 'consistent-with-declared-rules'
                  ? '作者已复核所列约束'
                  : '证据不足，待复核'}
            </div>
            <p className="text-xs opacity-90 leading-relaxed">{breachAudit.diagnostic}</p>
          </div>

          {breachAudit.compensatoryFactorsNeeded.length > 0 && (
            <div className="text-xs bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-lg border border-current/20 space-y-1 shrink-0">
              <div className="font-bold">待复核条件：</div>
              {breachAudit.compensatoryFactorsNeeded.map((f, i) => (
                <div key={i} className="text-[11px] flex items-center gap-1">
                  • {f}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 对抗双方基础参数设置 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 主角参数 */}
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
          <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5 text-blue-500">
            <Zap className="w-4 h-4" /> 主角阵营登场参数
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block mb-1 text-slate-500">角色名：</label>
              <input
                type="text"
                aria-label="主角名"
                value={protagonistName}
                onChange={(e) => setProtagonistName(e.target.value)}
                className="w-full p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold"
              />
            </div>
            <div>
              <label className="block mb-1 text-slate-500">实力阶梯：</label>
              <Select
                aria-label="主角实力阶梯"
                value={protagonistRank}
                onValueChange={(v) => setProtagonistRank(Number(v))}
                className="w-full"
              >
                <option value={0}>（选择阶梯位置）</option>
                {ladder.map((t) => (
                  <option key={t.rankValue} value={t.rankValue}>
                    {t.name}（序位 {t.rankValue}）
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* 越级补偿要素卡池 */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-700 text-xs">
            <div className="font-semibold text-slate-500">主角持有的破局反杀底牌 (补偿因子)：</div>
            <div className="flex flex-wrap gap-1.5">
              {assets.map((asset, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800 text-[11px] flex items-center gap-1"
                >
                  {asset}
                  <button
                    onClick={() => handleRemoveAsset(idx)}
                    className="hover:text-red-500 transition"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2 mt-1.5">
              <input
                type="text"
                value={newAssetInput}
                onChange={(e) => setNewAssetInput(e.target.value)}
                placeholder="例如：万年灵乳秒回灵力、天劫残余雷珠"
                className="flex-1 p-1.5 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
              />
              <button
                onClick={handleAddAsset}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium"
              >
                添加底牌
              </button>
            </div>
          </div>
        </div>

        {/* 敌方参数 */}
        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
          <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5 text-rose-500">
            <Flame className="w-4 h-4" /> 强敌/反派登场参数
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block mb-1 text-slate-500">对手名：</label>
              <input
                type="text"
                aria-label="对手名"
                value={enemyName}
                onChange={(e) => setEnemyName(e.target.value)}
                className="w-full p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold"
              />
            </div>
            <div>
              <label className="block mb-1 text-slate-500">实力阶梯：</label>
              <Select
                aria-label="对手实力阶梯"
                value={enemyRank}
                onValueChange={(v) => setEnemyRank(Number(v))}
                className="w-full"
              >
                <option value={0}>（选择阶梯位置）</option>
                {ladder.map((t) => (
                  <option key={t.rankValue} value={t.rankValue}>
                    {t.name}（序位 {t.rankValue}）
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-700 text-xs space-y-1">
            <label className="block text-slate-500">决战赌注 / 生死危局：</label>
            <input
              type="text"
              value={stakes}
              onChange={(e) => setStakes(e.target.value)}
              className="w-full p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              placeholder="例如：胜则夺取上古灵脉，败则宗门覆灭神魂俱灭"
            />
          </div>
        </div>
      </div>

      <section aria-label="战术前提与约束" className="p-4 border rounded space-y-3 text-xs">
        <h3 className="font-semibold">能力、环境与目标</h3>
        {(
          ['protagonistTechnique', 'enemyTechnique', 'battlefieldTerrain', 'plotGoal'] as const
        ).map((field) => (
          <label key={field} className="block">
            {
              {
                protagonistTechnique: '甲方能力及限制',
                enemyTechnique: '乙方能力及限制',
                battlefieldTerrain: '环境、距离与可用掩护',
                plotGoal: '作者希望的结果与代价',
              }[field]
            }
            <textarea
              aria-label={field}
              value={parameters[field] ?? ''}
              onChange={(event) =>
                setParameters((current) => ({ ...current, [field]: event.target.value }))
              }
              className="w-full rounded border p-2 bg-transparent"
            />
          </label>
        ))}
        <h3 className="font-semibold">逐项条件复核</h3>
        <p>填写弹药、射程、耗时、反制、准备条件等约束；状态与理由由作者确认，未确认项保持未知。</p>
        <div className="flex gap-2">
          <input
            aria-label="新增战术约束"
            value={newConstraint}
            onChange={(event) => setNewConstraint(event.target.value)}
            className="flex-1 rounded border p-2 bg-transparent"
          />
          <button
            onClick={() => {
              if (!newConstraint.trim()) return
              setConstraints([
                ...constraints,
                {
                  id: idGenerator.generate('combat-constraint'),
                  description: newConstraint.trim(),
                  status: 'unknown',
                  rationale: '',
                },
              ])
              setNewConstraint('')
            }}
          >
            添加约束
          </button>
        </div>
        {constraints.map((constraint, index) => (
          <div key={constraint.id} className="flex flex-wrap gap-2 items-center">
            <span>{constraint.description}</span>
            <Select
              label={`约束 ${index + 1} 状态`}
              value={constraint.status}
              options={[
                { value: 'unknown', label: '未知' },
                { value: 'satisfied', label: '作者确认满足' },
                { value: 'violated', label: '作者确认不满足' },
              ]}
              onValueChange={(value) =>
                setConstraints((current) =>
                  current.map((item) =>
                    item.id === constraint.id
                      ? { ...item, status: value as CombatConstraint['status'] }
                      : item,
                  ),
                )
              }
            />
            <input
              aria-label={`约束 ${index + 1} 理由`}
              placeholder="原文、设定或逐步计算理由"
              value={constraint.rationale}
              onChange={(event) =>
                setConstraints((current) =>
                  current.map((item) =>
                    item.id === constraint.id ? { ...item, rationale: event.target.value } : item,
                  ),
                )
              }
              className="flex-1 rounded border p-2 bg-transparent"
            />
            <button
              aria-label={`删除约束 ${index + 1}`}
              onClick={() =>
                setConstraints(constraints.filter((item) => item.id !== constraint.id))
              }
            >
              删除
            </button>
          </div>
        ))}
        <h3 className="font-semibold">资源余额检查</h3>
        <p>每项使用相同单位；逐步余额 = 初始量 − 已发生消耗。未填写的资源和补充事件不参与计算。</p>
        <div className="flex flex-wrap gap-2">
          <input
            aria-label="资源名称"
            placeholder="如：弹药（发）"
            value={resourceName}
            onChange={(event) => setResourceName(event.target.value)}
            className="rounded border p-2 bg-transparent"
          />
          <input
            aria-label="资源初始量"
            type="number"
            min={0}
            step="any"
            value={resourceInitial}
            onChange={(event) => setResourceInitial(event.target.value)}
            className="w-24 rounded border p-2 bg-transparent"
          />
          <input
            aria-label="资源每步消耗"
            placeholder="用逗号分隔每步消耗"
            value={resourceCosts}
            onChange={(event) => setResourceCosts(event.target.value)}
            className="rounded border p-2 bg-transparent"
          />
          <button onClick={addResourceBudget}>添加资源计算</button>
        </div>
        {resourceBudgets.map((budget, index) => {
          let balanceText = '参数无效，无法计算'
          try {
            balanceText = CombatSandboxEngine.auditResourceBudget(budget)
              .balances.map((balance) => `第 ${balance.beatIndex + 1} 步剩余 ${balance.remaining}`)
              .join('；')
          } catch {
            /* The persisted values remain available for author repair. */
          }
          return (
            <div key={budget.name} className="border rounded p-2">
              <p>
                {budget.name}，初始 {budget.initial}：{balanceText}
              </p>
              <button
                aria-label={`删除资源 ${index + 1}`}
                onClick={() =>
                  setResourceBudgets(resourceBudgets.filter((_, itemIndex) => itemIndex !== index))
                }
              >
                删除
              </button>
            </div>
          )
        })}
      </section>
      {/* 四段博弈微观拆招链编辑器 */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
        <div className="flex items-center justify-between border-b pb-2 border-slate-100 dark:border-slate-700">
          <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" />
            战术步骤计划 (信息 → 应对 → 关键选择 → 结果)
          </div>
          <button
            onClick={handleRegenerateTemplate}
            disabled={!protagonistName.trim() || !enemyName.trim()}
            className="text-xs px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            按双方名字重置四段模板
          </button>
        </div>

        {beats.length === 0 ? (
          <div className="p-6 text-center rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-400">
            还没有拆招链。填好双方名字后点上面的重置，模板里的招式名与战场会留〔待填〕槽位，
            由你决定这一战到底用什么打。
          </div>
        ) : (
          <div className="space-y-3">
            {beats.map((beat, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    第 {idx + 1} 阶段：
                    {beat.phase === 'probing'
                      ? '起手试探 (Probing)'
                      : beat.phase === 'escalation'
                        ? '变招施压 (Escalation)'
                        : beat.phase === 'climax_strike'
                          ? '关键选择与代价'
                          : '结果与后续'}
                  </span>
                  <span className="text-slate-400 font-medium">发起方: {beat.attacker}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-0.5">
                      施展招式/法宝：
                    </label>
                    <input
                      type="text"
                      value={beat.moveName}
                      onChange={(e) => handleBeatChange(idx, 'moveName', e.target.value)}
                      className="w-full p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-0.5">
                      博弈细节与走位：
                    </label>
                    <input
                      type="text"
                      value={beat.tacticDescription}
                      onChange={(e) => handleBeatChange(idx, 'tacticDescription', e.target.value)}
                      className="w-full p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-0.5">
                      战局后果/伤害结算：
                    </label>
                    <input
                      type="text"
                      value={beat.damageOrConsequence}
                      onChange={(e) => handleBeatChange(idx, 'damageOrConsequence', e.target.value)}
                      className="w-full p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
