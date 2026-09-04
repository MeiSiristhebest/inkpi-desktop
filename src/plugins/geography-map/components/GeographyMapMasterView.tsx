import { useState, useEffect, useMemo, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { GeoMapEngine } from '../engine/GeoMapEngine'
import type { GeoMapGridRecord, TerrainType } from '../types'
import { indexedDbGeoMapRepository } from '../../../adapters/indexedDbGeoMapRepository'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import {
  MapPin,
  Mountain,
  Compass,
  Layers,
  Save,
  Flag,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react'

export const GeographyMapMasterView: FC<DesktopPluginViewProps> = ({ projectId }) => {
  const [mapRecord, setMapRecord] = useState<GeoMapGridRecord | null>(null)
  const [selectedTerrain, setSelectedTerrain] = useState<TerrainType>('mountain')
  const [scale, setScale] = useState<1 | 10>(10)

  // 行军测距状态
  const [startPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [targetPos, setTargetPos] = useState<{ x: number; y: number }>({ x: 7, y: 7 })
  const [marchSpeed, setMarchSpeed] = useState<number>(30)

  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null)

  const loadMap = async () => {
    const all = await indexedDbGeoMapRepository.getAll(projectId)
    if (all.length > 0) {
      setMapRecord(all[0])
      setScale(all[0].scaleKmPerCell)
    } else {
      const initial: GeoMapGridRecord = {
        id: idGenerator.generate('geomap'),
        projectId,
        locationId: 'loc-world',
        scaleKmPerCell: 10,
        bounds: { minX: 0, minY: 0, maxX: 7, maxY: 7 },
        occupiedCells: GeoMapEngine.createInitialGrid(8, 8, 'land'),
        fillColor: '#3b82f6',
        linkedOverlays: {
          activeCharacterIds: ['主角', '反派少宗主'],
          foreshadowIds: ['上古剑冢'],
          timelineEventIds: ['两界大战'],
        },
        updatedAt: clock.now(),
      }
      setMapRecord(initial)
    }
  }

  useEffect(() => {
    loadMap()
  }, [projectId])

  const cells = mapRecord?.occupiedCells || []

  const topologyReport = useMemo(() => {
    return GeoMapEngine.validateContiguity(cells)
  }, [cells])

  const travelResult = useMemo(() => {
    return GeoMapEngine.calculateTravelTime({
      start: startPos,
      target: targetPos,
      scaleKmPerCell: scale,
      speedKmPerDay: marchSpeed,
      dominantTerrain: selectedTerrain,
    })
  }, [startPos, targetPos, scale, marchSpeed, selectedTerrain])

  const handleCellClick = (x: number, y: number, isShift: boolean = false) => {
    if (!mapRecord) return
    if (isShift) {
      setTargetPos({ x, y })
      return
    }

    const updatedCells = mapRecord.occupiedCells.map((c) => {
      if (c.x === x && c.y === y) {
        return { ...c, terrainType: selectedTerrain }
      }
      return c
    })

    setMapRecord({
      ...mapRecord,
      occupiedCells: updatedCells,
      updatedAt: clock.now(),
    })
  }

  const handleSaveMap = async () => {
    if (!mapRecord) return
    const updated: GeoMapGridRecord = {
      ...mapRecord,
      scaleKmPerCell: scale,
      updatedAt: clock.now(),
    }
    await indexedDbGeoMapRepository.save(updated)
    setSavedSuccessMsg('地理拓扑画板已成功保存！')
    setTimeout(() => setSavedSuccessMsg(null), 2500)
  }

  const handleResetMap = () => {
    if (!mapRecord) return
    setMapRecord({
      ...mapRecord,
      occupiedCells: GeoMapEngine.createInitialGrid(8, 8, 'land'),
      updatedAt: clock.now(),
    })
  }

  return (
    <div className="p-6 h-full flex flex-col space-y-4 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 overflow-y-auto">
      {/* 顶部标题与保存栏 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800 gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <Compass className="w-6 h-6 text-blue-500" />
            物理拓扑网格地图与战局沙盘 (Geography Map)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            2D 离散拓扑网格画板、行军阻尼时间测算与无飞地拓扑校验，从物理距离根除时间线 Bug。
          </p>
        </div>

        <div className="flex items-center gap-2">
          {savedSuccessMsg && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {savedSuccessMsg}
            </span>
          )}
          <button
            onClick={handleSaveMap}
            className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center gap-1.5 shadow-sm"
          >
            <Save className="w-4 h-4" /> 保存地图沙盘
          </button>
        </div>
      </div>

      {/* 控制工具条 */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
        {/* 地形笔刷选择 */}
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-500">地形笔刷：</span>
          {[
            { id: 'land', label: '平原/大地', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
            { id: 'mountain', label: '山脉/险峰', color: 'bg-amber-100 text-amber-800 border-amber-300' },
            { id: 'water', label: '江河/重洋', color: 'bg-blue-100 text-blue-800 border-blue-300' },
            { id: 'city', label: '都城/宗门', color: 'bg-purple-100 text-purple-800 border-purple-300' },
            { id: 'barrier', label: '天堑/禁地', color: 'bg-rose-100 text-rose-800 border-rose-300' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTerrain(t.id as TerrainType)}
              className={`px-2.5 py-1 rounded border font-medium transition ${
                selectedTerrain === t.id
                  ? `${t.color} ring-2 ring-blue-500 font-bold`
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 比例尺切换 */}
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-500">比例尺档位：</span>
          <button
            onClick={() => setScale(1)}
            className={`px-2.5 py-1 rounded border transition ${
              scale === 1
                ? 'bg-blue-600 text-white font-bold border-blue-600'
                : 'border-slate-200 dark:border-slate-700'
            }`}
          >
            1 km / 格 (城池微观)
          </button>
          <button
            onClick={() => setScale(10)}
            className={`px-2.5 py-1 rounded border transition ${
              scale === 10
                ? 'bg-blue-600 text-white font-bold border-blue-600'
                : 'border-slate-200 dark:border-slate-700'
            }`}
          >
            10 km / 格 (洲陆宏观)
          </button>
          <button
            onClick={handleResetMap}
            className="p-1.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            title="清空重置画板"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 主工作区：左侧 8x8 2D 网格，右侧行军时间与拓扑巡检 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        {/* 左侧 2D 互动网格画板 */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center">
          <div className="mb-3 text-xs text-slate-400 flex items-center gap-3">
            <span>点击任意单元格应用所选地形笔刷</span>
            <span>起点: ({startPos.x},{startPos.y})</span>
            <span>终点: ({targetPos.x},{targetPos.y})</span>
          </div>

          <div className="grid grid-cols-8 gap-1.5 p-3 bg-slate-100 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800">
            {cells.map((cell) => {
              const isStart = cell.x === startPos.x && cell.y === startPos.y
              const isTarget = cell.x === targetPos.x && cell.y === targetPos.y

              let bgClass = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 border-emerald-200'
              if (cell.terrainType === 'mountain') {
                bgClass = 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 border-amber-300'
              } else if (cell.terrainType === 'water') {
                bgClass = 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 border-blue-300'
              } else if (cell.terrainType === 'city') {
                bgClass = 'bg-purple-100 dark:bg-purple-950/40 text-purple-700 border-purple-300'
              } else if (cell.terrainType === 'barrier') {
                bgClass = 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 border-rose-300'
              }

              return (
                <button
                  key={`${cell.x}-${cell.y}`}
                  onClick={(e) => handleCellClick(cell.x, cell.y, e.shiftKey)}
                  className={`w-12 h-12 md:w-14 md:h-14 rounded-lg border flex flex-col items-center justify-center text-[10px] font-bold transition transform active:scale-95 relative ${bgClass} ${
                    isStart || isTarget ? 'ring-2 ring-blue-600 ring-offset-1' : ''
                  }`}
                  title={`坐标(${cell.x},${cell.y}) - 地形: ${cell.terrainType}`}
                >
                  {isStart ? (
                    <span className="text-[10px] bg-blue-600 text-white px-1 rounded">起</span>
                  ) : isTarget ? (
                    <span className="text-[10px] bg-rose-600 text-white px-1 rounded">终</span>
                  ) : cell.terrainType === 'city' ? (
                    <Flag className="w-3.5 h-3.5" />
                  ) : cell.terrainType === 'mountain' ? (
                    <Mountain className="w-3.5 h-3.5" />
                  ) : (
                    <span>{cell.x},{cell.y}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* 右侧：行军时间测距仪与图层覆盖 */}
        <div className="space-y-4">
          {/* 行军算力卡片 */}
          <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-rose-500" />
              行军日程精密测算仪 (A-to-B)
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">移动方式/速度：</span>
                <select
                  value={marchSpeed}
                  onChange={(e) => setMarchSpeed(Number(e.target.value))}
                  className="p-1 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                >
                  <option value={30}>凡人步卒/辎重 (30 km/天)</option>
                  <option value={70}>精锐轻骑快马 (70 km/天)</option>
                  <option value={300}>筑基修士御剑 (300 km/天)</option>
                  <option value={2000}>元婴挪移遁法 (2000 km/天)</option>
                </select>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">直线/网格步长：</span>
                  <span className="font-semibold">{travelResult.distanceCells} 格</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">折合物理距离：</span>
                  <span className="font-semibold">{travelResult.distanceKm} 公里</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">地形阻尼加权：</span>
                  <span className="font-semibold">x {travelResult.dampingFactor}</span>
                </div>
                <div className="pt-1 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-sm font-bold text-blue-600 dark:text-blue-400">
                  <span>合理日程天数：</span>
                  <span>约 {travelResult.estimatedDays} 天</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                💡 测算结果可直接注入大纲时间线与多历法引擎，防止出现“上午还在边关、下午就飞到帝都”的战力/时空硬伤。
              </p>
            </div>
          </div>

          {/* 地缘拓扑巡检报告 */}
          <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
            <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-purple-500" />
              领地拓扑与飞地自检
            </div>
            <div
              className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                topologyReport.isContiguous
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 text-emerald-700 dark:text-emerald-400'
                  : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 text-amber-700 dark:text-amber-400'
              }`}
            >
              {topologyReport.isContiguous ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-bold">
                  {topologyReport.isContiguous ? '拓扑结构完整连通' : '存在孤立飞地风险'}
                </div>
                <div className="text-[11px] mt-0.5">{topologyReport.message}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
