import { matchesSerializedResult } from '../../../domain/serializedResult'
import { chapterSaveEvents } from '../../../ports/chapterSaveEvents'
import { redactPluginValue } from '../../../core/pluginDataRedaction'
import { useState, useEffect, useRef, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { PressForgeEngine } from '../engine/PressForgeEngine'
import type { PressFormatOptions, TypesetResult } from '../types'
import { Printer, Download, Settings, Copy, Check, Sparkles } from 'lucide-react'
import { indexedDbPressConfigRepository } from '../../../adapters/indexedDbPressConfigRepository'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { clipboardWriter } from '../../../adapters/clipboardWriter'
import { blobFileDownloader } from '../../../adapters/blobFileDownloader'
import { clock } from '../../../adapters/clock'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { semanticTextFromContent } from '../../../domain/content'
import { Select } from '../../../ui/primitives'

export const PressForgeMasterView: FC<DesktopPluginViewProps> = (props) => (
  <PressForgeSession key={props.projectId} {...props} />
)
const PressForgeSession: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const host = useOptionalPluginHostContext()
  const [storageError, setStorageError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [chapters, setChapters] = useState<any[]>([])
  const [selectedChapterId, setSelectedChapterId] = useState<string>('')
  const [options, setOptions] = useState<PressFormatOptions>(
    PressForgeEngine.PRESETS['qidian-standard'].defaultOptions,
  )
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    let stale = false
    const loadInit = async () => {
      setLoading(true)
      try {
        const [chs, savedConfig, volumes] = await Promise.all([
          indexedDbProjectRepository.getChaptersByProject(projectId),
          indexedDbPressConfigRepository.get(projectId),
          indexedDbProjectRepository.getVolumesByProject?.(projectId) ?? Promise.resolve([]),
        ])
        if (stale) return
        const order = new Map(volumes.map((v) => [v.id, v.order]))
        chs.sort(
          (a, b) =>
            (order.get(a.volumeId) ?? Infinity) - (order.get(b.volumeId) ?? Infinity) ||
            a.order - b.order,
        )
        setChapters(chs)
        if (chs.length > 0) {
          setSelectedChapterId(chs[0].id)
        }
        if (savedConfig) {
          setOptions({
            presetId: savedConfig.activePresetId,
            indentSpaces: savedConfig.customIndent,
            paragraphSpacing: savedConfig.customParagraphSpacing,
            dialogueStyle: savedConfig.customDialogueStyle,
            fixPunctuation: savedConfig.enablePunctuationFix,
            checkSensitiveWords: savedConfig.enableSensitiveFilter,
            literalWords: savedConfig.literalWords ?? [],
          })
        }
      } catch (cause) {
        if (!stale) setStorageError(String(cause))
      } finally {
        if (!stale) setLoading(false)
      }
    }
    void loadInit()
    return () => {
      stale = true
    }
  }, [projectId, attempt])
  useEffect(
    () =>
      chapterSaveEvents.subscribe(({ chapter }) => {
        if (chapter.projectId === projectId)
          setChapters((current) => current.map((c) => (c.id === chapter.id ? chapter : c)))
      }),
    [projectId],
  )

  const currentChapter = chapters.find((c) => c.id === selectedChapterId)
  const currentChapterText = currentChapter
    ? semanticTextFromContent(
        currentChapter.id,
        currentChapter.content || '',
        currentChapter.revision,
      )
    : ''

  let localFormattedResult: TypesetResult
  let layoutError: string | null = null
  try {
    localFormattedResult = PressForgeEngine.formatText(currentChapterText, options)
  } catch (cause) {
    localFormattedResult = {
      formattedText: '',
      lineCount: 0,
      characterCount: 0,
      warnings: [],
      fixedPunctuationCount: 0,
    }
    layoutError = String(cause)
  }
  const identity = JSON.stringify([
    projectId,
    currentChapter?.id,
    currentChapter?.revision,
    currentChapterText,
    options,
  ])
  const identityRef = useRef<string | null>(identity)
  identityRef.current = identity
  useEffect(
    () => () => {
      identityRef.current = null
    },
    [],
  )

  // §P2.7：Runtime 排版核对是「付费且慢」的动作，不能由 useEffect(正文) 代发。
  // 结果连同产生它的那一份输入一起保存，所以换章节或改预设时无需清理 effect：
  // 旧结果对不上当前输入，预览自然回到本地引擎，而不是继续显示上一份正文的「压制成果」。
  const [aiRun, setAiRun] = useState<{
    identity: string
    text: string
    options: PressFormatOptions
    result: TypesetResult
  } | null>(null)
  const [aiRunning, setAiRunning] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const aiFormattedResult =
    aiRun &&
    aiRun.identity === identity &&
    aiRun.text === currentChapterText &&
    aiRun.options === options
      ? aiRun.result
      : null
  const formattedResult = aiFormattedResult ?? localFormattedResult

  const handleRunAiTypeset = async () => {
    const runtimeAssistant = host?.aiAssistant
    if (!runtimeAssistant?.isAvailable || !runtimeAssistant.runPluginTool) {
      setAiError('Runtime 未连接，当前使用本地排版结果。')
      return
    }

    const requestIdentity = identity
    setAiRunning(true)
    setAiError(null)
    try {
      const result = await runtimeAssistant.runPluginTool('press-forge', {
        rawContent: currentChapterText,
        options,
      })
      if (identityRef.current !== requestIdentity) return
      if (
        !isTypesetResult(result) ||
        !matchesSerializedResult(result, redactPluginValue(localFormattedResult))
      ) {
        setAiError('Runtime 返回的内容不是排版结果，预览保持为本地实时排版。')
        return
      }
      setAiRun({ identity: requestIdentity, text: currentChapterText, options, result })
    } catch (cause) {
      setAiError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setAiRunning(false)
    }
  }

  const handleApplyPreset = (presetId: keyof typeof PressForgeEngine.PRESETS) => {
    const preset = PressForgeEngine.PRESETS[presetId]
    if (preset) {
      setOptions(preset.defaultOptions)
    }
  }

  const handleSaveDefault = async () => {
    try {
      await indexedDbPressConfigRepository.save({
        projectId,
        activePresetId: options.presetId,
        customIndent: options.indentSpaces,
        customParagraphSpacing: options.paragraphSpacing,
        customDialogueStyle: options.dialogueStyle,
        enablePunctuationFix: options.fixPunctuation,
        enableSensitiveFilter: options.checkSensitiveWords,
        literalWords: options.literalWords,
        updatedAt: clock.now(),
      })
      setSavedSuccessMsg('已保存当前排版规范为项目默认预设')
      setStorageError(null)
    } catch (cause) {
      setStorageError(String(cause))
    }
  }

  const handleCopy = async () => {
    try {
      if (layoutError) throw new Error(layoutError)
      await clipboardWriter.writeText(formattedResult.formattedText)
      setCopied(true)
    } catch (cause) {
      setCopied(false)
      setStorageError('复制失败：' + String(cause))
    }
  }

  const handleDownloadTxt = () => {
    const blob = new Blob([formattedResult.formattedText], { type: 'text/plain;charset=utf-8' })
    const filename =
      (currentChapter?.title ?? '导出章节').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 120) +
      '.txt'
    try {
      if (layoutError) throw new Error(layoutError)
      blobFileDownloader.downloadBlob(filename, blob)
    } catch (cause) {
      setStorageError(String(cause))
    }
  }

  return (
    <div className="p-6 h-full flex flex-col space-y-4 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 overflow-y-auto">
      <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <Printer className="w-6 h-6 text-cyan-600" />
            排版压制与多平台发布工坊 (Press Forge)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            按所选缩进、空行和标点格式导出文本；关键词匹配不能代表平台规则或审核结果。
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedSuccessMsg && (
            <span className="text-xs text-cyan-600 dark:text-cyan-400 font-medium">
              {savedSuccessMsg}
            </span>
          )}
          <button
            onClick={handleSaveDefault}
            className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition flex items-center gap-1"
          >
            <Settings className="w-3.5 h-3.5" />
            保存为默认规范
          </button>
        </div>
      </div>

      {(storageError || layoutError) && (
        <p role="alert">
          {storageError || layoutError}
          <button
            onClick={() => {
              setStorageError(null)
              setAttempt((n) => n + 1)
            }}
          >
            重新读取
          </button>
        </p>
      )}
      {loading ? (
        <div className="text-center py-12 text-slate-400">正在加载章节与排版引擎...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1">
          {/* 左侧控制区 */}
          <div className="space-y-4 lg:col-span-1 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                选择排版章节
              </label>
              <Select
                aria-label="排版章节"
                value={selectedChapterId}
                onValueChange={(v) => setSelectedChapterId(v)}
                className="w-full"
                size="sm"
              >
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                目标发布平台预设
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(PressForgeEngine.PRESETS).map(([key, p]) => (
                  <button
                    key={key}
                    onClick={() => handleApplyPreset(key as any)}
                    className={`p-2 text-left rounded-lg border text-xs transition ${
                      options.presetId === key
                        ? 'border-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
                    }`}
                  >
                    <div className="font-medium">{p.name}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs">
              <div className="flex items-center justify-between">
                <span>段首全角缩进：</span>
                <input
                  type="number"
                  min={0}
                  max={4}
                  value={options.indentSpaces}
                  onChange={(e) =>
                    setOptions({
                      ...options,
                      indentSpaces: Math.min(
                        4,
                        Math.max(0, Math.floor(Number(e.target.value) || 0)),
                      ),
                    })
                  }
                  className="w-14 p-1 bg-slate-50 dark:bg-slate-900 border rounded text-center"
                />
              </div>

              <div className="flex items-center justify-between">
                <span>段落间距（空行）：</span>
                <input
                  type="number"
                  min={0}
                  max={3}
                  value={options.paragraphSpacing}
                  onChange={(e) =>
                    setOptions({
                      ...options,
                      paragraphSpacing: Math.min(
                        3,
                        Math.max(0, Math.floor(Number(e.target.value) || 0)),
                      ),
                    })
                  }
                  className="w-14 p-1 bg-slate-50 dark:bg-slate-900 border rounded text-center"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={options.fixPunctuation}
                  onChange={(e) => setOptions({ ...options, fixPunctuation: e.target.checked })}
                  className="rounded text-cyan-600"
                />
                <span>自动正规化全角中文章法标点</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.checkSensitiveWords}
                  onChange={(e) =>
                    setOptions({ ...options, checkSensitiveWords: e.target.checked })
                  }
                  className="rounded text-cyan-600"
                />
                <span>匹配作者关键词清单</span>
              </label>
            </div>

            <textarea
              aria-label="作者关键词清单"
              placeholder="每行一个关键词"
              value={(options.literalWords ?? []).join('\n')}
              onChange={(e) =>
                setOptions({ ...options, literalWords: e.target.value.split('\n').filter(Boolean) })
              }
            />
            <label>
              对话引号格式
              <select
                value={options.dialogueStyle}
                onChange={(e) =>
                  setOptions({
                    ...options,
                    dialogueStyle: e.target.value as PressFormatOptions['dialogueStyle'],
                  })
                }
              >
                <option value="standard-quotes">保留现有引号</option>
                <option value="bracket">中文直角引号</option>
                <option value="dash">独立对白破折号</option>
              </select>
            </label>
            <div className="pt-2 space-y-2">
              <button
                onClick={handleCopy}
                className="w-full py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? '已复制压制成果！' : '一键复制格式化文本'}
              </button>

              <button
                onClick={handleDownloadTxt}
                className="w-full py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-650 text-slate-700 dark:text-slate-200 font-medium rounded-lg text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Download className="w-4 h-4" />
                导出规整化 .TXT
              </button>
            </div>
          </div>

          {/* 右侧预览区 */}
          <div className="lg:col-span-3 flex flex-col space-y-3 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-start justify-between gap-3 border-b pb-2 border-slate-100 dark:border-slate-700 text-xs">
              <div>
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  压制排版预览（{formattedResult.lineCount} 段 · {formattedResult.characterCount}{' '}
                  字）
                </span>
                <p
                  data-testid="press-forge-result-origin"
                  className={`mt-0.5 ${aiFormattedResult ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}`}
                >
                  {aiFormattedResult
                    ? '来源：AI 深度排版（本次显式运行，未写入正文）'
                    : '来源：本地排版引擎（随正文与规范实时计算）'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {formattedResult.warnings.length > 0 && (
                  <span className="text-rose-500 font-medium">
                    {formattedResult.warnings.length} 条关键词匹配
                  </span>
                )}
                <button
                  type="button"
                  data-testid="press-forge-ai-run"
                  onClick={handleRunAiTypeset}
                  disabled={aiRunning}
                  className="px-2.5 py-1 rounded-lg border border-cyan-500/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/30 font-medium transition disabled:opacity-60 flex items-center gap-1"
                >
                  <Sparkles
                    className={`w-3.5 h-3.5 ${aiRunning ? 'animate-pulse' : ''}`}
                    aria-hidden="true"
                  />
                  {aiRunning ? 'AI 深度排版执行中…' : 'AI 深度排版'}
                </button>
                {aiFormattedResult && (
                  <button
                    type="button"
                    onClick={() => setAiRun(null)}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium transition"
                  >
                    回到本地排版
                  </button>
                )}
              </div>
            </div>

            {aiError && (
              <div
                role="alert"
                className="p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-700 dark:text-rose-300"
              >
                {aiError}
              </div>
            )}

            {formattedResult.warnings.length > 0 && (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-700 dark:text-rose-300 space-y-1">
                {formattedResult.warnings.map((w, idx) => (
                  <div key={idx}>{w}</div>
                ))}
              </div>
            )}

            <textarea
              aria-label="排版预览文本"
              readOnly
              value={formattedResult.formattedText}
              className="w-full flex-1 min-h-[420px] p-4 text-sm font-serif leading-relaxed bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg resize-none focus:outline-none"
            />
          </div>
        </div>
      )}
    </div>
  )
}

function isTypesetResult(value: unknown): value is TypesetResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const result = value as Partial<TypesetResult>
  return (
    typeof result.formattedText === 'string' &&
    typeof result.lineCount === 'number' &&
    typeof result.characterCount === 'number' &&
    typeof result.fixedPunctuationCount === 'number' &&
    Array.isArray(result.warnings) &&
    result.warnings.every((warning) => typeof warning === 'string')
  )
}
