import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import type { GeoMapGridRecord } from '../types'
import { indexedDbGeoMapRepository } from '../../../adapters/indexedDbGeoMapRepository'
import { MapPin, Compass, Mountain, Flag } from 'lucide-react'

export const GeographyMapDrawer: FC<DesktopPluginDrawerProps> = ({ projectId, currentText }) => {
  const [mapRecord, setMapRecord] = useState<GeoMapGridRecord | null>(null)
  const [detectedLocation, setDetectedLocation] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const all = await indexedDbGeoMapRepository.getAll(projectId)
      if (all.length > 0) setMapRecord(all[0])
    }
    load()
  }, [projectId])

  useEffect(() => {
    if (!currentText) {
      setDetectedLocation(null)
      return
    }
    // 文本地名特征自侦测
    const match = currentText.match(/(黑风寨|青云门|落霞谷|帝都|天元城|万妖荒原|葬剑峰)/)
    if (match) {
      setDetectedLocation(match[0])
    }
  }, [currentText])

  const cells = mapRecord?.occupiedCells || []
  const cityCount = cells.filter((c) => c.terrainType === 'city').length
  const mountainCount = cells.filter((c) => c.terrainType === 'mountain').length

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-panel)] text-[var(--ink-text)] overflow-y-auto p-4 space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-[var(--ink-border)] pb-2">
        <span className="font-semibold text-sm flex items-center gap-1.5 text-blue-500">
          <Compass className="w-4 h-4" /> 地理拓扑随动感知
        </span>
        <span className="text-[10px] text-[var(--ink-text-muted)]">
          {mapRecord ? `${mapRecord.scaleKmPerCell} km/格` : '未初始化'}
        </span>
      </div>

      {detectedLocation && (
        <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 space-y-1">
          <div className="font-bold flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" /> 正文定位到地理风物：
          </div>
          <div className="text-[11px] font-semibold">{detectedLocation}</div>
          <div className="text-[10px] opacity-80">
            沙盘系统已就绪，行军至临近宗门需 2-4 天，注意防范行军光速吃书。
          </div>
        </div>
      )}

      {/* 沙盘地貌微缩卡片 */}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="p-2.5 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)]">
          <div className="text-[10px] text-[var(--ink-text-muted)] flex items-center justify-center gap-1">
            <Flag className="w-3 h-3 text-purple-500" /> 城镇/宗门据点
          </div>
          <div className="text-base font-bold text-purple-600 mt-1">{cityCount} 处</div>
        </div>
        <div className="p-2.5 rounded bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)]">
          <div className="text-[10px] text-[var(--ink-text-muted)] flex items-center justify-center gap-1">
            <Mountain className="w-3 h-3 text-amber-500" /> 山脉/险地天堑
          </div>
          <div className="text-base font-bold text-amber-600 mt-1">{mountainCount} 处</div>
        </div>
      </div>

      {/* 8x8 微型沙盘预览 */}
      <div className="space-y-1.5">
        <div className="font-semibold text-[11px] text-[var(--ink-text-muted)]">
          微型地缘网格拓扑预览：
        </div>
        <div className="grid grid-cols-8 gap-0.5 p-1.5 bg-[var(--ink-bg-canvas)] rounded border border-[var(--ink-border)]">
          {cells.map((c) => {
            let color = 'bg-emerald-500/20'
            if (c.terrainType === 'mountain') color = 'bg-amber-500/40'
            if (c.terrainType === 'water') color = 'bg-blue-500/40'
            if (c.terrainType === 'city') color = 'bg-purple-500/60'
            if (c.terrainType === 'barrier') color = 'bg-rose-500/60'
            return (
              <div
                key={`${c.x}-${c.y}`}
                className={`w-full aspect-square rounded-xs ${color}`}
                title={`(${c.x},${c.y}) ${c.terrainType}`}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
