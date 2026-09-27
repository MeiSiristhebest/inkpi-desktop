import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { GitCompare } from 'lucide-react'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { IndexedDbProposalStore, ProposalLedger, type AiProposal } from '../../../ai/proposals'
import { reviewStatusLabel } from '../../../ai/proposals/proposalVocabulary'

export const DiffReviewerDrawer: FC<DesktopPluginDrawerProps> = ({ currentText }) => {
  const host = useOptionalPluginHostContext()
  const chapterId = host?.activeChapter?.id
  const [ledger] = useState(() => new ProposalLedger({ store: new IndexedDbProposalStore() }))
  const [proposals, setProposals] = useState<AiProposal[] | null>(null)

  useEffect(() => {
    if (!chapterId) {
      setProposals(null)
      return
    }
    let stale = false
    ledger
      .reload()
      .then(() => {
        if (!stale) setProposals(ledger.list(chapterId))
      })
      .catch(() => {
        if (!stale) setProposals([])
      })
    return () => {
      stale = true
    }
  }, [chapterId, ledger])

  return (
    <div className="p-3 space-y-3 text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <span className="font-bold flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
          <GitCompare className="w-4 h-4" /> 双栏审校随动
        </span>
        {proposals !== null && (
          <span className="text-[10px] text-slate-400">{proposals.length} 条审校写回记录</span>
        )}
      </div>

      <p className="text-[10px] text-slate-400">
        已保存稿 {currentText.trim().length} 字（字数按当前章节已落盘的正文算）
      </p>

      {!chapterId ? (
        <div className="p-3 rounded bg-slate-50 dark:bg-slate-800 text-slate-400 text-center">
          还没有打开章节：双栏审校要有正文才谈得上随动。
        </div>
      ) : proposals === null ? (
        <div className="p-3 rounded bg-slate-50 dark:bg-slate-800 text-slate-400 text-center">
          正在读取本章的提案账本…
        </div>
      ) : proposals.length === 0 ? (
        <div className="p-3 rounded bg-slate-50 dark:bg-slate-800 text-slate-400 leading-relaxed">
          本章还没有审校写回记录。修订稿要在双栏审校面板里粘贴或让 AI
          生成；随动面板只列真实发生过的提案，不会替你造出差异。
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className="text-[10px] text-slate-400 leading-relaxed">
            这里只随动展示已经发生过的写回；要撤销，回到双栏审校面板用「撤销写回」，那里撤的是最近一次。
          </p>
          {proposals.map((proposal, idx) => (
            <div
              key={proposal.id}
              className="p-2 rounded border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2"
            >
              <span className="font-bold text-slate-600 dark:text-slate-300">
                写回 #{idx + 1} · 替换 {proposal.patches.length} 段
              </span>
              <span className="text-[10px] text-indigo-500 shrink-0">
                {reviewStatusLabel(proposal.status)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
