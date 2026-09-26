import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { indexedDbScrapbookRepository } from '../../../adapters/indexedDbScrapbookRepository'
import type { ScrapbookFragmentRecord, ScrapRecommendation } from '../types'
import { Archive, Trash2, Search, Copy, Check, Sparkles } from 'lucide-react'
import { clock } from '../../../adapters/clock'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { semanticTextFromContent } from '../../../domain/content'

export const ScrapbookMasterView: FC<DesktopPluginViewProps> = ({ projectId, onStats }) => {
  const host = useOptionalPluginHostContext()
  const [fragments, setFragments] = useState<ScrapbookFragmentRecord[]>([])
  const [filterQuery, setFilterQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const loadData = async () => {
    const all = await indexedDbScrapbookRepository.getAll(projectId)
    setFragments(all.sort((a, b) => b.deletedAt - a.deletedAt))
  }

  useEffect(() => {
    loadData().catch(console.error)
  }, [projectId])

  // §P2.7：AI 语义排序要连同整批废稿正文一起发给模型，属于「付费且慢」的动作，
  // 不能挂在 useEffect([搜索框]) 上——那样每敲一个字符就是一次真实调用。
  // 排序结果连同产生它的查询词与那一批切片一起保存，输入一变结果即失效，
  // 不需要清理 effect，也不会把上一次搜索的排序用在已经换掉的列表上。
  const [aiRun, setAiRun] = useState<{
    query: string
    fragments: ScrapbookFragmentRecord[]
    rankedIds: string[]
  } | null>(null)
  const [aiRunning, setAiRunning] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const runtimeRankedIds =
    aiRun && aiRun.query === filterQuery && aiRun.fragments === fragments ? aiRun.rankedIds : null

  const handleRunAiRanking = async () => {
    const runtimeAssistant = host?.aiAssistant
    if (!filterQuery.trim()) {
      setAiError('先在上方输入关键词，AI 语义排序需要一段查询意图才能工作。')
      return
    }
    if (!runtimeAssistant?.isAvailable || !runtimeAssistant.runPluginTool) {
      setAiError('AI 通道不可用，语义排序没有发出。下方仍是本地关键词匹配结果。')
      return
    }

    setAiRunning(true)
    setAiError(null)
    const fragmentRecords = fragments
    try {
      const result = await runtimeAssistant.runPluginTool('scrapbook-recycler', {
        contextText: semanticTextFromContent('scrapbook-recycler-query', filterQuery),
        fragments: fragmentRecords.map((fragment) => ({
          ...fragment,
          snippet: semanticTextFromContent(
            `scrapbook-recycler-fragment-${fragment.id}`,
            fragment.snippet,
          ),
        })),
        topK: fragmentRecords.length || 1,
      })
      if (!isScrapRecommendations(result)) {
        setAiError('Runtime 返回的内容不是有效的排序结果，列表保持本地匹配顺序。')
        return
      }
      setAiRun({
        query: filterQuery,
        fragments: fragmentRecords,
        rankedIds: result.map((item) => item.fragment.id),
      })
    } catch (cause) {
      setAiError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setAiRunning(false)
    }
  }

  useEffect(() => {
    onStats?.({
      title: '废稿灵感碎纸机',
      wordCount: fragments.reduce((acc, f) => acc + f.wordCount, 0),
      updatedAt: clock.now(),
    })
  }, [fragments, onStats])

  const handleDelete = async (id: string) => {
    await indexedDbScrapbookRepository.delete(id)
    await loadData()
  }

  const handleCopy = (frag: ScrapbookFragmentRecord) => {
    setCopiedId(frag.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const locallyFiltered = fragments.filter(
    (f) =>
      !filterQuery ||
      f.snippet.includes(filterQuery) ||
      f.tags.some((t) => t.includes(filterQuery)) ||
      (f.sourceChapterTitle && f.sourceChapterTitle.includes(filterQuery)),
  )
  const rank = runtimeRankedIds ? new Map(runtimeRankedIds.map((id, index) => [id, index])) : null
  const filtered = rank
    ? [...locallyFiltered].sort(
        (left, right) =>
          (rank.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
          (rank.get(right.id) ?? Number.MAX_SAFE_INTEGER),
      )
    : locallyFiltered

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto text-slate-800 dark:text-slate-100">
      <div className="flex items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Archive className="w-6 h-6 text-indigo-500" />
            <span>废稿灵感碎纸机回收站 (ScrapbookRecycler)</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            自动捕获删改文本碎片，消除删减焦虑，基于 TF-IDF 倒排与余弦相似度在卡文时一键还魂复用
          </p>
        </div>
        <div className="text-xs text-slate-400">
          已安全归档 <span className="font-bold text-indigo-500">{fragments.length}</span>{' '}
          处废稿切片
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:outline-none focus:border-indigo-500"
              placeholder="搜索废稿内容、关键词标签或原所属章节..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
            />
          </div>
          <button
            type="button"
            data-testid="scrapbook-ai-run"
            onClick={handleRunAiRanking}
            disabled={aiRunning}
            className="shrink-0 px-3 py-2 rounded-lg border border-indigo-500/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-xs font-medium transition disabled:opacity-60 flex items-center gap-1.5"
          >
            <Sparkles
              className={`w-3.5 h-3.5 ${aiRunning ? 'animate-pulse' : ''}`}
              aria-hidden="true"
            />
            {aiRunning ? 'AI 语义排序执行中…' : 'AI 语义重排这份结果'}
          </button>
          {runtimeRankedIds && (
            <button
              type="button"
              onClick={() => setAiRun(null)}
              className="shrink-0 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium transition"
            >
              回到本地匹配顺序
            </button>
          )}
        </div>

        <p
          data-testid="scrapbook-result-origin"
          className={`text-xs ${runtimeRankedIds ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}
        >
          {runtimeRankedIds
            ? `排序来源：AI 语义重排（对「${filterQuery}」的本次显式运行）· ${filtered.length} 条命中`
            : `排序来源：本地关键词匹配 · ${filtered.length} 条命中`}
        </p>

        {aiError && (
          <div
            role="alert"
            className="p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-700 dark:text-rose-300"
          >
            {aiError}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="py-12 border rounded-xl text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-900/50">
            暂无符合条件的废稿灵感片段
          </div>
        ) : (
          filtered.map((f) => (
            <div
              key={f.id}
              className="p-4 border rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-2 shadow-sm"
            >
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-medium text-slate-600 dark:text-slate-300">
                  来源: {f.sourceChapterTitle || '未命名章节'} ({f.wordCount} 字)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(f)}
                    className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700"
                  >
                    {copiedId === f.id ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {copiedId === f.id ? '已准备复制' : '提取片段'}
                  </button>
                  <button
                    onClick={() => handleDelete(f.id)}
                    className="text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 font-serif text-xs text-slate-700 dark:text-slate-300 leading-relaxed border border-slate-100 dark:border-slate-800">
                "{f.snippet}"
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {f.tags.map((t, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function isScrapRecommendations(value: unknown): value is ScrapRecommendation[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        'fragment' in item &&
        item.fragment &&
        typeof item.fragment === 'object' &&
        'id' in item.fragment &&
        typeof item.fragment.id === 'string',
    )
  )
}
