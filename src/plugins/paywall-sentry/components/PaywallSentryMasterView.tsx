import { useState, useEffect, useMemo, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { PaywallSentryEngine } from '../engine/PaywallSentryEngine'
import type { PaywallAuditResult } from '../types'
import { indexedDbPaywallAuditRepository } from '../../../adapters/indexedDbPaywallAuditRepository'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import { ShieldCheck, Flame, AlertTriangle, Skull, RefreshCw, BookmarkCheck } from 'lucide-react'

export const PaywallSentryMasterView: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const [chapters, setChapters] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterRating, setFilterRating] = useState<string>('all')
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null)

  const refreshChapters = async () => {
    setLoading(true)
    try {
      const allChapters = await indexedDbProjectRepository.getChaptersByProject(projectId)
      allChapters.sort((a, b) => a.order - b.order)
      setChapters(allChapters)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshChapters()
  }, [projectId])

  const auditResults: PaywallAuditResult[] = useMemo(() => {
    return chapters.map((ch) =>
      PaywallSentryEngine.analyzeChapter({
        chapterId: ch.id,
        chapterTitle: ch.title,
        chapterOrder: ch.order,
        content: ch.content || '',
      })
    )
  }, [chapters])

  const filteredResults = useMemo(() => {
    if (filterRating === 'all') return auditResults
    return auditResults.filter((r) => r.recommendation === filterRating)
  }, [auditResults, filterRating])

  const handleSaveToAuditHistory = async (result: PaywallAuditResult) => {
    await indexedDbPaywallAuditRepository.save({
      id: idGenerator.generate('pwa'),
      projectId,
      chapterId: result.chapterId,
      chapterTitle: result.chapterTitle,
      chapterOrder: result.chapterOrder,
      wordCount: result.wordCount,
      ppiScore: result.ppiScore,
      cliffhangerScore: result.cliffhangerScore,
      unresolvedDesireScore: result.unresolvedDesireScore,
      powerClimaxScore: result.powerClimaxScore,
      fatigueRiskScore: result.fatigueRiskScore,
      recommendation: result.recommendation,
      suggestions: result.suggestions,
      updatedAt: clock.now(),
    })
    setSavedSuccessMsg(`已保存第 ${result.chapterOrder} 章付费卡点快照`)
    setTimeout(() => setSavedSuccessMsg(null), 2500)
  }

  const getBadge = (rec: PaywallAuditResult['recommendation']) => {
    switch (rec) {
      case 'prime_paywall':
        return (
          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5" /> 黄金卡点 (首订巅峰)
          </span>
        )
      case 'acceptable':
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> 合格卡点 (平稳承接)
          </span>
        )
      case 'weak_cut':
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> 偏弱卡点
          </span>
        )
      case 'toxic_drop':
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 flex items-center gap-1">
            <Skull className="w-3.5 h-3.5" /> 暴跌流失风险
          </span>
        )
    }
  }

  return (
    <div className="p-6 h-full flex flex-col space-y-4 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 overflow-y-auto">
      <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <Flame className="w-6 h-6 text-amber-500" />
            付费卡点与首订转化哨兵 (Paywall Sentry)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            基于势能指数 PPI 算法，全书章节付费转化潜力与黄金断章点雷达扫描。
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedSuccessMsg && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {savedSuccessMsg}
            </span>
          )}
          <button
            onClick={refreshChapters}
            className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            重新扫描
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-500 dark:text-slate-400">筛选评级：</span>
        {['all', 'prime_paywall', 'acceptable', 'weak_cut', 'toxic_drop'].map((key) => (
          <button
            key={key}
            onClick={() => setFilterRating(key)}
            className={`px-2.5 py-1 rounded-full transition ${
              filterRating === key
                ? 'bg-amber-500 text-white font-medium'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            {key === 'all'
              ? '全部章节'
              : key === 'prime_paywall'
              ? '黄金卡点'
              : key === 'acceptable'
              ? '合格'
              : key === 'weak_cut'
              ? '偏弱'
              : '风险'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">正在分析全书章节付费势能...</div>
      ) : filteredResults.length === 0 ? (
        <div className="text-center py-12 text-slate-400">暂无符合条件的章节分析结果。</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResults.map((r) => (
            <div
              key={r.chapterId}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:border-amber-400 dark:hover:border-amber-500 transition"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-sm line-clamp-1">
                    第 {r.chapterOrder} 章：{r.chapterTitle}
                  </h3>
                  {getBadge(r.recommendation)}
                </div>

                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-2xl font-black text-amber-500">{r.ppiScore}</span>
                  <span className="text-xs text-slate-400">PPI 势能分 / 100</span>
                  <span className="text-xs text-slate-400 ml-auto">{r.wordCount} 字</span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 mb-3 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between">
                    <span>章尾悬念 (C)：</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{r.cliffhangerScore}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>欲望期待 (D)：</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{r.unresolvedDesireScore}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>战力高潮 (P)：</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{r.powerClimaxScore}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>疲劳流失风险 (F)：</span>
                    <span className={`font-medium ${r.fatigueRiskScore > 50 ? 'text-rose-500' : 'text-slate-900 dark:text-slate-100'}`}>
                      {r.fatigueRiskScore}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1 mb-3">
                  {r.suggestions.map((s, idx) => (
                    <p key={idx} className="line-clamp-2">{s}</p>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => handleSaveToAuditHistory(r)}
                  className="px-2.5 py-1 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded flex items-center gap-1 transition"
                >
                  <BookmarkCheck className="w-3.5 h-3.5" />
                  保存卡点快照
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
