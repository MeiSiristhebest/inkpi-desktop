import { useState, useEffect, useMemo, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { ChekhovRadarEngine } from '../engine/ChekhovRadarEngine'
import type { ChekhovGunRecord, GunStatus } from '../../../ports/chekhovGunRepository'
import { indexedDbChekhovGunRepository } from '../../../adapters/indexedDbChekhovGunRepository'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import {
  Crosshair,
  Flame,
  Clock,
  AlertTriangle,
  Plus,
  Trash2,
  Sparkles,
  CheckCircle2,
} from 'lucide-react'

export const ChekhovRadarMasterView: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const [guns, setGuns] = useState<ChekhovGunRecord[]>([])
  const [maxChapterOrder, setMaxChapterOrder] = useState<number>(1)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isCreating, setIsCreating] = useState(false)

  // 表单状态
  const [formName, setFormName] = useState('')
  const [formCategory, setFormCategory] = useState<ChekhovGunRecord['category']>('item')
  const [formPlantOrder, setFormPlantOrder] = useState<number>(1)
  const [formSnippet, setFormSnippet] = useState('')
  const [formNotes, setFormNotes] = useState('')

  const loadData = async () => {
    const [allGuns, allChapters] = await Promise.all([
      indexedDbChekhovGunRepository.getAll(projectId),
      indexedDbProjectRepository.getChaptersByProject(projectId),
    ])

    const maxOrder = allChapters.length > 0 ? Math.max(...allChapters.map((c) => c.order)) : 1
    setMaxChapterOrder(maxOrder)

    // 更新锈蚀距离与预警
    const updatedGuns = allGuns.map((g) => {
      const dist = Math.max(0, maxOrder - g.plantChapterOrder)
      return {
        ...g,
        rustingDistance: dist,
        isRustingAlert: dist >= ChekhovRadarEngine.RUSTING_THRESHOLD && g.status !== 'fired' && g.status !== 'abandoned',
      }
    })

    setGuns(updatedGuns)
  }

  useEffect(() => {
    loadData()
  }, [projectId])

  const stats = useMemo(() => {
    return ChekhovRadarEngine.computeStats(guns, maxChapterOrder)
  }, [guns, maxChapterOrder])

  const filteredGuns = useMemo(() => {
    if (statusFilter === 'all') return guns
    if (statusFilter === 'rusting') return guns.filter((g) => g.isRustingAlert)
    return guns.filter((g) => g.status === statusFilter)
  }, [guns, statusFilter])

  const handleCreateGun = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) return

    const dist = Math.max(0, maxChapterOrder - formPlantOrder)
    const newRecord: ChekhovGunRecord = {
      id: idGenerator.generate('gun'),
      projectId,
      gunName: formName.trim(),
      category: formCategory,
      status: 'dormant',
      plantChapterOrder: Number(formPlantOrder),
      plantSnippet: formSnippet.trim() || '埋下关键线索',
      notes: formNotes.trim(),
      rustingDistance: dist,
      isRustingAlert: dist >= ChekhovRadarEngine.RUSTING_THRESHOLD,
      updatedAt: clock.now(),
    }

    await indexedDbChekhovGunRepository.save(newRecord)
    setIsCreating(false)
    setFormName('')
    setFormSnippet('')
    setFormNotes('')
    await loadData()
  }

  const handleUpdateStatus = async (gun: ChekhovGunRecord, newStatus: GunStatus) => {
    const updated: ChekhovGunRecord = {
      ...gun,
      status: newStatus,
      actualFiredChapterOrder: newStatus === 'fired' ? maxChapterOrder : gun.actualFiredChapterOrder,
      updatedAt: clock.now(),
    }
    await indexedDbChekhovGunRepository.save(updated)
    await loadData()
  }

  const handleDelete = async (id: string) => {
    await indexedDbChekhovGunRepository.delete(id)
    await loadData()
  }

  return (
    <div className="p-6 h-full flex flex-col space-y-4 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 overflow-y-auto">
      {/* 顶部标题与健康度仪表 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800 gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <Crosshair className="w-6 h-6 text-rose-500" />
            契诃夫之枪与全景伏笔闭合雷达 (Chekhov Radar)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            第一幕挂在墙上的枪，第三幕必须响。防止百万字长篇因伏笔遗忘、死锁锈蚀而烂尾。
          </p>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="px-3.5 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition flex items-center gap-1.5 shadow-sm self-start md:self-auto"
        >
          <Plus className="w-4 h-4" /> 埋下一柄新枪 (伏笔)
        </button>
      </div>

      {/* 核心宏观指标卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-400">总伏笔数</div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            {stats.totalGuns}
          </div>
        </div>
        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-400">已引爆回收 (响枪)</div>
          <div className="text-xl font-bold text-emerald-500 mt-1">
            {stats.firedCount}
          </div>
        </div>
        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-400">正在孵化/休眠中</div>
          <div className="text-xl font-bold text-blue-500 mt-1">
            {stats.dormantCount + stats.incubatingCount}
          </div>
        </div>
        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-400 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            严重锈蚀未引爆
          </div>
          <div className="text-xl font-bold text-amber-500 mt-1">
            {stats.rustingCount}
          </div>
        </div>
        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-400">伏笔闭环率</div>
          <div className="text-xl font-bold text-rose-500 mt-1">
            {stats.closureRate}%
          </div>
        </div>
      </div>

      {/* 新建伏笔模态窗/内嵌表单 */}
      {isCreating && (
        <form
          onSubmit={handleCreateGun}
          className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-rose-200 dark:border-rose-900/60 shadow-sm space-y-3"
        >
          <div className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-rose-500" />
            在剧情中挂上一柄新“契诃夫之枪”
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block mb-1 font-medium text-slate-700 dark:text-slate-300">
                伏笔名称/核心物件：
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="例如：生锈的断剑、神秘青铜古镜"
                className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block mb-1 font-medium text-slate-700 dark:text-slate-300">
                伏笔分类：
              </label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as ChekhovGunRecord['category'])}
                className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                <option value="item">道具/神兵/信物</option>
                <option value="secret">身世/隐秘/真相</option>
                <option value="promise">誓言/约定/誓死之战</option>
                <option value="character">隐藏人物/大能化身</option>
                <option value="technique">未练成底牌/禁术</option>
              </select>
            </div>
            <div>
              <label className="block mb-1 font-medium text-slate-700 dark:text-slate-300">
                埋枪章节序号：
              </label>
              <input
                type="number"
                min={1}
                value={formPlantOrder}
                onChange={(e) => setFormPlantOrder(Number(e.target.value))}
                className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>
          <div className="text-xs">
            <label className="block mb-1 font-medium text-slate-700 dark:text-slate-300">
              埋下时的原文片段或伏笔特征：
            </label>
            <textarea
              rows={2}
              value={formSnippet}
              onChange={(e) => setFormSnippet(e.target.value)}
              placeholder="例如：在拍卖行角落发现一面满是裂纹的青铜镜，器灵已陷入死寂..."
              className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-2 text-xs">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium transition"
            >
              确认登记
            </button>
          </div>
        </form>
      )}

      {/* 筛选过滤 Bar */}
      <div className="flex items-center gap-2 text-xs flex-wrap">
        {[
          { id: 'all', label: '全部伏笔' },
          { id: 'dormant', label: '休眠暗线' },
          { id: 'incubating', label: '正在孵化' },
          { id: 'rusting', label: '⚠️ 严重锈蚀(超30章)' },
          { id: 'fired', label: '✅ 已响枪引爆' },
          { id: 'abandoned', label: '已废弃' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3 py-1.5 rounded-lg transition font-medium ${
              statusFilter === tab.id
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 伏笔卡片列表 */}
      <div className="flex-1 space-y-3 overflow-y-auto">
        {filteredGuns.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 text-xs">
            暂无匹配的契诃夫之枪。点击上方按钮立下一柄新枪！
          </div>
        ) : (
          filteredGuns.map((gun) => (
            <div
              key={gun.id}
              className={`p-4 rounded-xl border bg-white dark:bg-slate-800 transition shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                gun.isRustingAlert
                  ? 'border-amber-400 dark:border-amber-600/60 bg-amber-50/20'
                  : gun.status === 'fired'
                  ? 'border-emerald-200 dark:border-emerald-800/40'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    {gun.gunName}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {gun.category === 'item'
                      ? '道具神兵'
                      : gun.category === 'secret'
                      ? '身世秘辛'
                      : gun.category === 'promise'
                      ? '誓约承诺'
                      : gun.category === 'character'
                      ? '暗中人物'
                      : '禁忌秘术'}
                  </span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> 第 {gun.plantChapterOrder} 章埋设 (已跨度 {gun.rustingDistance} 章)
                  </span>
                  {gun.isRustingAlert && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> 严重锈蚀警报！
                    </span>
                  )}
                  {gun.status === 'fired' && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> 已在第 {gun.actualFiredChapterOrder} 章引爆
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg">
                  “{gun.plantSnippet}”
                </p>
              </div>

              {/* 操作区 */}
              <div className="flex items-center gap-2 text-xs self-end md:self-auto">
                {gun.status !== 'fired' && (
                  <button
                    onClick={() => handleUpdateStatus(gun, 'fired')}
                    className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition flex items-center gap-1"
                    title="在本章引爆这柄枪"
                  >
                    <Flame className="w-3.5 h-3.5" /> 响枪引爆
                  </button>
                )}
                {gun.status === 'dormant' && (
                  <button
                    onClick={() => handleUpdateStatus(gun, 'incubating')}
                    className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium transition"
                  >
                    进入孵化
                  </button>
                )}
                {gun.status !== 'abandoned' && (
                  <button
                    onClick={() => handleUpdateStatus(gun, 'abandoned')}
                    className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition"
                    title="废弃该伏笔"
                  >
                    废弃
                  </button>
                )}
                <button
                  onClick={() => handleDelete(gun.id)}
                  className="p-1 rounded text-slate-400 hover:text-red-500 transition"
                  title="删除记录"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
