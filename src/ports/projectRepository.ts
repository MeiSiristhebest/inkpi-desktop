import type { ProjectQueryPort } from './projectQuery'
import type { ProjectCommandPort } from './projectCommand'

/**
 * 项目仓储端口（抽象）。
 *
 * 业务服务（projectService）只依赖此抽象，而不依赖具体的 IndexedDB / 云端 / 内存实现。
 * 任何存储后端（本地 IndexedDB、云端同步、测试内存版）实现该接口即可被注入，
 * 满足依赖倒置（DIP）与端口-适配器（Ports & Adapters）架构。
 *
 * 为兼顾接口隔离（ISP，评审 §5.1），该端口由「读」(ProjectQueryPort) 与「写」
 * (ProjectCommandPort) 两个窄端口组合而成；仅需查询的调用方可直接依赖 ProjectQueryPort，
 * 仅需写入的调用方可直接依赖 ProjectCommandPort。
 */
export interface ProjectRepository extends ProjectQueryPort, ProjectCommandPort {}

export type { ProjectQueryPort, ProjectCommandPort }
