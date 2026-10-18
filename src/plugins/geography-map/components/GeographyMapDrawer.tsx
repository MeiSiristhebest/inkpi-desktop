import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import type { GeoMapGridRecord } from '../types'
import type { CodexEntity } from '../../living-codex/types'
import { indexedDbGeoMapRepository } from '../../../adapters/indexedDbGeoMapRepository'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'
import { GeoMapEngine } from '../engine/GeoMapEngine'

export const GeographyMapDrawer: FC<DesktopPluginDrawerProps> = (props) => (
  <GeographyMapProjectDrawer key={props.projectId} {...props} />
)

const GeographyMapProjectDrawer: FC<DesktopPluginDrawerProps> = ({ projectId, currentText }) => {
  const [maps, setMaps] = useState<GeoMapGridRecord[]>([])
  const [locations, setLocations] = useState<CodexEntity[]>([])
  const [notice, setNotice] = useState('正在读取地图和地点设定…')
  useEffect(() => {
    let disposed = false
    Promise.all([
      indexedDbGeoMapRepository.getAll(projectId),
      indexedDbCodexEntityRepository.getByProject(projectId),
    ])
      .then(([records, entities]) => {
        if (disposed) return
        setMaps(records.filter((record) => record.projectId === projectId))
        setLocations(entities.filter((entity) => entity.category === 'location'))
        setNotice('')
      })
      .catch(() => {
        if (!disposed) setNotice('读取地图或地点设定失败。')
      })
    return () => {
      disposed = true
    }
  }, [projectId])
  const mentions = locations.flatMap((location) =>
    [...new Set([location.name, ...location.aliases])]
      .filter((name) => name.trim())
      .flatMap((name) => {
        const matches = []
        let from = 0
        while (currentText && from < currentText.length) {
          const start = currentText.indexOf(name, from)
          if (start < 0) break
          matches.push({ entityId: location.id, name, start, end: start + name.length })
          from = start + name.length
        }
        return matches
      }),
  )
  return (
    <div className="p-4 space-y-3 text-xs text-[var(--ink-text)]">
      <h3 className="font-semibold text-sm">地理拓扑随动感知</h3>
      {notice && <p role="status">{notice}</p>}
      <p>正文中已登记地点的字面提及（不代表人物当前位置）：</p>
      {mentions.length === 0 ? (
        <p>未命中已登记地点，无法确认地理位置。</p>
      ) : (
        mentions.map((mention) => (
          <p key={mention.entityId + ':' + mention.start + ':' + mention.name}>
            {mention.name}，原文 [{mention.start}, {mention.end})
          </p>
        ))
      )}
      {maps.map((map) => {
        let route
        try {
          route = map.travelPlan
            ? GeoMapEngine.planRoute({
                ...map.travelPlan,
                cells: map.occupiedCells,
                scaleKmPerCell: map.scaleKmPerCell,
              })
            : null
        } catch {
          route = { status: 'no-route' as const, reason: '已保存行程参数无效。' }
        }
        return (
          <section key={map.id} className="border rounded p-2 space-y-1">
            <h4>
              已登记地图：
              {locations.find((location) => location.id === map.locationId)?.name ?? map.locationId}
            </h4>
            <p>
              {map.scaleKmPerCell} km/格，{map.occupiedCells.length} 个已绘单元格。
            </p>
            <p>
              城市格 {map.occupiedCells.filter((cell) => cell.terrainType === 'city').length}
              ；山地格 {map.occupiedCells.filter((cell) => cell.terrainType === 'mountain').length}
              。
            </p>
            {route?.status === 'ok' ? (
              <p>
                按保存假设，路线 {route.distanceKm.toFixed(3)} km，约{' '}
                {route.estimatedDays.toFixed(3)} 天。
              </p>
            ) : (
              <p>{route?.reason ?? '未保存路线、速度与通行假设，无法估算行程。'}</p>
            )}
          </section>
        )
      })}
    </div>
  )
}
