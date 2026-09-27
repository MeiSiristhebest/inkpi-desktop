import { useEffect, useState, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import { indexedDbAuthorOpsRepository } from '../../../adapters/indexedDbAuthorOpsRepository'
import { AuthorOpsEngine } from '../engine/AuthorOpsEngine'
import type { MetricLogEntry } from '../types'
import { ScoreProvenanceBadge } from '../../../ui/atoms'
import { TrendingUp } from 'lucide-react'

/**
 * 随动抽屉只报台账里真有的数：过去的「-2.3% (正常浮动)」是写死在 JSX 里的，
 * 台账为空时也照样念出一段留存结论（INV-09 / §P2.5）。
 */
export const AuthorOpsDrawer: FC<DesktopPluginDrawerProps> = ({ projectId }) => {
  const [logs, setLogs] = useState<MetricLogEntry[] | null>(null)

  useEffect(() => {
    let alive = true
    indexedDbAuthorOpsRepository
      .get(projectId)
      .then((record) => {
        if (alive) setLogs(record?.metricLogs ?? [])
      })
      .catch(() => {
        if (alive) setLogs([])
      })
    return () => {
      alive = false
    }
  }, [projectId])

  const analyses = logs && logs.length >= 2 ? AuthorOpsEngine.analyzeDropOff(logs) : []
  const latest = analyses[0]

  return (
    <div className="p-3 space-y-3 text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <span className="font-bold flex items-center gap-1.5 text-blue-500">
          <TrendingUp className="w-4 h-4" /> 连载追读哨兵
        </span>
        <span
          className={`font-bold ${latest?.isSevereCliff ? 'text-rose-500' : 'text-emerald-500'}`}
        >
          {logs === null
            ? '读取台账中'
            : logs.length < 2
              ? '台账不足'
              : latest?.isSevereCliff
                ? '出现断崖点'
                : '台账内未见断崖'}
        </span>
      </div>

      <ScoreProvenanceBadge source="user" detail="留存率由作者在台账里逐条录入" />

      <div className="p-2.5 rounded bg-slate-100 dark:bg-slate-800 space-y-1.5 text-[11px]">
        {logs === null ? (
          <div className="text-slate-500">正在读取本书的运营台账…</div>
        ) : logs.length === 0 ? (
          <div className="text-slate-500">本书还没有任何台账记录，这里不会替你编一个留存数。</div>
        ) : logs.length < 2 ? (
          <div className="text-slate-500">只有 1 条记录，留存差分至少需要相邻两条。</div>
        ) : (
          <>
            <div className="flex justify-between">
              <span className="text-slate-500">最大单章留存降幅:</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {latest ? `${latest.gradientLoss}%（第 ${latest.dropOffChapter} 章）` : '—'}
              </span>
            </div>
            <div className="text-[10px] text-slate-500">
              {latest?.isSevereCliff
                ? '降幅已达 12% 阈值，先在作话里核对这一章的读者反馈。'
                : '尚未触及单章 12% 断崖阈值。'}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
