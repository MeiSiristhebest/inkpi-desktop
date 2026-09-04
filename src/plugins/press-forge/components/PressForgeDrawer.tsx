import { useState, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { PressForgeEngine } from '../engine/PressForgeEngine'
import { clipboardWriter } from '../../../adapters/clipboardWriter'
import { Printer, Check, Copy } from 'lucide-react'

export const PressForgeDrawer: FC<DesktopPluginDrawerProps> = ({ currentText }) => {
  const [inputText, setInputText] = useState('')
  const [copied, setCopied] = useState(false)

  const textToFormat = inputText || currentText || ''

  const result = PressForgeEngine.formatText(
    textToFormat,
    PressForgeEngine.PRESETS['qidian-standard'].defaultOptions
  )

  const handleCopy = async () => {
    await clipboardWriter.writeText(result.formattedText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-panel)] text-[var(--ink-text)] overflow-y-auto p-4 space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-[var(--ink-border)] pb-2">
        <span className="font-semibold text-sm flex items-center gap-1.5 text-cyan-500">
          <Printer className="w-4 h-4" /> 标准排版压制
        </span>
        <span className="text-[10px] text-[var(--ink-text-muted)]">
          {currentText ? '正文随动感知' : '手动输入'}
        </span>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] text-[var(--ink-text-muted)] block">
          排版正文片段（留空联动当前章节）：
        </label>
        <textarea
          rows={3}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="粘贴待排版正文，自动全角缩进与清洗不可见字符..."
          className="w-full p-2 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)] resize-none focus:outline-none"
        />
      </div>

      <div className="bg-[var(--ink-bg-elevated)] p-2.5 rounded-lg border border-[var(--ink-border)] space-y-1">
        <div className="flex justify-between">
          <span className="text-[var(--ink-text-muted)]">规整段落数:</span>
          <span className="font-medium">{result.lineCount} 段</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--ink-text-muted)]">有效纯字数:</span>
          <span className="font-medium">{result.characterCount} 字</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--ink-text-muted)]">标点自动校正:</span>
          <span className="font-medium text-emerald-500">{result.fixedPunctuationCount} 处</span>
        </div>
      </div>

      {result.warnings.length > 0 && (
        <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-500 text-[11px] space-y-1">
          {result.warnings.map((w, idx) => (
            <div key={idx}>{w}</div>
          ))}
        </div>
      )}

      <button
        onClick={handleCopy}
        className="w-full py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm transition"
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        {copied ? '已复制标准排版文本！' : '一键复制标准段首缩进正文'}
      </button>

      <div className="text-[11px] text-[var(--ink-text-muted)] leading-relaxed">
        默认套用「起点/标准」预设（段首双全角缩进 + 标点规范化）。如需定制换行空行或各平台规范，请在顶栏开启「排版压制工坊」主视图。
      </div>
    </div>
  )
}
