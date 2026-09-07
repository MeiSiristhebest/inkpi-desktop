import { useEffect, useState, useCallback } from 'react'
import type { ProjectQueryPort } from '../ports/projectQuery'
import type { Clock } from '../ports/clock'
import { indexedDbProjectRepository } from '../adapters/indexedDbProjectRepository'
import { indexedDbTableRecordRepository } from '../adapters/indexedDbTableRecordRepository'
import { indexedDbCardRecordRepository } from '../adapters/indexedDbCardRecordRepository'
import { indexedDbDailyStatsRepository } from '../adapters/indexedDbDailyStatsRepository'
import { clock } from '../adapters/clock'
import { computeDashboardModel, type DashboardModel } from '../domain/dashboard'

/**
 * 写作面板数据 hook：从仓储拉取项目/卷/章/伏笔/灵感/进度/日历/角色数据，交给纯函数 computeDashboardModel 聚合。
 * 视图（DashboardView）只消费返回的模型，不再直接接触存储或做派生计算。
 */
export function useDashboardModel(
  projectId: string,
  queryPort: ProjectQueryPort = indexedDbProjectRepository,
  clockPort: Clock = clock,
): { model: DashboardModel | null; reload: () => void } {
  const [model, setModel] = useState<DashboardModel | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const reload = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  useEffect(() => {
    let alive = true
    Promise.all([
      queryPort.getProject(projectId),
      queryPort.getVolumesByProject(projectId),
      queryPort.getChaptersByProject(projectId),
      indexedDbTableRecordRepository.getRows(projectId, 'foreshadow').catch(() => []),
      indexedDbTableRecordRepository.getRows(projectId, 'ideas').catch(() => []),
      indexedDbTableRecordRepository.getRows(projectId, 'progress').catch(() => []),
      indexedDbDailyStatsRepository.getDailyStats(projectId).catch(() => []),
      Promise.all([
        indexedDbCardRecordRepository.getCards(projectId, 'char-main').catch(() => []),
        indexedDbCardRecordRepository.getCards(projectId, 'char-secondary').catch(() => []),
        indexedDbCardRecordRepository.getCards(projectId, 'char-npc').catch(() => []),
      ]).then(([cMain, cSec, cNpc]) => {
        const set = new Set<string>()
        ;[...cMain, ...cSec, ...cNpc].forEach((item) => {
          if (item.name && item.name.trim()) {
            set.add(item.name.trim())
          }
        })
        return Array.from(set)
      }),
    ]).then(
      ([
        project,
        volumes,
        chapters,
        foreshadowRows,
        ideasRows,
        progressRows,
        dailyStatsRecords,
        characterNames,
      ]) => {
        if (!alive) return
        setModel(
          computeDashboardModel(
            projectId,
            project,
            volumes,
            chapters,
            clockPort.now(),
            foreshadowRows,
            ideasRows,
            progressRows,
            dailyStatsRecords,
            characterNames,
          ),
        )
      },
    )
    return () => {
      alive = false
    }
  }, [projectId, queryPort, clockPort, refreshKey])

  return { model, reload }
}
