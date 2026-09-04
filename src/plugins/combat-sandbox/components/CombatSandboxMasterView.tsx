import { useState, useEffect, useMemo, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { CombatSandboxEngine } from '../engine/CombatSandboxEngine'
import type { CombatDuelRecord, CombatActionBeat, PowerBreachAlert } from '../types'
import { indexedDbCombatSandboxRepository } from '../../../adapters/indexedDbCombatSandboxRepository'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import {
  Swords,
  ShieldAlert,
  Flame,
  Zap,
  BookmarkCheck,
  Sparkles,
} from 'lucide-react'

export const CombatSandboxMasterView: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const [selectedDuelId, setSelectedDuelId] = useState<string>('')
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null)

  // 对决配置状态
  const [protagonistName, setProtagonistName] = useState('韩立')
  const [protagonistRank, setProtagonistRank] = useState(10) // 筑基初期
  const [enemyName, setEnemyName] = useState('王蝉少主')
  const [enemyRank, setEnemyRank] = useState(20) // 金丹初期
  const [stakes, setStakes] = useState('燕家堡血祭大典夺路逃生')

  // 越级补偿要素
  const [assets, setAssets] = useState<string[]>([
    '天阶辟邪神雷克制魔功',
    '万剑市坊古宝残卷',
  ])
  const [newAssetInput, setNewAssetInput] = useState('')

  // 四段博弈拆招动作列表
  const [beats, setBeats] = useState<CombatActionBeat[]>(() =>
    CombatSandboxEngine.generateFourPhaseTemplate('韩立', '王蝉少主').beats
  )

  const loadData = async () => {
    const all = await indexedDbCombatSandboxRepository.getAll(projectId)
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
    }
  }

  useEffect(() => {
    loadData()
  }, [projectId])

  const breachAudit: PowerBreachAlert = useMemo(() => {
    return CombatSandboxEngine.auditPowerBreach({
      protagonistRank,
      enemyRank,
      compensatoryAssets: assets,
    })
  }, [protagonistRank, enemyRank, assets])

  const handleRegenerateTemplate = () => {
    const tpl = CombatSandboxEngine.generateFourPhaseTemplate(protagonistName, enemyName)
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
    const id = selectedDuelId || idGenerator.generate('duel')
    const record: CombatDuelRecord = {
      id,
      projectId,
      protagonistName,
      protagonistTier:
        CombatSandboxEngine.DEFAULT_TIERS.find((t) => t.rankValue === protagonistRank)?.name ||
        '自定义境界',
      protagonistRankValue: protagonistRank,
      enemyName,
      enemyTier:
        CombatSandboxEngine.DEFAULT_TIERS.find((t) => t.rankValue === enemyRank)?.name ||
        '自定义境界',
      enemyRankValue: enemyRank,
      stakes,
      beats,
      compensatoryAssets: assets,
      breachAudit,
      updatedAt: clock.now(),
    }

    await indexedDbCombatSandboxRepository.save(record)
    setSavedSuccessMsg('对决拆招沙盘已成功保存！')
    setSelectedDuelId(id)
    await loadData()
    setTimeout(() => setSavedSuccessMsg(null), 2500)
  }

  const handleBeatChange = (index: number, field: keyof CombatActionBeat, value: string) => {
    const copy = [...beats]
    copy[index] = { ...copy[index], [field]: value }
    setBeats(copy)
  }

  return (
    <div className="p-6 h-full flex flex-col space-y-4 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 overflow-y-auto">
      {/* 顶部标题与操作栏 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800 gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <Swords className="w-6 h-6 text-amber-500" />
            东方玄幻战力与拆招沙盘 (Combat Sandbox)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            境界天梯压制矩阵、越级代价配平算子与四段博弈微观拆招链，从第一性原理杜绝战力崩塌与报菜名。
          </p>
        </div>

        <div className="flex items-center gap-2">
          {savedSuccessMsg && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {savedSuccessMsg}
            </span>
          )}
          <button
            onClick={handleSaveDuel}
            className="px-3.5 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition flex items-center gap-1.5 shadow-sm"
          >
            <BookmarkCheck className="w-4 h-4" /> 保存对决演武
          </button>
        </div>
      </div>

      {/* 战力崩坏巡检看板 */}
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
            {breachAudit.riskLevel === 'CRITICAL_COLLAPSE'
              ? '严重越级崩坏（差阶过大且无代价）'
              : breachAudit.riskLevel === 'WARNING'
              ? '越级挑战需补充伏笔代价'
              : '战力体系严谨合理'}
          </div>
          <p className="text-xs opacity-90 leading-relaxed">{breachAudit.diagnostic}</p>
        </div>

        {breachAudit.compensatoryFactorsNeeded.length > 0 && (
          <div className="text-xs bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-lg border border-current/20 space-y-1 shrink-0">
            <div className="font-bold">推荐补充的破局要素：</div>
            {breachAudit.compensatoryFactorsNeeded.map((f, i) => (
              <div key={i} className="text-[11px] flex items-center gap-1">
                • {f}
              </div>
            ))}
          </div>
        )}
      </div>

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
                value={protagonistName}
                onChange={(e) => setProtagonistName(e.target.value)}
                className="w-full p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold"
              />
            </div>
            <div>
              <label className="block mb-1 text-slate-500">实力境界梯队：</label>
              <select
                value={protagonistRank}
                onChange={(e) => setProtagonistRank(Number(e.target.value))}
                className="w-full p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold"
              >
                {CombatSandboxEngine.DEFAULT_TIERS.map((t) => (
                  <option key={t.rankValue} value={t.rankValue}>
                    {t.name} (能级 {t.rankValue})
                  </option>
                ))}
              </select>
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
                value={enemyName}
                onChange={(e) => setEnemyName(e.target.value)}
                className="w-full p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold"
              />
            </div>
            <div>
              <label className="block mb-1 text-slate-500">实力境界梯队：</label>
              <select
                value={enemyRank}
                onChange={(e) => setEnemyRank(Number(e.target.value))}
                className="w-full p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold"
              >
                {CombatSandboxEngine.DEFAULT_TIERS.map((t) => (
                  <option key={t.rankValue} value={t.rankValue}>
                    {t.name} (能级 {t.rankValue})
                  </option>
                ))}
              </select>
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

      {/* 四段博弈微观拆招链编辑器 */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
        <div className="flex items-center justify-between border-b pb-2 border-slate-100 dark:border-slate-700">
          <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" />
            四段博弈标准拆招链 (起手试探 $\to$ 变招施压 $\to$ 祭出杀招 $\to$ 底牌掀桌)
          </div>
          <button
            onClick={handleRegenerateTemplate}
            className="text-xs px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition"
          >
            根据角色一键重置模板
          </button>
        </div>

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
                    ? '祭出绝命杀招 (Climax Strike)'
                    : '暗藏底牌掀桌反杀 (Reversal Turn)'}
                </span>
                <span className="text-slate-400 font-medium">发起方: {beat.attacker}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">施展招式/法宝：</label>
                  <input
                    type="text"
                    value={beat.moveName}
                    onChange={(e) => handleBeatChange(idx, 'moveName', e.target.value)}
                    className="w-full p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">博弈细节与走位：</label>
                  <input
                    type="text"
                    value={beat.tacticDescription}
                    onChange={(e) => handleBeatChange(idx, 'tacticDescription', e.target.value)}
                    className="w-full p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-0.5">战局后果/伤害结算：</label>
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
      </div>
    </div>
  )
}
