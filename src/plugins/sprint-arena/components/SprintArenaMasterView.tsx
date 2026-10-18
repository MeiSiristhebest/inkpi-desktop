import { useState, useEffect, useMemo, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import type { SprintRecord } from '../types'
import { indexedDbSprintRepository } from '../../../adapters/indexedDbSprintRepository'
import { Flame, Clock, Zap, Trophy, Trash2, CheckCircle2 } from 'lucide-react'
import { Tooltip } from '../../../ui/primitives'

export const SprintArenaMasterView: FC<DesktopPluginViewProps> = (props) => (
  <SprintHistory key={props.projectId} {...props} />
)
const SprintHistory: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const [records, setRecords] = useState<SprintRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadRecords = async () => {
    try {
      setLoading(true)
      const all = await indexedDbSprintRepository.getAll()
      const filtered = all
        .filter((r) => r.projectId === projectId)
        .sort((a, b) => b.completedAt - a.completedAt)
      setRecords(filtered)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRecords()
  }, [projectId])

  const stats = useMemo(() => {
    const totalWords = records.reduce((sum, r) => sum + r.wordsWritten, 0)
    const totalSeconds = records.reduce((sum, r) => sum + r.durationSeconds, 0)
    const peakWpm = records.reduce((max, r) => Math.max(max, r.peakWpm), 0)
    const avgWpm = totalSeconds > 0 ? Math.round((totalWords / totalSeconds) * 60) : 0

    return {
      totalWords,
      totalMinutes: Math.round(totalSeconds / 60),
      peakWpm,
      avgWpm,
    }
  }, [records])

  const handleDeleteRecord = async (id: string) => {
    try {
      await indexedDbSprintRepository.delete(id)
      await loadRecords()
      setError(null)
    } catch (cause) {
      setError(String(cause))
    }
  }

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-canvas)] text-[var(--ink-text)] overflow-hidden">
      {error && (
        <p role="alert">
          {error}
          <button onClick={() => void loadRecords()}>重新读取</button>
        </p>
      )}
      {/* 顶栏 */}
      <div className="border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4 shrink-0 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight">码字冲刺记录</h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-500 font-medium">
                正文净增 · 实际经过时间
              </span>
            </div>
            <p className="text-xs text-[var(--ink-text-muted)] mt-0.5">
              字数按非空白 Unicode 字符净增计算；旧记录的计数口径未验证。
            </p>
          </div>
        </div>

        {/* 核心战绩指标卡 */}
        <div className="grid grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] flex items-center justify-between">
            <div>
              <span className="text-[11px] text-[var(--ink-text-muted)] block">累计冲刺字数</span>
              <span className="text-lg font-bold text-[var(--ink-text)]">
                {stats.totalWords} 字
              </span>
            </div>
            <Flame className="w-6 h-6 text-orange-500 opacity-80" />
          </div>

          <div className="p-3 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] flex items-center justify-between">
            <div>
              <span className="text-[11px] text-[var(--ink-text-muted)] block">历史最高峰值</span>
              <span className="text-lg font-bold text-amber-500">{stats.peakWpm} 字/分钟</span>
            </div>
            <Trophy className="w-6 h-6 text-amber-500 opacity-80" />
          </div>

          <div className="p-3 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] flex items-center justify-between">
            <div>
              <span className="text-[11px] text-[var(--ink-text-muted)] block">
                总净增 / 总时长
              </span>
              <span className="text-lg font-bold text-emerald-500">{stats.avgWpm} 字/分钟</span>
            </div>
            <Zap className="w-6 h-6 text-emerald-500 opacity-80" />
          </div>

          <div className="p-3 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] flex items-center justify-between">
            <div>
              <span className="text-[11px] text-[var(--ink-text-muted)] block">专注冲刺时长</span>
              <span className="text-lg font-bold text-blue-400">{stats.totalMinutes} 分钟</span>
            </div>
            <Clock className="w-6 h-6 text-blue-400 opacity-80" />
          </div>
        </div>
      </div>

      {/* 战绩明细列表 */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between text-xs text-[var(--ink-text-muted)] mb-4">
          <span>历史冲刺战绩记录 ({records.length})</span>
          <span className="text-[11px]">可在写作台右侧抽屉随时开启新的码字冲刺</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-[var(--ink-text-muted)]">
            加载冲刺战绩中...
          </div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center text-xs text-[var(--ink-text-muted)]">
            暂无历史冲刺记录。打开写作台右侧「冲刺擂台」抽屉，开启你的第一次专注冲刺吧！
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {records.map((r) => (
              <div
                key={r.id}
                className="p-4 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] flex flex-col justify-between hover:border-orange-500/50 transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <span className="text-sm font-bold text-[var(--ink-text)] flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />+{r.wordsWritten} 字
                    </span>
                    <span className="text-[10px] text-[var(--ink-text-muted)] block">
                      计数口径：{r.metricVersion === 2 ? '非空白字符净增' : '旧记录未验证'} · 时长:{' '}
                      {Math.round(r.durationSeconds / 60)} 分钟 ·{' '}
                      {new Date(r.completedAt).toLocaleDateString('zh-CN')}
                    </span>
                  </div>

                  <Tooltip content="删除记录">
                    <button
                      onClick={() => handleDeleteRecord(r.id)}
                      className="text-[var(--ink-text-muted)] hover:text-rose-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>
                </div>

                <div className="flex items-center justify-between text-xs bg-[var(--ink-bg-canvas)] p-2.5 rounded-lg border border-[var(--ink-border)]/50">
                  <div>
                    <span className="text-[10px] text-[var(--ink-text-muted)] block">平均速度</span>
                    <span className="font-semibold text-emerald-500">{r.averageWpm} 字/分钟</span>
                  </div>
                  <div className="h-6 w-px bg-[var(--ink-border)]" />
                  <div>
                    <span className="text-[10px] text-[var(--ink-text-muted)] block">
                      最高观察速率
                    </span>
                    <span className="font-semibold text-amber-500">{r.peakWpm} 字/分钟</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
