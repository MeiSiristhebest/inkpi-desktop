import { useState, useEffect, useMemo, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import type { ExpectationContract, GoldenThreeDiagnostic } from '../types'
import { expectationEngine } from '../engine/ExpectationEngine'
import { indexedDbExpectationRepository } from '../../../adapters/indexedDbExpectationRepository'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import {
  Sparkles,
  Plus,
  Trash2,
  Activity,
  Flame,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

export const ExpectationMasterView: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const [contracts, setContracts] = useState<ExpectationContract[]>([])
  const [loading, setLoading] = useState(true)

  // 黄金三章诊断器弹层/折叠
  const [showGoldenThree, setShowGoldenThree] = useState(false)
  const [ch1Input, setCh1Input] = useState('')
  const [ch2Input, setCh2Input] = useState('')
  const [ch3Input, setCh3Input] = useState('')
  const [diagnosticResult, setDiagnosticResult] = useState<GoldenThreeDiagnostic | null>(null)

  // 新建契约表单
  const [newTitle, setNewTitle] = useState('')
  const [newIntensity, setNewIntensity] = useState<1 | 2 | 3 | 4 | 5>(4)
  const [newPlantedCh, setNewPlantedCh] = useState(1)
  const [newResolveCh, setNewResolveCh] = useState(10)

  const loadContracts = async () => {
    try {
      setLoading(true)
      const all = await indexedDbExpectationRepository.getAll()
      const filtered = all.filter((c) => !c.projectId || c.projectId === projectId)
      setContracts(filtered)
    } catch (e) {
      console.error('Failed to load expectation contracts:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadContracts()
  }, [projectId])

  const audit = useMemo(() => {
    return expectationEngine.auditContracts(contracts, 15)
  }, [contracts])

  const handleCreateContract = async () => {
    if (!newTitle.trim()) return
    const now = clock.now()
    const item: ExpectationContract = {
      id: idGenerator.generate('contract'),
      projectId,
      title: newTitle.trim(),
      intensity: newIntensity,
      status: 'planted',
      plantedChapter: Number(newPlantedCh),
      promisedResolveChapter: Number(newResolveCh),
      createdAt: now,
      updatedAt: now,
    }
    await indexedDbExpectationRepository.save(item)
    setNewTitle('')
    await loadContracts()
  }

  const handleUpdateStatus = async (contract: ExpectationContract, status: ExpectationContract['status']) => {
    const updated: ExpectationContract = {
      ...contract,
      status,
      updatedAt: clock.now(),
    }
    await indexedDbExpectationRepository.save(updated)
    await loadContracts()
  }

  const handleDeleteContract = async (id: string) => {
    await indexedDbExpectationRepository.delete(id)
    await loadContracts()
  }

  const handleRunGoldenThreeAudit = () => {
    const res = expectationEngine.diagnoseGoldenThree(ch1Input, ch2Input, ch3Input)
    setDiagnosticResult(res)
  }

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-canvas)] text-[var(--ink-text)] overflow-hidden">
      {/* 顶栏 */}
      <div className="border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4 shrink-0 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight">爽点与期待感调度器</h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 font-medium">
                多巴胺契约 · 压抑释放比
              </span>
            </div>
            <p className="text-xs text-[var(--ink-text-muted)] mt-0.5">
              监控压抑爆发比（SPR），杜绝虐主弃书与审美疲劳，闭环追踪读者核心爽点契约
            </p>
          </div>

          <button
            onClick={() => setShowGoldenThree(!showGoldenThree)}
            className="px-3 py-1.5 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] hover:bg-[var(--ink-bg-hover)] text-xs flex items-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>黄金三章追读体检</span>
            {showGoldenThree ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* 统计指标 */}
        <div className="grid grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)]">
            <span className="text-[11px] text-[var(--ink-text-muted)] block">爽点契约总数</span>
            <span className="text-lg font-bold text-[var(--ink-text)]">{audit.total}</span>
          </div>
          <div className="p-3 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)]">
            <span className="text-[11px] text-[var(--ink-text-muted)] block">兑现闭环率</span>
            <span className="text-lg font-bold text-emerald-500">{audit.fulfillmentRate}%</span>
          </div>
          <div className="p-3 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)]">
            <span className="text-[11px] text-[var(--ink-text-muted)] block">蓄势中契约</span>
            <span className="text-lg font-bold text-blue-400">{audit.activeCount}</span>
          </div>
          <div className="p-3 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)]">
            <span className="text-[11px] text-[var(--ink-text-muted)] block">超期未兑现预警</span>
            <span className={`text-lg font-bold ${audit.overdueContracts.length > 0 ? 'text-rose-500' : 'text-[var(--ink-text-muted)]'}`}>
              {audit.overdueContracts.length}
            </span>
          </div>
        </div>
      </div>

      {/* 黄金三章体检区折叠 */}
      {showGoldenThree && (
        <div className="border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4 shrink-0 space-y-3">
          <div className="text-xs font-semibold text-[var(--ink-text)] flex items-center justify-between">
            <span>黄金三章自动化节奏体检</span>
            <button
              onClick={handleRunGoldenThreeAudit}
              className="px-3 py-1 rounded-md bg-[var(--ink-accent)] text-white text-xs font-medium hover:opacity-90"
            >
              运行体检
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] text-[var(--ink-text-muted)] block mb-1">第一章：困境与金手指</label>
              <textarea
                rows={3}
                value={ch1Input}
                onChange={(e) => setCh1Input(e.target.value)}
                placeholder="粘贴第一章文本摘要..."
                className="w-full p-2 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs resize-none focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] text-[var(--ink-text-muted)] block mb-1">第二章：矛盾升级与微观立威</label>
              <textarea
                rows={3}
                value={ch2Input}
                onChange={(e) => setCh2Input(e.target.value)}
                placeholder="粘贴第二章文本摘要..."
                className="w-full p-2 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs resize-none focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] text-[var(--ink-text-muted)] block mb-1">第三章：大危机与长期悬念</label>
              <textarea
                rows={3}
                value={ch3Input}
                onChange={(e) => setCh3Input(e.target.value)}
                placeholder="粘贴第三章文本摘要..."
                className="w-full p-2 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs resize-none focus:outline-none"
              />
            </div>
          </div>

          {diagnosticResult && (
            <div className="p-3 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[var(--ink-text)] flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-amber-500" />
                  体检综合评分：{diagnosticResult.overallScore} 分
                </span>
                <span className="text-[11px] text-[var(--ink-text-muted)]">
                  {diagnosticResult.advice}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className={`p-2 rounded border ${diagnosticResult.chapter1Status.passed ? 'border-emerald-500/30 text-emerald-500' : 'border-rose-500/30 text-rose-500'}`}>
                  Ch1: {diagnosticResult.chapter1Status.feedback}
                </div>
                <div className={`p-2 rounded border ${diagnosticResult.chapter2Status.passed ? 'border-emerald-500/30 text-emerald-500' : 'border-rose-500/30 text-rose-500'}`}>
                  Ch2: {diagnosticResult.chapter2Status.feedback}
                </div>
                <div className={`p-2 rounded border ${diagnosticResult.chapter3Status.passed ? 'border-emerald-500/30 text-emerald-500' : 'border-rose-500/30 text-rose-500'}`}>
                  Ch3: {diagnosticResult.chapter3Status.feedback}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 契约录入条 */}
      <div className="p-4 border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)] flex items-center gap-3 text-xs shrink-0">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="登记新爽点契约（如：当众击败外门执事、夺得九转玄阳丹）..."
          className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none"
        />
        <div className="flex items-center gap-1 text-[var(--ink-text-muted)]">
          <span>爽点烈度:</span>
          <select
            value={newIntensity}
            onChange={(e) => setNewIntensity(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
            className="px-2 py-1 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)] focus:outline-none"
          >
            <option value={1}>★☆☆☆☆ 微爽</option>
            <option value={2}>★★☆☆☆ 局部</option>
            <option value={3}>★★★☆☆ 显著</option>
            <option value={4}>★★★★☆ 震撼</option>
            <option value={5}>★★★★★ 极度暴爽</option>
          </select>
        </div>
        <div className="flex items-center gap-1 text-[var(--ink-text-muted)]">
          <span>埋设章:</span>
          <input
            type="number"
            min="1"
            value={newPlantedCh}
            onChange={(e) => setNewPlantedCh(Number(e.target.value))}
            className="w-16 px-2 py-1 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)] focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1 text-[var(--ink-text-muted)]">
          <span>承诺兑现章:</span>
          <input
            type="number"
            min="1"
            value={newResolveCh}
            onChange={(e) => setNewResolveCh(Number(e.target.value))}
            className="w-16 px-2 py-1 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)] focus:outline-none"
          />
        </div>
        <button
          onClick={handleCreateContract}
          className="px-3 py-1.5 rounded-lg bg-[var(--ink-accent)] text-white font-medium hover:opacity-90 flex items-center gap-1 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> 登记契约
        </button>
      </div>

      {/* 契约卡片看板列表 */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="p-8 text-center text-xs text-[var(--ink-text-muted)]">加载爽点契约中...</div>
        ) : contracts.length === 0 ? (
          <div className="p-12 text-center text-xs text-[var(--ink-text-muted)]">
            当前暂无爽点契约。在上方录入你在正文中许诺给读者的期待与高潮兑现计划！
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contracts.map((c) => {
              const isFulfilled = c.status === 'fulfilled'
              return (
                <div
                  key={c.id}
                  className="p-4 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] flex flex-col justify-between hover:border-[var(--ink-accent)]/50 transition-all space-y-3"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h4 className={`font-semibold text-xs leading-snug ${isFulfilled ? 'line-through text-[var(--ink-text-muted)]' : 'text-[var(--ink-text)]'}`}>
                        {c.title}
                      </h4>
                      <button
                        onClick={() => handleDeleteContract(c.id)}
                        className="text-[var(--ink-text-muted)] hover:text-rose-400 p-1"
                        title="删除契约"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1 text-amber-500 text-xs mb-2">
                      <Flame className="w-3.5 h-3.5" />
                      <span>{'★'.repeat(c.intensity)}{'☆'.repeat(5 - c.intensity)}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[var(--ink-text-muted)] bg-[var(--ink-bg-canvas)] p-2 rounded-lg border border-[var(--ink-border)]/50">
                      <span>第 {c.plantedChapter} 章埋设</span>
                      <span>承诺：~第 {c.promisedResolveChapter} 章</span>
                    </div>
                  </div>

                  {/* 状态操作条 */}
                  <div className="flex items-center justify-between pt-2 border-t border-[var(--ink-border)]/40 text-xs">
                    <span className="text-[11px] text-[var(--ink-text-muted)]">状态：</span>
                    <div className="flex items-center gap-1">
                      {(['planted', 'building', 'climax', 'fulfilled'] as const).map((st) => (
                        <button
                          key={st}
                          onClick={() => handleUpdateStatus(c, st)}
                          className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                            c.status === st
                              ? 'bg-[var(--ink-accent)] text-white font-medium'
                              : 'bg-[var(--ink-bg-elevated)] text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)]'
                          }`}
                        >
                          {st === 'planted' ? '埋设' : st === 'building' ? '蓄势' : st === 'climax' ? '临界' : '兑现'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
