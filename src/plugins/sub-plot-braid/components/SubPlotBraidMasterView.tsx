import { useState, useEffect, useMemo, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { SubPlotBraidEngine } from '../engine/SubPlotBraidEngine'
import type { SubPlotStrand } from '../types'
import { indexedDbSubPlotRepository } from '../../../adapters/indexedDbSubPlotRepository'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import { GitMerge, Plus, AlertCircle, RefreshCw } from 'lucide-react'

export const SubPlotBraidMasterView: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const [strands, setStrands] = useState<SubPlotStrand[]>([])
  const [maxChapterOrder, setMaxChapterOrder] = useState<number>(1)
  const [loading, setLoading] = useState(true)

  // 新建副线草稿表单
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newSummary, setNewSummary] = useState('')
  const [newCharacters, setNewCharacters] = useState('')
  const [newTags, setNewTags] = useState('')
  const [newStartOrder, setNewStartOrder] = useState(1)

  const loadData = async () => {
    setLoading(true)
    try {
      const [allStrands, allChapters] = await Promise.all([
        indexedDbSubPlotRepository.getAll(projectId),
        indexedDbProjectRepository.getChaptersByProject(projectId),
      ])
      setStrands(allStrands)
      if (allChapters && allChapters.length > 0) {
        const maxOrder = Math.max(...allChapters.map((c) => c.order))
        setMaxChapterOrder(maxOrder)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [projectId])

  const healthMetrics = useMemo(() => {
    return SubPlotBraidEngine.assessStrandHealth({
      strands,
      currentMaxChapterOrder: maxChapterOrder,
    })
  }, [strands, maxChapterOrder])

  const handleCreateStrand = async () => {
    if (!newTitle.trim()) return
    const charList = newCharacters.split(/[,，\s]+/).filter(Boolean)
    const tagList = newTags.split(/[,，\s]+/).filter(Boolean)

    const newStrand: SubPlotStrand = {
      id: idGenerator.generate('sps'),
      projectId,
      title: newTitle.trim(),
      summary: newSummary.trim(),
      status: 'active',
      involvedCharacterIds: [],
      involvedCharacterNames: charList,
      startChapterOrder: Number(newStartOrder),
      lastActiveChapterOrder: Number(newStartOrder),
      tags: tagList,
      updatedAt: clock.now(),
    }

    await indexedDbSubPlotRepository.save(newStrand)
    setShowCreateModal(false)
    setNewTitle('')
    setNewSummary('')
    setNewCharacters('')
    setNewTags('')
    loadData()
  }

  const handleUpdateStatus = async (strand: SubPlotStrand, newStatus: SubPlotStrand['status']) => {
    const updated = {
      ...strand,
      status: newStatus,
      updatedAt: clock.now(),
    }
    await indexedDbSubPlotRepository.save(updated)
    loadData()
  }

  return (
    <div className="p-6 h-full flex flex-col space-y-4 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 overflow-y-auto">
      <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <GitMerge className="w-6 h-6 text-purple-600" />
            多线叙事编织器与副线汇聚罗盘 (Sub-Plot Braid)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            监控宏观多股支线休眠度与掉线饥饿度，确保分卷终局前多线收敛交汇不烂尾。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition flex items-center gap-1 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            开启新支线
          </button>
          <button
            onClick={loadData}
            className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            刷新
          </button>
        </div>
      </div>

      {showCreateModal && (
        <div className="p-4 bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 rounded-xl space-y-3 shadow-sm">
          <div className="font-bold text-sm text-purple-700 dark:text-purple-300">新建副线规划</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-500 mb-1">支线标题：</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="如：密谋刺杀主角的内鬼清查"
                className="w-full p-2 bg-slate-50 dark:bg-slate-900 border rounded"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">开启章节 (Order)：</label>
              <input
                type="number"
                min={1}
                value={newStartOrder}
                onChange={(e) => setNewStartOrder(parseInt(e.target.value) || 1)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-900 border rounded"
              />
            </div>
          </div>
          <div className="text-xs">
            <label className="block text-slate-500 mb-1">副线核心诉求与目标：</label>
            <textarea
              rows={2}
              value={newSummary}
              onChange={(e) => setNewSummary(e.target.value)}
              placeholder="简要概括该支线的发展轨迹与期待结果..."
              className="w-full p-2 bg-slate-50 dark:bg-slate-900 border rounded resize-none"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-500 mb-1">关键参演配角 (逗号分隔)：</label>
              <input
                type="text"
                value={newCharacters}
                onChange={(e) => setNewCharacters(e.target.value)}
                placeholder="如：楚风，白执事，幽冥尊者"
                className="w-full p-2 bg-slate-50 dark:bg-slate-900 border rounded"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">分类标签 (逗号分隔)：</label>
              <input
                type="text"
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
                placeholder="如：悬疑，宗门，夺宝"
                className="w-full p-2 bg-slate-50 dark:bg-slate-900 border rounded"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowCreateModal(false)}
              className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded"
            >
              取消
            </button>
            <button
              onClick={handleCreateStrand}
              className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded font-medium"
            >
              确认编入多线罗盘
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400">正在排查多线编织拓扑...</div>
      ) : strands.length === 0 ? (
        <div className="text-center py-12 text-slate-400">项目中暂未规划多线叙事副线，点击右上角开启新支线。</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {strands.map((s) => {
            const metric = healthMetrics.find((m) => m.strandId === s.id)
            return (
              <div
                key={s.id}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:border-purple-400 dark:hover:border-purple-500 transition"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-bold text-base text-slate-900 dark:text-white line-clamp-1">
                      {s.title}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] rounded font-semibold ${
                        s.status === 'resolved'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : s.status === 'climax'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                      }`}
                    >
                      {s.status === 'resolved' ? '已闭环' : s.status === 'climax' ? '汇聚高潮中' : '推进中'}
                    </span>
                  </div>

                  {metric?.isStarved && (
                    <div className="mb-2 p-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded text-xs text-rose-700 dark:text-rose-300 flex items-center gap-1.5 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-rose-500" />
                      <span>支线严重饥饿：距上次推进已跨越 {metric.dormancyDistance} 章，急需推进防遗忘！</span>
                    </div>
                  )}

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                    {s.summary || '暂无副线详情描述'}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 mb-3">
                    <div>
                      <span className="text-slate-400 block text-[10px]">开启章次：</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        第 {s.startChapterOrder} 章
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">上次推进章次：</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        第 {s.lastActiveChapterOrder} 章
                      </span>
                    </div>
                  </div>

                  {s.involvedCharacterNames.length > 0 && (
                    <div className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                      <span>关涉人物：</span>
                      <div className="flex flex-wrap gap-1">
                        {s.involvedCharacterNames.map((name, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-[10px]">
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">
                    全书当前连载至: 第 {maxChapterOrder} 章
                  </span>
                  <div className="flex items-center gap-1.5">
                    {s.status !== 'resolved' && (
                      <button
                        onClick={() => handleUpdateStatus(s, 'resolved')}
                        className="px-2 py-1 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded transition"
                      >
                        标记已收束
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
