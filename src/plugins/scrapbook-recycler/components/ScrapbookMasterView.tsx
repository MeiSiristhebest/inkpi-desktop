import { useState, useEffect, type FC } from "react"
import type { DesktopPluginViewProps } from "../../../types/plugin"
import { indexedDbScrapbookRepository } from "../../../adapters/indexedDbScrapbookRepository"
import type { ScrapbookFragmentRecord } from "../types"
import { Archive, Trash2, Search, Copy, Check } from "lucide-react"
import { clock } from "../../../adapters/clock"

export const ScrapbookMasterView: FC<DesktopPluginViewProps> = ({ projectId, onStats }) => {
  const [fragments, setFragments] = useState<ScrapbookFragmentRecord[]>([])
  const [filterQuery, setFilterQuery] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const loadData = async () => {
    const all = await indexedDbScrapbookRepository.getAll(projectId)
    setFragments(all.sort((a, b) => b.deletedAt - a.deletedAt))
  }

  useEffect(() => {
    loadData().catch(console.error)
  }, [projectId])

  useEffect(() => {
    onStats?.({
      title: "废稿灵感碎纸机",
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

  const filtered = fragments.filter(
    (f) =>
      !filterQuery ||
      f.snippet.includes(filterQuery) ||
      f.tags.some((t) => t.includes(filterQuery)) ||
      (f.sourceChapterTitle && f.sourceChapterTitle.includes(filterQuery))
  )

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
          已安全归档 <span className="font-bold text-indigo-500">{fragments.length}</span> 处废稿切片
        </div>
      </div>

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
                  来源: {f.sourceChapterTitle || "未命名章节"} ({f.wordCount} 字)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(f)}
                    className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700"
                  >
                    {copiedId === f.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedId === f.id ? "已准备复制" : "提取片段"}
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
