export interface TaskDocumentScope {
  id: string
  revision: number
}

export interface TaskSelectionScope {
  from: number
  to: number
  sourceHash?: string
}

/**
 * TaskScope (P0.9):
 * 跨 Desktop ↔ Runtime 核心协议作用域契约。
 * 显式标识 AI 任务绑定的 workspace、版本轴 (workspaceRevision)、目标章节与选区 (INV-03, INV-06)。
 */
export interface TaskScope {
  workspaceId: string
  workspaceRevision: number
  document?: TaskDocumentScope
  selection?: TaskSelectionScope
  sessionId?: string
}

export interface ScopedTaskContext {
  scope: TaskScope
}

/**
 * 校验并构造标准 TaskScope，若缺失必要信息则返回明确校验错误
 */
export function createTaskScope(params: {
  workspaceId: string
  workspaceRevision?: number
  documentId?: string
  documentRevision?: number
  selection?: { from: number; to: number; sourceHash?: string }
  sessionId?: string
}): TaskScope {
  if (!params.workspaceId) {
    throw new Error('TaskScope requires a non-empty workspaceId (INV-03, INV-06)')
  }

  const scope: TaskScope = {
    workspaceId: params.workspaceId,
    workspaceRevision: params.workspaceRevision ?? 1,
  }

  if (params.documentId) {
    scope.document = {
      id: params.documentId,
      revision: params.documentRevision ?? 1,
    }
  }

  if (params.selection) {
    scope.selection = params.selection
  }

  if (params.sessionId) {
    scope.sessionId = params.sessionId
  }

  return scope
}

/**
 * 从通用参数中安全提取或合成 TaskScope
 */
export function resolveTaskScope(raw: {
  workspaceId?: string
  projectId?: string
  workspaceRevision?: number
  documentId?: string
  chapterId?: string
  revision?: number
  documentRevision?: number
  selection?: { from: number; to: number; sourceHash?: string }
  sessionId?: string
}): TaskScope {
  const workspaceId = raw.workspaceId || raw.projectId
  if (!workspaceId) {
    throw new Error('Cannot resolve TaskScope: neither workspaceId nor projectId provided')
  }

  const documentId = raw.documentId || raw.chapterId
  const docRev = raw.documentRevision ?? raw.revision

  return createTaskScope({
    workspaceId,
    workspaceRevision: raw.workspaceRevision ?? 1,
    documentId,
    documentRevision: docRev,
    selection: raw.selection,
    sessionId: raw.sessionId,
  })
}
