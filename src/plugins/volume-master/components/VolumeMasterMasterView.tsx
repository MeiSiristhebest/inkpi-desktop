import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import type { VolumeArcRecord, VolumeStat, TotalBookMetrics, ActStage } from '../types'
import { volumeMasterEngine } from '../engine/VolumeMasterEngine'
import { indexedDbVolumeArcRepository } from '../../../adapters/indexedDbVolumeArcRepository'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import {
  Save,
  CheckCircle2,
  Layers,
  BookOpen,
  Target,
} from 'lucide-react'

export const VolumeMasterMasterView: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const [volumes, setVolumes] = useState<Array<{ id: string; title: string; order: number }>>([])
  const [chapters, setChapters] = useState<Array<{ volumeId?: string; wordCount?: number }>>([])
  const [arcs, setArcs] = useState<VolumeArcRecord[]>([])
  const [selectedVolId, setSelectedVolId] = useState<string>('')
  const [savedSuccess, setSavedSuccess] = useState(false)

  // 当前选中卷的编辑草稿
  const [editTargetWords, setEditTargetWords] = useState(200000)
  const [editActStage, setEditActStage] = useState<ActStage>('act1_intro')
  const [editConflict, setEditConflict] = useState('')
  const [editClimax, setEditClimax] = useState('')
  const [editReward, setEditReward] = useState('')
  const [editCliffhanger, setEditCliffhanger] = useState('')

  const loadAll = async () => {
    try {
      const [allVols, allChaps, allArcs] = await Promise.all([
        indexedDbProjectRepository.getVolumesByProject(projectId),
        indexedDbProjectRepository.getChaptersByProject(projectId),
        indexedDbVolumeArcRepository.getAll(projectId),
      ])

      const sortedVols = (allVols || []).sort((a, b) => a.order - b.order)
      setVolumes(sortedVols)
      setChapters(allChaps || [])
      setArcs(allArcs || [])

      if (sortedVols.length > 0) {
        const initVolId = selectedVolId || sortedVols[0].id
        setSelectedVolId(initVolId)
        syncFormWithArc(initVolId, sortedVols, allArcs)
      }
    } catch (e) {
      console.error('Failed to load volume master data:', e)
    }
  }

  const syncFormWithArc = (
    volId: string,
    _volList: Array<{ id: string; title: string; order: number }>,
    arcList: VolumeArcRecord[]
  ) => {
    const existing = arcList.find((a) => a.volumeId === volId)
    if (existing) {
      setEditTargetWords(existing.targetWordCount || 200000)
      setEditActStage(existing.actStage || 'act1_intro')
      setEditConflict(existing.coreConflict || '')
      setEditClimax(existing.climaxNode || '')
      setEditReward(existing.rewardOutcome || '')
      setEditCliffhanger(existing.crossVolumeCliffhanger || '')
    } else {
      setEditTargetWords(200000)
      setEditActStage('act1_intro')
      setEditConflict('')
      setEditClimax('')
      setEditReward('')
      setEditCliffhanger('')
    }
  }

  useEffect(() => {
    loadAll()
  }, [projectId])

  const handleSelectVolume = (volId: string) => {
    setSelectedVolId(volId)
    syncFormWithArc(volId, volumes, arcs)
  }

  const handleSaveArc = async () => {
    if (!selectedVolId) return
    const vol = volumes.find((v) => v.id === selectedVolId)
    const existing = arcs.find((a) => a.volumeId === selectedVolId)

    const now = clock.now()
    const record: VolumeArcRecord = {
      id: existing ? existing.id : idGenerator.generate('arc'),
      projectId,
      volumeId: selectedVolId,
      volumeTitle: vol?.title || '未命名卷',
      volumeOrder: vol?.order || 0,
      targetWordCount: Number(editTargetWords),
      actStage: editActStage,
      coreConflict: editConflict.trim(),
      climaxNode: editClimax.trim(),
      rewardOutcome: editReward.trim(),
      crossVolumeCliffhanger: editCliffhanger.trim(),
      updatedAt: now,
    }

    await indexedDbVolumeArcRepository.save(record)
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 1500)
    await loadAll()
  }

  const metrics: TotalBookMetrics = volumeMasterEngine.aggregateBookMetrics(
    volumes,
    chapters,
    arcs
  )

  const activeVol = volumes.find((v) => v.id === selectedVolId)
  const activeArc = arcs.find((a) => a.volumeId === selectedVolId)
  const activeStat: VolumeStat | null = activeVol
    ? volumeMasterEngine.calculateVolumeStat(activeVol, chapters, activeArc)
    : null

  const actInfo = volumeMasterEngine.getActStageInfo(editActStage)

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-canvas)] text-[var(--ink-text)] overflow-hidden">
      {/* 顶栏 */}
      <div className="border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4 shrink-0 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight">百万字分卷弧光罗盘</h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 font-medium">
              分形分卷四幕式 · 字数燃烧率 WBR
            </span>
          </div>
          <p className="text-xs text-[var(--ink-text-muted)] mt-0.5">
            掌控长篇分卷宏观戏剧弧，分配大高潮爆发点，杜绝中后期战力通胀与水文崩盘
          </p>
        </div>

        <button
          onClick={handleSaveArc}
          disabled={!selectedVolId}
          className="px-3.5 py-1.5 rounded-lg bg-[var(--ink-accent)] text-white text-xs font-semibold hover:opacity-90 flex items-center gap-1.5 shadow-sm disabled:opacity-50"
        >
          {savedSuccess ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
          <span>{savedSuccess ? '规划已保存' : '保存分卷规划'}</span>
        </button>
      </div>

      {/* 宏观数据概览条 */}
      <div className="border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4 shrink-0 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="p-3 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)]">
          <span className="text-[11px] text-[var(--ink-text-muted)] block">规划分卷总数</span>
          <span className="text-lg font-bold text-[var(--ink-text)] mt-0.5 block">
            {metrics.totalVolumes} 卷 ({metrics.totalChapters} 章)
          </span>
        </div>
        <div className="p-3 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)]">
          <span className="text-[11px] text-[var(--ink-text-muted)] block">全书累计已写正文</span>
          <span className="text-lg font-bold text-indigo-400 mt-0.5 block">
            {metrics.totalWordCount.toLocaleString()} 字
          </span>
        </div>
        <div className="p-3 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)]">
          <span className="text-[11px] text-[var(--ink-text-muted)] block">全书预计总字数规模</span>
          <span className="text-lg font-bold text-emerald-500 mt-0.5 block">
            {metrics.projectedTotalWords.toLocaleString()} 字
          </span>
        </div>
        <div className="p-3 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)]">
          <span className="text-[11px] text-[var(--ink-text-muted)] block">宏观节奏健康度</span>
          <span
            className={`text-lg font-bold mt-0.5 block ${
              metrics.overallPacingRating === 'smooth'
                ? 'text-emerald-500'
                : metrics.overallPacingRating === 'needs_tightening'
                  ? 'text-amber-500'
                  : 'text-rose-500'
            }`}
          >
            {metrics.overallPacingRating === 'smooth'
              ? '平稳健康'
              : metrics.overallPacingRating === 'needs_tightening'
                ? '需紧凑收束'
                : '注水告警'}
          </span>
        </div>
      </div>

      {/* 主体：分卷列表选择 (左 4 列) + 卷弧光详细编辑 (右 8 列) */}
      <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 左栏：分卷导航列表 */}
        <div className="lg:col-span-4 space-y-3">
          <span className="text-xs font-semibold text-[var(--ink-text)] flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            全书分卷进度列表
          </span>

          {volumes.length === 0 ? (
            <div className="p-6 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] text-xs text-[var(--ink-text-muted)] text-center">
              请在主编辑器目录树中建立分卷（Volume）。
            </div>
          ) : (
            <div className="space-y-2">
              {volumes.map((vol) => {
                const arc = arcs.find((a) => a.volumeId === vol.id)
                const stat = volumeMasterEngine.calculateVolumeStat(vol, chapters, arc)
                const isSelected = vol.id === selectedVolId

                return (
                  <div
                    key={vol.id}
                    onClick={() => handleSelectVolume(vol.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer text-xs space-y-2 ${
                      isSelected
                        ? 'border-purple-500 bg-purple-500/10 shadow-sm'
                        : 'border-[var(--ink-border)] bg-[var(--ink-bg-panel)] hover:border-[var(--ink-border-hover)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[var(--ink-text)] truncate">{vol.title}</span>
                      <span className="text-[10px] text-[var(--ink-text-muted)] shrink-0">
                        第 {vol.order + 1} 卷
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[var(--ink-text-muted)]">
                      <span>{stat.actualWordCount.toLocaleString()} / {stat.targetWordCount.toLocaleString()} 字</span>
                      <span className="font-medium text-purple-400">{stat.burnRate}%</span>
                    </div>

                    {/* 进度条 */}
                    <div className="w-full h-1.5 rounded-full bg-[var(--ink-bg-canvas)] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          stat.status === 'lagging_water'
                            ? 'bg-rose-500'
                            : stat.burnRate >= 100
                              ? 'bg-emerald-500'
                              : 'bg-purple-500'
                        }`}
                        style={{ width: `${Math.min(100, stat.burnRate)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 右栏：所选分卷的戏剧弧与大高潮规划 */}
        <div className="lg:col-span-8 space-y-4">
          {activeStat && activeVol ? (
            <div className="p-5 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-[var(--ink-border)] pb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-purple-400" />
                  <span className="font-semibold text-sm">{activeVol.title} 戏剧弧规划</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--ink-text-muted)]">目标字数:</span>
                  <input
                    type="number"
                    step="10000"
                    min="50000"
                    value={editTargetWords}
                    onChange={(e) => setEditTargetWords(Number(e.target.value))}
                    className="w-24 px-2 py-1 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)]"
                  />
                  <span>字</span>
                </div>
              </div>

              {/* 四幕阶段选择器 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--ink-text)]">分形分卷四幕阶段：</span>
                  <span className="text-[11px] text-purple-400 font-medium">{actInfo.progressRange}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(['act1_intro', 'act2_rising', 'act3_climax', 'act4_fallout'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setEditActStage(st)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        editActStage === st
                          ? 'border-purple-500 bg-purple-500/15 text-purple-400 font-semibold'
                          : 'border-[var(--ink-border)] bg-[var(--ink-bg-canvas)] text-[var(--ink-text-muted)] hover:text-[var(--ink-text)]'
                      }`}
                    >
                      <span className="block font-medium text-xs">
                        {st === 'act1_intro'
                          ? '第一幕 破局'
                          : st === 'act2_rising'
                            ? '第二幕 危机'
                            : st === 'act3_climax'
                              ? '第三幕 卷巅峰'
                              : '第四幕 余波'}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-[var(--ink-text-muted)] italic bg-[var(--ink-bg-canvas)] p-2 rounded border border-[var(--ink-border)]/50">
                  {actInfo.desc}
                </p>
              </div>

              {/* 核心戏剧目标表单 */}
              <div className="space-y-3 pt-2 border-t border-[var(--ink-border)]">
                <div>
                  <label className="text-[11px] font-medium text-[var(--ink-text-muted)] block mb-1">
                    ① 本卷核心戏剧矛盾与反派阻力：
                  </label>
                  <input
                    type="text"
                    value={editConflict}
                    onChange={(e) => setEditConflict(e.target.value)}
                    placeholder="如：外门大比夺魁与大长老一系的暗杀打压..."
                    className="w-full px-3 py-1.5 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-[var(--ink-text-muted)] block mb-1">
                    ② 卷末大高潮爆发点（Climax Node）：
                  </label>
                  <input
                    type="text"
                    value={editClimax}
                    onChange={(e) => setEditClimax(e.target.value)}
                    placeholder="如：决战血煞峰顶，主角引下九天玄雷绝杀黑袍老祖..."
                    className="w-full px-3 py-1.5 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-[var(--ink-text-muted)] block mb-1">
                    ③ 卷终主角战利品与境界收获：
                  </label>
                  <input
                    type="text"
                    value={editReward}
                    onChange={(e) => setEditReward(e.target.value)}
                    placeholder="如：突破金丹期、夺得天阶法宝紫青双剑、升任玄天宗首徒..."
                    className="w-full px-3 py-1.5 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-[var(--ink-text-muted)] block mb-1">
                    ④ 跨卷大钩子与下一卷新征程引子（Cliffhanger）：
                  </label>
                  <input
                    type="text"
                    value={editCliffhanger}
                    onChange={(e) => setEditCliffhanger(e.target.value)}
                    placeholder="如：庆功宴上，天机阁突然送来血色绝密玉简：未婚妻所在的皇朝一夜被灭..."
                    className="w-full px-3 py-1.5 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)] focus:outline-none"
                  />
                </div>
              </div>

              {/* 实时诊断反馈 */}
              <div className="p-3 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-canvas)] text-[11px] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--ink-text)] flex items-center gap-1">
                    <Target className="w-3.5 h-3.5 text-purple-400" />
                    分卷节奏与叙事弧拟合诊断：
                  </span>
                  {activeStat.arcRegression && (
                    <span className="text-[10px] text-purple-400 font-mono">
                      二阶 OLS 拟合度 R²: {activeStat.arcRegression.r2} · 顶点位置: {Math.round(activeStat.arcRegression.apexRatio * 100)}%
                    </span>
                  )}
                </div>
                <p className="text-[var(--ink-text-muted)] leading-relaxed">{activeStat.advice}</p>
              </div>
            </div>
          ) : (
            <div className="p-12 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] text-center text-xs text-[var(--ink-text-muted)]">
              请在左侧选择分卷以查看或编辑其宏观弧光。
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
