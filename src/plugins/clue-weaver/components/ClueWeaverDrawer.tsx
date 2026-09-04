import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import type { ClueItem, ClueCognitionRecord, GodViewViolation } from '../types'
import { clueWeaverEngine } from '../engine/ClueWeaverEngine'
import { indexedDbClueWeaverRepository } from '../../../adapters/indexedDbClueWeaverRepository'
import { Network, CheckCircle2, Search } from 'lucide-react'

export const ClueWeaverDrawer: FC<DesktopPluginDrawerProps> = () => {
  const [clues, setClues] = useState<ClueItem[]>([])
  const [cognitions, setCognitions] = useState<ClueCognitionRecord[]>([])
  const [draftText, setDraftText] = useState('')
  const [violations, setViolations] = useState<GodViewViolation[]>([])
  const [hasScanned, setHasScanned] = useState(false)

  const loadData = async () => {
    try {
      const allClues = await indexedDbClueWeaverRepository.getAllClues('')
      const allCogs = await indexedDbClueWeaverRepository.getAllCognitions('')
      setClues(allClues)
      setCognitions(allCogs)
    } catch (e) {
      console.error('Failed to load clue drawer data:', e)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleScanDraft = () => {
    setHasScanned(true)
    const found = clueWeaverEngine.scanGodViewLeakage(draftText, clues, cognitions)
    setViolations(found)
  }

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-panel)] text-[var(--ink-text)] overflow-y-auto p-4 space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-[var(--ink-border)] pb-3">
        <div className="flex items-center gap-1.5 font-semibold">
          <Network className="w-4 h-4 text-blue-500" />
          <span>信息差与全知哨兵</span>
        </div>
        <span className="text-[10px] text-[var(--ink-text-muted)]">
          登记线索: {clues.length}
        </span>
      </div>

      <div className="space-y-2">
        <label className="text-[11px] text-[var(--ink-text-muted)] block">
          粘贴本章对白进行全知泄露快速巡检：
        </label>
        <textarea
          rows={3}
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          placeholder="粘贴对白片段（如：林夕冷笑道：“...”）..."
          className="w-full p-2 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)] resize-none focus:outline-none"
        />
        <button
          onClick={handleScanDraft}
          className="w-full py-1.5 rounded-lg bg-[var(--ink-accent)] text-white font-medium hover:opacity-90 flex items-center justify-center gap-1.5"
        >
          <Search className="w-3.5 h-3.5" />
          巡检天降全知
        </button>
      </div>

      {hasScanned && (
        <div className="space-y-2 pt-2">
          {violations.length === 0 ? (
            <div className="p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-[11px] flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>所言符合各自认知集，无全知泄露。</span>
            </div>
          ) : (
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-rose-500 block">
                发现 {violations.length} 处视角泄露硬伤：
              </span>
              {violations.map((v, i) => (
                <div
                  key={i}
                  className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-400 space-y-0.5"
                >
                  <p className="font-semibold">{v.characterName} 涉密泄漏！</p>
                  <p className="text-[10px] text-[var(--ink-text)]">{v.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 线索清单概览 */}
      <div className="space-y-2 pt-2 border-t border-[var(--ink-border)]">
        <span className="text-[11px] font-semibold text-[var(--ink-text-muted)] block">
          核心线索库 ({clues.length})
        </span>
        {clues.length === 0 ? (
          <p className="text-[11px] text-[var(--ink-text-muted)]">主视口中尚未登记线索。</p>
        ) : (
          <div className="space-y-1">
            {clues.slice(0, 5).map((c) => (
              <div
                key={c.id}
                className="p-1.5 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)]/50 flex items-center justify-between text-[11px]"
              >
                <span className="truncate">{c.title}</span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-blue-500/10 text-blue-400">
                  {c.category}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
