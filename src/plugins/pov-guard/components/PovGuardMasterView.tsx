import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { indexedDbPovGuardRepository } from '../../../adapters/indexedDbPovGuardRepository'
import { PovGuardEngine } from '../engine/PovGuardEngine'
import type { PovViolation } from '../types'
import { ShieldAlert, AlertTriangle, EyeOff, Play } from 'lucide-react'
import { clock } from '../../../adapters/clock'
import { Select } from '../../../ui/primitives'
import { ScoreProvenanceBadge } from '../../../ui/atoms'

export const PovGuardMasterView: FC<DesktopPluginViewProps> = ({ projectId, onStats }) => {
  const [currentText, setCurrentText] = useState('')
  const [povChar, setPovChar] = useState('')
  const [povMode, setPovMode] = useState<
    'first_person' | 'third_limited' | 'third_objective' | 'omniscient'
  >('third_limited')
  const [violations, setViolations] = useState<PovViolation[]>([])
  const [isAuditing, setIsAuditing] = useState(false)
  const [hasAudited, setHasAudited] = useState(false)
  const [auditMessage, setAuditMessage] = useState('')

  useEffect(() => {
    onStats?.({
      title: 'POV 心智防火墙',
      wordCount: currentText.length,
      updatedAt: clock.now(),
    })
  }, [currentText, onStats])

  const runAudit = async () => {
    setIsAuditing(true)
    setHasAudited(false)
    setAuditMessage('')
    try {
      const snapshots = await indexedDbPovGuardRepository.getAll(projectId)
      const latestSnapshot = snapshots[0]
      if (!latestSnapshot?.allowedCharacters?.length) {
        setViolations([])
        setAuditMessage('没有保存的角色与秘密配置，无法进行 POV 规则审查。')
        return
      }

      const effectivePovChar = povChar.trim() || latestSnapshot.povCharacterName
      const povIsConfigured = latestSnapshot.allowedCharacters.some(
        (character) =>
          character.characterName === effectivePovChar ||
          character.characterId === effectivePovChar,
      )
      if (!effectivePovChar || !povIsConfigured) {
        setViolations([])
        setAuditMessage('当前 POV 角色不在已保存的角色配置中，无法进行规则审查。')
        return
      }

      setPovChar(effectivePovChar)
      const result = PovGuardEngine.analyze(currentText, {
        povCharacter: effectivePovChar,
        povMode,
        allCharacters: latestSnapshot.allowedCharacters,
        secrets: latestSnapshot.secrets,
      })
      setViolations(result.violations)
      setHasAudited(true)
    } catch {
      setViolations([])
      setAuditMessage('读取 POV 配置失败，未完成审查。')
    } finally {
      setIsAuditing(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto text-slate-800 dark:text-slate-100">
      <div className="flex items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-indigo-500" />
            <span>POV 心智防火墙 (PovGuard)</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            使用角色与秘密配置中的规则检查视角切换和信息泄漏。
          </p>
          <ScoreProvenanceBadge
            source="rule"
            detail="按角色名称与已登记秘密做规则匹配，不代表完整的人工审读"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-slate-500">主视角角色:</span>
            <input
              className="border px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              value={povChar}
              placeholder="填写 POV 角色"
              onChange={(e) => setPovChar(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-slate-500">视角模式:</span>
            <Select size="sm" value={povMode} onValueChange={(v) => setPovMode(v as any)}>
              <option value="third_limited">第三人称受限 (Third Limited)</option>
              <option value="first_person">第一人称 (First Person)</option>
              <option value="third_objective">第三人称客观 (Objective)</option>
              <option value="omniscient">全知视角 (Omniscient)</option>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col space-y-2">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            待审正文:
          </label>
          <textarea
            className="w-full h-96 p-3 text-sm border rounded font-serif resize-none bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
            placeholder="输入章节正文，点击审校执行视角违规与心智越界扫描..."
            value={currentText}
            onChange={(e) => setCurrentText(e.target.value)}
          />
          <button
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-semibold flex items-center justify-center gap-2 transition"
            onClick={runAudit}
            disabled={isAuditing || !currentText.trim()}
          >
            <Play className="w-4 h-4" />
            {isAuditing ? '正在执行心智透视扫描...' : '执行 POV 防火墙审校'}
          </button>
        </div>

        <div className="flex flex-col space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              违规阻断列表:
            </label>
            <span className="text-xs text-slate-500">
              {hasAudited ? `规则命中 ${violations.length} 处` : '尚未完成审查'}
            </span>
          </div>
          <div className="w-full h-96 overflow-y-auto border rounded p-3 space-y-3 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-xs">
            {auditMessage ? (
              <div className="h-full flex items-center justify-center text-amber-700 dark:text-amber-300 text-center">
                {auditMessage}
              </div>
            ) : !hasAudited ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-center">
                输入正文并运行规则审查后显示结果。
              </div>
            ) : violations.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400">
                当前规则未检出问题；请人工复核正文。
              </div>
            ) : (
              violations.map((v) => (
                <div
                  key={v.id}
                  className="p-3 border rounded bg-white dark:bg-slate-800 space-y-1.5 shadow-sm border-amber-300 dark:border-amber-700"
                >
                  <div className="flex items-center justify-between font-bold text-amber-600 dark:text-amber-400">
                    <span className="flex items-center gap-1.5">
                      {v.type === 'head_hopping' ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                      {v.type === 'head_hopping' ? '🚨 视角越界(Head-Hopping)' : '🔒 全知信息泄漏'}
                    </span>
                    <span className="text-slate-400 font-normal">第 {v.paragraphIndex + 1} 段</span>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950/40 p-2 rounded font-mono text-slate-700 dark:text-slate-300">
                    "{v.snippet}"
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">{v.explanation}</p>
                  {v.suggestedFix && (
                    <p className="text-indigo-600 dark:text-indigo-400 font-medium">
                      💡 修复建议: {v.suggestedFix}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
