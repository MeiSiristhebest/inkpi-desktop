import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import type { SafeGateScanResult, SensitiveWord, RegexRule } from '../types'
import { SafeGateEngine } from '../engine/SafeGateEngine'
import seedWordsRed from '../data/seed-words-red.json'
import seedWordsYellow from '../data/seed-words-yellow.json'
import seedWordsBlue from '../data/seed-words-blue.json'
import regexRules from '../data/regex-rules.json'
import { clipboardWriter } from '../../../adapters/clipboardWriter'
import { ShieldCheck, ShieldAlert, Sparkles, Check } from 'lucide-react'

const ALL_WORDS: SensitiveWord[] = [
  ...(seedWordsRed as SensitiveWord[]),
  ...(seedWordsYellow as SensitiveWord[]),
  ...(seedWordsBlue as SensitiveWord[]),
]

export const SafeGateDrawer: FC<DesktopPluginDrawerProps> = ({ currentText }) => {
  const [engine] = useState(() => {
    const eng = new SafeGateEngine()
    eng.build(ALL_WORDS, regexRules as RegexRule[])
    return eng
  })

  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<SafeGateScanResult>(() =>
    engine.scan(currentText, 'xianxia'),
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      setScanResult(engine.scan(currentText, 'xianxia'))
    }, 300)
    return () => clearTimeout(timer)
  }, [currentText, engine])

  const handleCopy = (text: string) => {
    clipboardWriter.writeText(text).catch((e) => console.warn('Clipboard write failed:', e))
    setCopiedText(text)
    setTimeout(() => setCopiedText(null), 1500)
  }

  return (
    <aside
      className="w-72 h-full flex flex-col bg-[var(--ink-bg-panel)] border-l border-[var(--ink-border)] text-[var(--ink-text)] text-xs"
      data-testid="safe-gate-drawer"
    >
      <div className="p-3 border-b border-[var(--ink-border)] bg-[var(--ink-bg-elevated)]/40 shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-[var(--ink-text)]">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
            <span>实时敏感词审查</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[var(--ink-text-muted)]">
            文学平替
          </span>
        </div>

        {/* 状态徽章条 */}
        <div className="flex items-center justify-between text-[11px] pt-1">
          <span className="text-[var(--ink-text-muted)]">
            违规总数：{scanResult.violations.length}
          </span>
          <div className="flex items-center gap-1.5 font-medium">
            {scanResult.redCount > 0 && (
              <span className="text-rose-500">{scanResult.redCount}红</span>
            )}
            {scanResult.yellowCount > 0 && (
              <span className="text-amber-500">{scanResult.yellowCount}黄</span>
            )}
            {scanResult.blueCount > 0 && (
              <span className="text-blue-400">{scanResult.blueCount}蓝</span>
            )}
            {scanResult.isClean && (
              <span className="text-emerald-500 flex items-center gap-0.5">
                <ShieldCheck className="w-3 h-3" /> 合规
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {scanResult.violations.length === 0 ? (
          <div className="text-center py-12 text-[var(--ink-text-muted)]">
            <ShieldCheck className="w-7 h-7 mx-auto text-emerald-500 mb-2 opacity-80" />
            <p className="font-medium text-emerald-500">当前正文合规无风险</p>
            <p className="text-[10px] text-[var(--ink-text-faint)] mt-1">
              本地词库实时监听中，如出现敏感词将即刻提示文学平替
            </p>
          </div>
        ) : (
          scanResult.violations.map((v) => (
            <div
              key={v.id}
              className={`p-2.5 rounded-lg border ${
                v.level === 'red'
                  ? 'border-rose-500/30 bg-rose-500/5'
                  : v.level === 'yellow'
                    ? 'border-amber-500/30 bg-amber-500/5'
                    : 'border-blue-500/30 bg-blue-500/5'
              } space-y-1.5`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[var(--ink-text)] truncate">
                  命中「{v.matchedText}」
                </span>
                <span
                  className={`text-[9px] px-1 py-0.2 rounded font-medium ${
                    v.level === 'red'
                      ? 'bg-rose-500/15 text-rose-500'
                      : v.level === 'yellow'
                        ? 'bg-amber-500/15 text-amber-500'
                        : 'bg-blue-500/15 text-blue-400'
                  }`}
                >
                  {v.category}
                </span>
              </div>

              <div className="text-[10px] text-[var(--ink-text-muted)]">
                推荐文学平替：
              </div>
              <div className="flex flex-wrap gap-1">
                {v.suggestions.map((sug, i) => (
                  <button
                    key={i}
                    onClick={() => handleCopy(sug.replacement)}
                    className="px-1.5 py-0.5 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] hover:border-[var(--ink-accent)] text-[10px] text-[var(--ink-text)] transition-colors flex items-center gap-1"
                    title="点击复制该平替词"
                  >
                    {copiedText === sug.replacement ? (
                      <Check className="w-2.5 h-2.5 text-emerald-500" />
                    ) : (
                      <Sparkles className="w-2.5 h-2.5 text-[var(--ink-accent)]" />
                    )}
                    <span>{sug.replacement}</span>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
