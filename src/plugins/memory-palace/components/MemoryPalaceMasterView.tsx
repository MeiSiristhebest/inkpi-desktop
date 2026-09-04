import { useState, useEffect, useMemo, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { MemoryPalaceEngine } from '../engine/MemoryPalaceEngine'
import type { EntitySearchResult } from '../types'
import { Sparkles, Search, History, BookmarkCheck, BookOpen } from 'lucide-react'
import { indexedDbMemoryPalaceRepository } from '../../../adapters/indexedDbMemoryPalaceRepository'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'

export const MemoryPalaceMasterView: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const [entities, setEntities] = useState<any[]>([])
  const [chapters, setChapters] = useState<any[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [allEnts, allChs] = await Promise.all([
        indexedDbCodexEntityRepository.getAll(),
        indexedDbProjectRepository.getChaptersByProject(projectId),
      ])
      const projectEnts = (allEnts || []).filter((e) => !e.projectId || e.projectId === projectId)
      setEntities(projectEnts)
      setChapters(allChs || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [projectId])

  const searchResults: EntitySearchResult[] = useMemo(() => {
    return MemoryPalaceEngine.searchEntityOccurrences({
      query,
      entities,
      chapters,
    })
  }, [query, entities, chapters])

  const handleSaveSnapshot = async (res: EntitySearchResult) => {
    await indexedDbMemoryPalaceRepository.save({
      id: idGenerator.generate('mps'),
      projectId,
      entityId: res.entityId,
      entityName: res.entityName,
      category: res.category,
      aliases: [],
      firstAppearedChapterId: res.firstAppearedChapter?.id,
      lastAppearedChapterId: res.lastAppearedChapter?.id,
      totalOccurrences: res.totalOccurrences,
      occurrences: [],
      updatedAt: clock.now(),
    })
    setSavedSuccessMsg(`已建立「${res.entityName}」记忆宫殿持久快照`)
    setTimeout(() => setSavedSuccessMsg(null), 2500)
  }

  return (
    <div className="p-6 h-full flex flex-col space-y-4 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 overflow-y-auto">
      <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <Sparkles className="w-6 h-6 text-indigo-500" />
            记忆宫殿与历史实体快速召回仪 (Memory Palace)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            百万字级跨卷跨章倒排检索，瞬间召回配角首次登场、伏笔道具轨迹与人设前文细节。
          </p>
        </div>
        {savedSuccessMsg && (
          <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
            {savedSuccessMsg}
          </span>
        )}
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="快速搜索人物名、法宝、地名、称号或生僻伏笔..."
          className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">正在构建跨卷记忆倒排索引...</div>
      ) : searchResults.length === 0 ? (
        <div className="text-center py-12 text-slate-400">未找到相关实体的历史登场轨迹。</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {searchResults.map((r) => (
            <div
              key={r.entityId}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:border-indigo-400 dark:hover:border-indigo-500 transition"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-slate-900 dark:text-white">{r.entityName}</span>
                    <span className="px-2 py-0.5 text-[10px] bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300">
                      {r.category}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <History className="w-3 h-3" /> 登场 {r.totalOccurrences} 次
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 mb-3">
                  <div>
                    <span className="text-slate-400 block text-[10px]">首次登场：</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200 line-clamp-1">
                      {r.firstAppearedChapter ? `第 ${r.firstAppearedChapter.order} 章 · ${r.firstAppearedChapter.title}` : '暂无正文提及'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">最近一次登场：</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200 line-clamp-1">
                      {r.lastAppearedChapter ? `第 ${r.lastAppearedChapter.order} 章 · ${r.lastAppearedChapter.title}` : '暂无正文提及'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 mb-3">
                  <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                    <BookOpen className="w-3 h-3" /> 最新正文片段回顾：
                  </div>
                  {r.recentSnippets.length === 0 ? (
                    <div className="text-xs text-slate-400 italic">正文中暂未出现该词或别名</div>
                  ) : (
                    r.recentSnippets.map((snip, idx) => (
                      <div
                        key={idx}
                        className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-800 leading-relaxed font-serif"
                      >
                        {snip}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => handleSaveSnapshot(r)}
                  className="px-2.5 py-1 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded flex items-center gap-1 transition"
                >
                  <BookmarkCheck className="w-3.5 h-3.5" />
                  沉淀至记忆库
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
