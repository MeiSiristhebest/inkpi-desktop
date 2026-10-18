import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { indexedDbPovGuardRepository } from '../../../adapters/indexedDbPovGuardRepository'
import { PovGuardEngine } from '../engine/PovGuardEngine'
import type { PovAnalysisResult } from '../types'
import { ShieldAlert, AlertTriangle, EyeOff } from 'lucide-react'
import { ScoreProvenanceBadge } from '../../../ui/atoms'
import { pluginEventBus } from '../../../core/pluginEventBus'
import { findPovConfiguration } from '../config'

export const PovGuardDrawer: FC<DesktopPluginDrawerProps> = (props) => (
  <PovGuardProjectDrawer key={props.projectId} {...props} />
)

const PovGuardProjectDrawer: FC<DesktopPluginDrawerProps> = ({ projectId, currentText }) => {
  const [result, setResult] = useState<PovAnalysisResult | null>(null)
  const [notice, setNotice] = useState('等待章节正文。')
  const [configVersion, setConfigVersion] = useState(0)

  useEffect(() => {
    return pluginEventBus.scopedBus(projectId).on('POV_GUARD_CONFIG_SAVED', () => {
      setConfigVersion((version) => version + 1)
    })
  }, [projectId])

  useEffect(() => {
    let disposed = false
    setResult(null)
    if (!currentText || currentText.trim().length === 0) {
      setResult(null)
      setNotice('等待章节正文。')
      return
    }

    const loadAndAudit = async () => {
      const snapshots = await indexedDbPovGuardRepository.getAll(projectId)
      if (disposed) return
      const config = findPovConfiguration(snapshots, projectId)
      if (!config?.allowedCharacters.length) {
        setResult(null)
        setNotice('没有保存的角色与秘密配置，无法进行 POV 规则审查。')
        return
      }
      const povIsConfigured = config.allowedCharacters.some(
        (character) =>
          character.characterName === config.povCharacterName ||
          character.characterId === config.povCharacterName ||
          character.characterId === config.povCharacterId,
      )
      if (!povIsConfigured) {
        setResult(null)
        setNotice('POV 角色不在已保存的角色配置中，无法进行规则审查。')
        return
      }

      const auditRes = PovGuardEngine.analyze(currentText, {
        povCharacter: config.povCharacterName,
        povMode: config.povMode,
        allCharacters: config.allowedCharacters,
        secrets: config.secrets,
      })
      if (!disposed) {
        setResult(auditRes)
        setNotice('')
      }
    }

    loadAndAudit().catch(() => {
      if (!disposed) {
        setResult(null)
        setNotice('读取 POV 配置失败，未完成审查。')
      }
    })
    return () => {
      disposed = true
    }
  }, [projectId, currentText, configVersion])

  return (
    <div className="p-3 space-y-3 text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <span className="font-bold flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
          <ShieldAlert className="w-4 h-4" /> POV 心智防火墙
        </span>
        {result && (
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500">
            {result.povCharacter} ({result.povMode})
          </span>
        )}
      </div>
      <ScoreProvenanceBadge
        source="rule"
        detail="按角色名称与已登记秘密做规则匹配，不代表完整的人工审读"
      />

      {!result ? (
        <div className="p-3 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-center">
          {notice}
        </div>
      ) : !result.headHoppingCount && !result.leakageCount ? (
        <div className="p-3 rounded bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-center">
          当前规则未检出问题；请人工复核正文。
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <div className="text-slate-400 text-[10px]">心理叙述候选</div>
              <div className="text-sm font-bold text-amber-600">{result.headHoppingCount} 处</div>
            </div>
            <div className="p-2 rounded bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
              <div className="text-slate-400 text-[10px]">知情来源待复核</div>
              <div className="text-sm font-bold text-rose-600">{result.leakageCount} 处</div>
            </div>
          </div>

          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {result.violations.map((v) => (
              <div
                key={v.id}
                className="p-2 rounded border bg-white dark:bg-slate-800 border-amber-200 dark:border-amber-900 space-y-1"
              >
                <div className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                  {v.type === 'head_hopping' ? (
                    <AlertTriangle className="w-3 h-3" />
                  ) : (
                    <EyeOff className="w-3 h-3" />
                  )}
                  <span>{v.type === 'head_hopping' ? '心理叙述候选' : '未登记知情来源的词项'}</span>
                </div>
                <div className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                  "{v.snippet}"
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
