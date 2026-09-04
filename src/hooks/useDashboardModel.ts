import { useEffect, useState } from 'react'
import type { ProjectQueryPort } from '../ports/projectQuery'
import type { Clock } from '../ports/clock'
import { indexedDbProjectRepository } from '../adapters/indexedDbProjectRepository'
import { clock } from '../adapters/clock'
import { computeDashboardModel, type DashboardModel } from '../domain/dashboard'

/**
 * 写作面板数据 hook：从仓储拉取项目/卷/章，交给纯函数 computeDashboardModel 聚合。
 * 视图（DashboardView）只消费返回的模型，不再直接接触存储或做派生计算。
 * 满足 ISP / DIP：依赖 ProjectQueryPort 只读端口与 Clock 端口，支持测试/多端注入。
 */
export function useDashboardModel(
  projectId: string,
  queryPort: ProjectQueryPort = indexedDbProjectRepository,
  clockPort: Clock = clock,
): DashboardModel | null {
  const [model, setModel] = useState<DashboardModel | null>(null)
  useEffect(() => {
    let alive = true
    Promise.all([
      queryPort.getProject(projectId),
      queryPort.getVolumesByProject(projectId),
      queryPort.getChaptersByProject(projectId),
    ]).then(([project, volumes, chapters]) => {
      if (!alive) return
      setModel(computeDashboardModel(projectId, project, volumes, chapters, clockPort.now()))
    })
    return () => {
      alive = false
    }
  }, [projectId, queryPort, clockPort])
  return model
}
