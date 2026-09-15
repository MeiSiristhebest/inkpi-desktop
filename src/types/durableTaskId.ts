/**
 * 标准 Durable Task ID 规范 (P0.13):
 * 避免使用静态任务名称（如 'project-distillation'），防止与 TaskRouter 全局唯一约束冲突。
 * 格式：{workspace}:{operation}:{sourceFingerprint}:{instance}
 */
export function buildDurableTaskId(params: {
  workspaceId: string
  operation: string
  sourceFingerprint?: string
  instance?: string | number
}): string {
  const ws = params.workspaceId || 'global'
  const op = params.operation || 'task'
  const fp = params.sourceFingerprint ? params.sourceFingerprint.slice(0, 10) : 'src'
  const inst =
    params.instance ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

  return `${ws}:${op}:${fp}:${inst}`
}
