import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { PressForgeEngine } from '../engine/PressForgeEngine'
import type { PressFormatOptions } from '../types'
import { Printer, Download, Settings, Copy, Check } from 'lucide-react'
import { indexedDbPressConfigRepository } from '../../../adapters/indexedDbPressConfigRepository'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { clipboardWriter } from '../../../adapters/clipboardWriter'
import { blobFileDownloader } from '../../../adapters/blobFileDownloader'
import { clock } from '../../../adapters/clock'

export const PressForgeMasterView: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const [chapters, setChapters] = useState<any[]>([])
  const [selectedChapterId, setSelectedChapterId] = useState<string>('')
  const [options, setOptions] = useState<PressFormatOptions>(
    PressForgeEngine.PRESETS['qidian-standard'].defaultOptions
  )
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    const loadInit = async () => {
      setLoading(true)
      try {
        const [chs, savedConfig] = await Promise.all([
          indexedDbProjectRepository.getChaptersByProject(projectId),
          indexedDbPressConfigRepository.get(projectId),
        ])
        chs.sort((a, b) => a.order - b.order)
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
          })
        }
      } finally {
        setLoading(false)
      }
    }
    loadInit()
  }, [projectId])

  const currentChapter = chapters.find((c) => c.id === selectedChapterId)

  const formattedResult = PressForgeEngine.formatText(
    currentChapter?.content || '',
    options
  )

  const handleApplyPreset = (presetId: keyof typeof PressForgeEngine.PRESETS) => {
    const preset = PressForgeEngine.PRESETS[presetId]
    if (preset) {
      setOptions(preset.defaultOptions)
    }
  }

  const handleSaveDefault = async () => {
    await indexedDbPressConfigRepository.save({
      projectId,
      activePresetId: options.presetId,
      customIndent: options.indentSpaces,
      customParagraphSpacing: options.paragraphSpacing,
      customDialogueStyle: options.dialogueStyle,
      enablePunctuationFix: options.fixPunctuation,
      enableSensitiveFilter: options.checkSensitiveWords,
      updatedAt: clock.now(),
    })
    setSavedSuccessMsg('已保存当前排版规范为项目默认预设')
    setTimeout(() => setSavedSuccessMsg(null), 2500)
  }

  const handleCopy = async () => {
    await clipboardWriter.writeText(formattedResult.formattedText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadTxt = () => {
    const blob = new Blob([formattedResult.formattedText], { type: 'text/plain;charset=utf-8' })
    const filename = `${currentChapter ? `第${currentChapter.order}章_${currentChapter.title}` : '导出章节'}.txt`
    blobFileDownloader.downloadBlob(filename, blob)
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
            工业级规整化 AST 格式转换引擎，支持起点、晋江、番茄等平台规范一键正规化与敏感词拦截。
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
              <select
                value={selectedChapterId}
                onChange={(e) => setSelectedChapterId(e.target.value)}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    第 {c.order} 章：{c.title}
                  </option>
                ))}
              </select>
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
                  onChange={(e) => setOptions({ ...options, indentSpaces: parseInt(e.target.value) || 0 })}
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
                  onChange={(e) => setOptions({ ...options, paragraphSpacing: parseInt(e.target.value) || 0 })}
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
                  onChange={(e) => setOptions({ ...options, checkSensitiveWords: e.target.checked })}
                  className="rounded text-cyan-600"
                />
                <span>开启平台违禁敏感词智能排查</span>
              </label>
            </div>

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
            <div className="flex items-center justify-between border-b pb-2 border-slate-100 dark:border-slate-700 text-xs">
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                压制排版预览（{formattedResult.lineCount} 段 · {formattedResult.characterCount} 字）
              </span>
              {formattedResult.warnings.length > 0 && (
                <span className="text-rose-500 font-medium">
                  {formattedResult.warnings.length} 条敏感词预警
                </span>
              )}
            </div>

            {formattedResult.warnings.length > 0 && (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-700 dark:text-rose-300 space-y-1">
                {formattedResult.warnings.map((w, idx) => (
                  <div key={idx}>{w}</div>
                ))}
              </div>
            )}

            <textarea
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
