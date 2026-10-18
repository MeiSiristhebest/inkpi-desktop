import { useState, useEffect, useRef, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { indexedDbPovGuardRepository } from '../../../adapters/indexedDbPovGuardRepository'
import { PovGuardEngine } from '../engine/PovGuardEngine'
import type { CharacterKnowledge, PovViolation, SecretItem } from '../types'
import { ShieldAlert, AlertTriangle, EyeOff, Play, Save } from 'lucide-react'
import { clock } from '../../../adapters/clock'
import { Select } from '../../../ui/primitives'
import { ScoreProvenanceBadge } from '../../../ui/atoms'
import { pluginEventBus } from '../../../core/pluginEventBus'
import {
  findPovConfiguration,
  POV_PROJECT_CONFIG_CHAPTER_ID,
  povProjectConfigRecordId,
} from '../config'

const parseUniqueLines = (value: string) => [
  ...new Set(
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  ),
]

const characterRecordId = (name: string) => `pov-character:${name}`
const secretRecordId = (title: string) => `pov-secret:${title}`

export const PovGuardMasterView: FC<DesktopPluginViewProps> = (props) => (
  <PovGuardProjectView key={props.projectId} {...props} />
)

const PovGuardProjectView: FC<DesktopPluginViewProps> = ({ projectId, onStats }) => {
  const [currentText, setCurrentText] = useState('')
  const [povChar, setPovChar] = useState('')
  const [povMode, setPovMode] = useState<
    'first_person' | 'third_limited' | 'third_objective' | 'omniscient'
  >('third_limited')
  const [characterText, setCharacterText] = useState('')
  const [secretText, setSecretText] = useState('')
  const [knownSecretTitlesByCharacter, setKnownSecretTitlesByCharacter] = useState<
    Record<string, string[]>
  >({})
  const [loadedProjectId, setLoadedProjectId] = useState('')
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const [configDirty, setConfigDirty] = useState(false)
  const [configMessage, setConfigMessage] = useState('')
  const [violations, setViolations] = useState<PovViolation[]>([])
  const [isAuditing, setIsAuditing] = useState(false)
  const [hasAudited, setHasAudited] = useState(false)
  const [auditMessage, setAuditMessage] = useState('')
  const auditScope = JSON.stringify([
    currentText,
    povChar,
    povMode,
    characterText,
    secretText,
    knownSecretTitlesByCharacter,
    configDirty,
  ])
  const scopeRef = useRef(auditScope)
  scopeRef.current = auditScope
  useEffect(() => {
    setHasAudited(false)
    setViolations([])
    setAuditMessage('')
  }, [auditScope])

  useEffect(() => {
    onStats?.({
      title: 'POV 心智防火墙',
      wordCount: currentText.length,
      updatedAt: clock.now(),
    })
  }, [currentText, onStats])

  useEffect(() => {
    let disposed = false
    const loadConfig = async () => {
      try {
        const records = await indexedDbPovGuardRepository.getAll(projectId)
        if (disposed) return
        const config = findPovConfiguration(records, projectId)
        if (!config) {
          setCharacterText('')
          setSecretText('')
          setPovChar('')
          setPovMode('third_limited')
          setKnownSecretTitlesByCharacter({})
          setConfigDirty(false)
          setConfigMessage('尚未保存 POV 配置。')
          return
        }

        const secretTitleById = new Map(config.secrets.map((secret) => [secret.id, secret.title]))
        setCharacterText(
          config.allowedCharacters.map((character) => character.characterName).join('\n'),
        )
        setSecretText(config.secrets.map((secret) => secret.title).join('\n'))
        setPovChar(config.povCharacterName)
        setPovMode(config.povMode)
        setKnownSecretTitlesByCharacter(
          Object.fromEntries(
            config.allowedCharacters.map((character) => [
              character.characterName,
              character.knownSecretIds
                .map((secretId) => secretTitleById.get(secretId))
                .filter((title): title is string => Boolean(title)),
            ]),
          ),
        )
        setConfigDirty(false)
        setConfigMessage('已载入保存的 POV 配置。')
      } catch {
        if (!disposed) setConfigMessage('读取 POV 配置失败。')
      } finally {
        if (!disposed) setLoadedProjectId(projectId)
      }
    }

    void loadConfig()
    return () => {
      disposed = true
    }
  }, [projectId])

  const characterNames = parseUniqueLines(characterText)
  const secretTitles = parseUniqueLines(secretText)
  const isConfigLoading = loadedProjectId !== projectId

  const markConfigDirty = () => {
    setConfigDirty(true)
    setConfigMessage('配置有未保存更改。')
  }

  const handleCharacterTextChange = (value: string) => {
    const nextNames = parseUniqueLines(value)
    setCharacterText(value)
    setPovChar((current) =>
      nextNames.includes(current.trim()) ? current.trim() : (nextNames[0] ?? ''),
    )
    markConfigDirty()
  }

  const handleSecretTextChange = (value: string) => {
    const nextTitles = parseUniqueLines(value)
    setSecretText(value)
    setKnownSecretTitlesByCharacter((current) =>
      Object.fromEntries(
        Object.entries(current).map(([character, titles]) => [
          character,
          titles.filter((title) => nextTitles.includes(title)),
        ]),
      ),
    )
    markConfigDirty()
  }

  const toggleKnownSecret = (characterName: string, title: string) => {
    setKnownSecretTitlesByCharacter((current) => {
      const currentTitles = current[characterName] ?? []
      const nextTitles = currentTitles.includes(title)
        ? currentTitles.filter((knownTitle) => knownTitle !== title)
        : [...currentTitles, title]
      return { ...current, [characterName]: nextTitles }
    })
    markConfigDirty()
  }

  const saveConfiguration = async () => {
    const normalizedPovCharacter = povChar.trim()
    if (!characterNames.includes(normalizedPovCharacter)) {
      setConfigMessage('主视角角色必须来自角色名单。')
      return
    }

    const allowedCharacters: CharacterKnowledge[] = characterNames.map((characterName) => ({
      characterId: characterRecordId(characterName),
      characterName,
      knownSecretIds: (knownSecretTitlesByCharacter[characterName] ?? [])
        .filter((title) => secretTitles.includes(title))
        .map(secretRecordId),
    }))
    const secrets: SecretItem[] = secretTitles.map((title) => {
      const id = secretRecordId(title)
      return {
        id,
        title,
        confidentialityLevel: 'secret',
        originChapterOrder: 0,
        holders: allowedCharacters
          .filter((character) => character.knownSecretIds.includes(id))
          .map((character) => character.characterName),
      }
    })

    const record = {
      id: povProjectConfigRecordId(projectId),
      projectId,
      chapterId: POV_PROJECT_CONFIG_CHAPTER_ID,
      chapterOrder: 0,
      povCharacterId: characterRecordId(normalizedPovCharacter),
      povCharacterName: normalizedPovCharacter,
      povMode,
      allowedCharacters,
      secrets,
      headHoppingViolationsCount: 0,
      omniscienceLeaksCount: 0,
      updatedAt: clock.now(),
    }

    setIsSavingConfig(true)
    try {
      await indexedDbPovGuardRepository.save(record)
      pluginEventBus.emit('POV_GUARD_CONFIG_SAVED', { projectId })
      setConfigDirty(false)
      setConfigMessage('POV 配置已保存。')
    } catch {
      setConfigMessage('保存 POV 配置失败。')
    } finally {
      setIsSavingConfig(false)
    }
  }

  const runAudit = async () => {
    const submittedScope = auditScope
    setIsAuditing(true)
    setHasAudited(false)
    setAuditMessage('')
    try {
      const snapshots = await indexedDbPovGuardRepository.getAll(projectId)
      if (scopeRef.current !== submittedScope) return
      if (configDirty) {
        setViolations([])
        setAuditMessage('POV 配置有未保存更改，请先保存后再审查。')
        return
      }

      const config = findPovConfiguration(snapshots, projectId)
      if (!config?.allowedCharacters.length) {
        setViolations([])
        setAuditMessage('没有保存的角色与秘密配置，无法进行 POV 规则审查。')
        return
      }

      const effectivePovChar = config.povCharacterName
      const povIsConfigured = config.allowedCharacters.some(
        (character) =>
          character.characterName === effectivePovChar ||
          character.characterId === effectivePovChar,
      )
      if (!effectivePovChar || !povIsConfigured) {
        setViolations([])
        setAuditMessage('当前 POV 角色不在已保存的角色配置中，无法进行规则审查。')
        return
      }

      const result = PovGuardEngine.analyze(currentText, {
        povCharacter: effectivePovChar,
        povMode: config.povMode,
        allCharacters: config.allowedCharacters,
        secrets: config.secrets,
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
      </div>

      <section
        aria-labelledby="pov-config-heading"
        className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-4"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id="pov-config-heading" className="text-sm font-semibold">
              POV 配置
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              每行填写一个角色或敏感信息。保存后，规则会按这些条目检查正文。
            </p>
          </div>
          <button
            type="button"
            onClick={saveConfiguration}
            disabled={
              isConfigLoading ||
              isSavingConfig ||
              characterNames.length === 0 ||
              !characterNames.includes(povChar.trim())
            }
            className="shrink-0 px-3 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="inline-flex items-center gap-1.5">
              <Save className="w-3.5 h-3.5" />
              {isSavingConfig ? '正在保存…' : '保存 POV 配置'}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            角色名单（每行一个）
            <textarea
              aria-label="角色名单（每行一个）"
              rows={4}
              value={characterText}
              disabled={isConfigLoading || isSavingConfig}
              onChange={(event) => handleCharacterTextChange(event.target.value)}
              className="w-full p-2 rounded border font-normal bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 disabled:opacity-50"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            敏感信息（每行一项）
            <textarea
              aria-label="敏感信息（每行一项）"
              rows={4}
              value={secretText}
              disabled={isConfigLoading || isSavingConfig}
              onChange={(event) => handleSecretTextChange(event.target.value)}
              className="w-full p-2 rounded border font-normal bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 disabled:opacity-50"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              主视角角色
            </span>
            <Select
              label="主视角角色"
              value={povChar}
              disabled={isConfigLoading || isSavingConfig || characterNames.length === 0}
              onValueChange={(value) => {
                setPovChar(value)
                markConfigDirty()
              }}
              placeholder="选择角色"
              options={characterNames.map((name) => ({ value: name, label: name }))}
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              视角模式
            </span>
            <Select
              label="视角模式"
              value={povMode}
              disabled={isConfigLoading || isSavingConfig}
              onValueChange={(value) => {
                setPovMode(value as typeof povMode)
                markConfigDirty()
              }}
              options={[
                { value: 'third_limited', label: '第三人称受限' },
                { value: 'first_person', label: '第一人称' },
                { value: 'third_objective', label: '第三人称客观' },
                { value: 'omniscient', label: '全知视角' },
              ]}
            />
          </div>
        </div>

        {characterNames.length > 0 && secretTitles.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              角色已知信息
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {characterNames.map((characterName) => (
                <fieldset
                  key={characterName}
                  className="rounded border border-slate-200 dark:border-slate-700 p-2 space-y-1"
                >
                  <legend className="px-1 text-xs font-medium">{characterName}</legend>
                  {secretTitles.map((title) => (
                    <label key={title} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        aria-label={`${characterName} 知道：${title}`}
                        checked={(knownSecretTitlesByCharacter[characterName] ?? []).includes(
                          title,
                        )}
                        disabled={isConfigLoading || isSavingConfig}
                        onChange={() => toggleKnownSecret(characterName, title)}
                      />
                      知道：{title}
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>
          </div>
        )}

        <p role="status" aria-live="polite" className="text-xs text-slate-500 dark:text-slate-400">
          {isConfigLoading ? '正在读取保存配置…' : configMessage}
        </p>
      </section>

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
              视角与知情范围待复核候选:
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
                      {v.type === 'head_hopping' ? '心理叙述候选' : '未登记知情来源的词项'}
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
