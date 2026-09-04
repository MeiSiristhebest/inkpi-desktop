import { useState, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { dialogueDistillerEngine } from '../engine/DialogueDistillerEngine'
import { Mic, Search, Users } from 'lucide-react'

export const DialogueDistillerDrawer: FC<DesktopPluginDrawerProps> = ({ projectId, currentText }) => {
  const [inputText, setInputText] = useState('')
  const [charactersInput, setCharactersInput] = useState('陆沉, 林夕, 王铁柱')
  const [result, setResult] = useState<Array<{ name: string; quoteCount: number; asl: number; tone: string }> | null>(null)

  const textToScan = inputText || currentText || ''

  const handleScan = () => {
    const names = charactersInput
      .split(/[,，、\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)

    const quotesMap = dialogueDistillerEngine.extractCharacterQuotes(textToScan, names)
    const list: Array<{ name: string; quoteCount: number; asl: number; tone: string }> = []

    for (const name of names) {
      const q = quotesMap[name] || []
      if (q.length > 0) {
        const vp = dialogueDistillerEngine.computeVoiceprint(name, q, projectId)
        list.push({
          name,
          quoteCount: q.length,
          asl: vp.averageSentenceLength,
          tone: vp.toneStyle,
        })
      }
    }

    setResult(list)
  }

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-panel)] text-[var(--ink-text)] overflow-y-auto p-4 space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-[var(--ink-border)] pb-3">
        <div className="flex items-center gap-1.5 font-semibold">
          <Mic className="w-4 h-4 text-pink-500" />
          <span>角色对白声纹哨兵</span>
        </div>
        <span className="text-[10px] text-[var(--ink-text-muted)]">
          {currentText ? '正文随动' : '手动分析'}
        </span>
      </div>

      <div className="space-y-2">
        <label className="text-[11px] text-[var(--ink-text-muted)] block">
          目标角色列表（逗号分隔）：
        </label>
        <input
          type="text"
          value={charactersInput}
          onChange={(e) => setCharactersInput(e.target.value)}
          className="w-full px-2 py-1.5 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)]"
        />

        <label className="text-[11px] text-[var(--ink-text-muted)] block pt-1">
          待测台词段落（留空则自动读取正文）：
        </label>
        <textarea
          rows={3}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="如：陆沉冷笑道：“...” 林夕淡淡道：“...”"
          className="w-full p-2 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)] resize-none focus:outline-none"
        />

        <button
          onClick={handleScan}
          className="w-full py-1.5 rounded-lg bg-[var(--ink-accent)] text-white font-medium hover:opacity-90 flex items-center justify-center gap-1.5"
        >
          <Search className="w-3.5 h-3.5" />
          测算当前段落角色声纹
        </button>
      </div>

      {result !== null && (
        <div className="space-y-2 pt-2 border-t border-[var(--ink-border)]">
          <span className="text-[11px] font-semibold text-[var(--ink-text-muted)] block">
            抓取台词解析结果：
          </span>
          {result.length === 0 ? (
            <div className="p-3 rounded bg-[var(--ink-bg-canvas)] text-[11px] text-[var(--ink-text-muted)] text-center">
              未在文本中匹配到指定角色的说话引语。
            </div>
          ) : (
            <div className="space-y-1.5">
              {result.map((r) => (
                <div
                  key={r.name}
                  className="p-2 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)]/60 text-[11px] flex items-center justify-between"
                >
                  <div className="flex items-center gap-1 font-semibold text-[var(--ink-text)]">
                    <Users className="w-3.5 h-3.5 text-pink-500" />
                    <span>{r.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-[var(--ink-text-muted)]">
                    <span>{r.quoteCount} 句</span>
                    <span>均长 {r.asl} 字</span>
                    <span className="px-1.5 py-0.2 rounded bg-pink-500/10 text-pink-400">
                      {r.tone}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
