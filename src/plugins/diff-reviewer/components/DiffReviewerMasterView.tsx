import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { DiffReviewerEngine } from '../engine/DiffReviewerEngine'
import type { ReviewHunkView, HunkResolution } from '../types'
import { GitCompare, Check, X, Layers, Save } from 'lucide-react'
import { clock } from '../../../adapters/clock'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'

export const DiffReviewerMasterView: FC<DesktopPluginViewProps> = ({ onStats }) => {
  const host = useOptionalPluginHostContext()
  const initialSource =
    host?.activeChapter?.content ||
    '风雨如晦，夜幕笼罩着古老残破的城池。\n远处传来急促而沉重的脚步声。'
  const [sourceText, setSourceText] = useState(initialSource)
  const [proposedText, setProposedText] = useState(
    '骤雨如瀑，阴冷夜幕笼罩着风雨飘摇的废弃古城。\n寂静长街深处传来急促而沉重的破空脚步声。',
  )
  const [hunks, setHunks] = useState<ReviewHunkView[]>([])
  const [mergedResult, setMergedResult] = useState('')

  useEffect(() => {
    onStats?.({
      title: '双栏审校与合稿器',
      wordCount: mergedResult.length || sourceText.length,
      updatedAt: clock.now(),
    })
  }, [mergedResult, sourceText, onStats])

  const handleCompute = () => {
    const diff = DiffReviewerEngine.computeDiff(sourceText, proposedText)
    setHunks(diff.hunks)
    setMergedResult(sourceText)
  }

  const setHunkResolution = (hunkId: string, resolution: HunkResolution) => {
    const nextHunks = hunks.map((h) => (h.id === hunkId ? { ...h, resolution } : h))
    setHunks(nextHunks)
    const merged = DiffReviewerEngine.applyHunks(sourceText, nextHunks)
    setMergedResult(merged)
  }

  const applyAll = () => {
    const nextHunks = hunks.map((h) => ({ ...h, resolution: 'applied' as HunkResolution }))
    setHunks(nextHunks)
    setMergedResult(DiffReviewerEngine.applyHunks(sourceText, nextHunks))
  }

  const rejectAll = () => {
    const nextHunks = hunks.map((h) => ({ ...h, resolution: 'rejected' as HunkResolution }))
    setHunks(nextHunks)
    setMergedResult(DiffReviewerEngine.applyHunks(sourceText, nextHunks))
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto text-slate-800 dark:text-slate-100">
      <div className="flex items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <GitCompare className="w-6 h-6 text-indigo-500" />
            <span>双栏 Plan/Apply 审校与合并器 (DiffReviewer)</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            基于 Myers SES 最短编辑算法与行内字词级对齐，实现多源修订的分块采纳与原子合稿
          </p>
        </div>
        <div className="flex items-center gap-2">
          {host?.activeChapter && (
            <button
              onClick={async () => {
                const targetText = mergedResult || sourceText
                if (host.activeChapter) {
                  await host.mutateActiveChapter({
                    chapterId: host.activeChapter.id,
                    expectedRevision: host.revision,
                    type: 'full_replace',
                    content: targetText,
                  })
                }
              }}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold flex items-center gap-1 transition shadow-sm"
              title="将合稿结果通过 CAS 乐观锁直接写回当前正文章节"
            >
              <Save className="w-3.5 h-3.5" /> 写回正文章节 (CAS)
            </button>
          )}
          <button
            onClick={applyAll}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold flex items-center gap-1 transition"
          >
            <Check className="w-3.5 h-3.5" /> 全部采纳
          </button>
          <button
            onClick={rejectAll}
            className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded text-xs font-semibold flex items-center gap-1 transition"
          >
            <X className="w-3.5 h-3.5" /> 全部拒绝
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            原稿文本 (Original):
          </label>
          <textarea
            className="w-full h-40 p-3 text-xs border rounded font-serif bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 leading-relaxed"
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            AI / 审校修订提案 (Proposed):
          </label>
          <textarea
            className="w-full h-40 p-3 text-xs border rounded font-serif bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 leading-relaxed"
            value={proposedText}
            onChange={(e) => setProposedText(e.target.value)}
          />
        </div>
      </div>

      <div className="text-center">
        <button
          onClick={handleCompute}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-semibold shadow flex items-center gap-2 mx-auto transition"
        >
          <Layers className="w-4 h-4" /> 计算差异分块 (Compute Diff Hunks)
        </button>
      </div>

      {hunks.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">
            差异决策分块 ({hunks.length} 个 Hunk)
          </h3>
          {hunks.map((hunk, idx) => (
            <div
              key={hunk.id}
              className="border rounded-lg p-3 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-500">
                  Hunk #{idx + 1} (L{hunk.oldStartLine} ➔ L{hunk.newStartLine})
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-bold ${
                      hunk.resolution === 'applied'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                        : hunk.resolution === 'rejected'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                    }`}
                  >
                    {hunk.resolution.toUpperCase()}
                  </span>
                  <button
                    onClick={() => setHunkResolution(hunk.id, 'applied')}
                    className="px-2 py-1 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700 transition"
                  >
                    采纳
                  </button>
                  <button
                    onClick={() => setHunkResolution(hunk.id, 'rejected')}
                    className="px-2 py-1 bg-rose-600 text-white rounded text-xs hover:bg-rose-700 transition"
                  >
                    放弃
                  </button>
                </div>
              </div>

              <div className="font-mono text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2.5 overflow-x-auto space-y-1">
                {hunk.lineChanges.map((lc, lIdx) => (
                  <div
                    key={lIdx}
                    className={`flex items-start px-2 py-0.5 rounded ${
                      lc.type === 'added'
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                        : lc.type === 'removed'
                          ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300'
                          : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span className="w-6 font-bold select-none text-slate-400">
                      {lc.type === 'added' ? '+' : lc.type === 'removed' ? '-' : ' '}
                    </span>
                    <span className="flex-1">
                      {lc.wordTokens
                        ? lc.wordTokens.map((token, tIdx) => (
                            <span
                              key={tIdx}
                              className={
                                token.type === 'added'
                                  ? 'bg-emerald-200 dark:bg-emerald-800/60 font-bold'
                                  : token.type === 'removed'
                                    ? 'bg-rose-200 dark:bg-rose-800/60 line-through'
                                    : ''
                              }
                            >
                              {token.value}
                            </span>
                          ))
                        : lc.content}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-bold text-slate-500">
              根据当前决策实时渲染的终稿合卷预览:
            </label>
            <div className="w-full min-h-24 p-3 text-xs border rounded bg-slate-100 dark:bg-slate-950 font-serif whitespace-pre-wrap border-slate-300 dark:border-slate-800">
              {mergedResult}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
