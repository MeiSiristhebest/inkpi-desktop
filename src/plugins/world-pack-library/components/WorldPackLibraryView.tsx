import { useCallback, useEffect, useMemo, useState, type FC } from 'react'
import { Archive, GitCompare, PackagePlus } from 'lucide-react'
import { ConfirmDialog } from '../../../ui/molecules/ConfirmDialog'
import {
  isBlank,
  type WorldPackDiff,
  type WorldPackEntityDiffStatus,
  type WorldPackEntitySnapshot,
  type WorldPackSnapshot,
} from '../../../domain/worldPacks/worldPack'
import { worldPackService, type WorldPackService } from '../../../services/worldPackService'

export interface WorldPackLibraryViewProps {
  projectId: string
  service?: Pick<WorldPackService, 'listSnapshots' | 'createSnapshot' | 'compare' | 'adopt'>
}

/** Global immutable snapshots; adoption writes only additive facts to the current work. */
export const WorldPackLibraryView: FC<WorldPackLibraryViewProps> = ({
  projectId,
  service = worldPackService,
}) => {
  const model = useWorldPackLibraryModel(projectId, service)

  return (
    <div className="max-w-5xl space-y-5">
      <SnapshotCreationPanel
        busy={model.busy || model.loading}
        onCreate={() => void model.createSnapshot()}
      />
      {model.error && (
        <div
          role="alert"
          className="rounded-lg border border-[var(--ink-danger)]/40 p-3 text-xs text-[var(--ink-danger)]"
        >
          {model.error}
        </div>
      )}
      {model.notice && (
        <div
          role="status"
          className="rounded-lg border border-[var(--ink-accent)]/40 p-3 text-xs text-[var(--ink-text)]"
        >
          {model.notice}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.6fr)]">
        <SnapshotCatalog
          snapshots={model.snapshots}
          selectedSnapshotId={model.selectedSnapshotId}
          projectId={projectId}
          loading={model.loading}
          onSelect={model.selectSnapshot}
        />
        <WorldPackDiffPanel
          snapshot={model.selectedSnapshot}
          diff={model.diff}
          loading={model.diffLoading}
          busy={model.busy}
          onAdopt={model.openAdoptionConfirmation}
        />
      </div>

      <ConfirmDialog
        open={model.confirmAdoption}
        title="确认采用世界设定快照？"
        confirmText="明确采用可新增内容"
        cancelText="返回查看差异"
        onCancel={model.cancelAdoption}
        onConfirm={() => void model.adoptSnapshot()}
      >
        {model.selectedSnapshot && model.diff && (
          <p className="text-xs leading-relaxed text-[var(--ink-text-muted)]">
            将从“{model.selectedSnapshot.sourceProjectName} v{model.selectedSnapshot.version}”新增{' '}
            {model.diff.counts.fieldsToAdd} 个空缺设定字段和 {model.diff.counts.entitiesToAdd}{' '}
            个新实体。 冲突字段、同名实体及当前作品独有内容会保留；该快照不会被修改。
          </p>
        )}
      </ConfirmDialog>
    </div>
  )
}

interface WorldPackLibraryModel {
  snapshots: WorldPackSnapshot[]
  selectedSnapshotId: string | null
  selectedSnapshot: WorldPackSnapshot | undefined
  diff: WorldPackDiff | null
  loading: boolean
  diffLoading: boolean
  busy: boolean
  confirmAdoption: boolean
  error: string | null
  notice: string | null
  selectSnapshot: (id: string) => void
  createSnapshot: () => Promise<void>
  openAdoptionConfirmation: () => void
  cancelAdoption: () => void
  adoptSnapshot: () => Promise<void>
}

function useWorldPackLibraryModel(
  projectId: string,
  service: Pick<WorldPackService, 'listSnapshots' | 'createSnapshot' | 'compare' | 'adopt'>,
): WorldPackLibraryModel {
  const [snapshots, setSnapshots] = useState<WorldPackSnapshot[]>([])
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null)
  const [diffState, setDiffState] = useState<{
    snapshotId: string
    projectId: string
    diff?: WorldPackDiff
    error?: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirmAdoption, setConfirmAdoption] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void service
      .listSnapshots()
      .then((nextSnapshots) => {
        if (!active) return
        setSnapshots(nextSnapshots)
        setSelectedSnapshotId((current) =>
          current && nextSnapshots.some((snapshot) => snapshot.id === current)
            ? current
            : (nextSnapshots[0]?.id ?? null),
        )
      })
      .catch((cause: unknown) => {
        if (active) setActionError(messageOf(cause))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [service])

  useEffect(() => {
    if (!selectedSnapshotId) return
    let active = true
    void service
      .compare(selectedSnapshotId, projectId)
      .then((nextDiff) => {
        if (active) setDiffState({ snapshotId: selectedSnapshotId, projectId, diff: nextDiff })
      })
      .catch((cause: unknown) => {
        if (active) {
          setDiffState({ snapshotId: selectedSnapshotId, projectId, error: messageOf(cause) })
        }
      })
    return () => {
      active = false
    }
  }, [projectId, selectedSnapshotId, service])

  const selectedSnapshot = useMemo(
    () => snapshots.find((snapshot) => snapshot.id === selectedSnapshotId),
    [snapshots, selectedSnapshotId],
  )
  const currentDiffState =
    diffState?.snapshotId === selectedSnapshotId && diffState.projectId === projectId
      ? diffState
      : null
  const diff = currentDiffState?.diff ?? null
  const diffLoading = Boolean(selectedSnapshotId) && currentDiffState === null
  const error = actionError ?? currentDiffState?.error ?? null

  const createSnapshot = useCallback(async () => {
    setBusy(true)
    setActionError(null)
    setNotice(null)
    try {
      const created = await service.createSnapshot(projectId)
      setSnapshots(await service.listSnapshots())
      setSelectedSnapshotId(created.id)
      setNotice(`已创建不可变快照 v${created.version}。旧版本未被改写。`)
    } catch (cause) {
      setActionError(messageOf(cause))
    } finally {
      setBusy(false)
    }
  }, [projectId, service])

  const selectSnapshot = useCallback((id: string) => {
    setSelectedSnapshotId(id)
    setNotice(null)
    setActionError(null)
  }, [])

  const openAdoptionConfirmation = useCallback(() => setConfirmAdoption(true), [])
  const cancelAdoption = useCallback(() => setConfirmAdoption(false), [])

  const adoptSnapshot = useCallback(async () => {
    if (!selectedSnapshot) return
    setBusy(true)
    setConfirmAdoption(false)
    setActionError(null)
    setNotice(null)
    try {
      const result = await service.adopt(selectedSnapshot.id, projectId)
      setNotice(adoptionNotice(result))
      const [nextSnapshots, nextDiff] = await Promise.all([
        service.listSnapshots(),
        service.compare(selectedSnapshot.id, projectId),
      ])
      setSnapshots(nextSnapshots)
      setDiffState({ snapshotId: selectedSnapshot.id, projectId, diff: nextDiff })
    } catch (cause) {
      setActionError(messageOf(cause))
    } finally {
      setBusy(false)
    }
  }, [projectId, selectedSnapshot, service])

  return {
    snapshots,
    selectedSnapshotId,
    selectedSnapshot,
    diff,
    loading,
    diffLoading,
    busy,
    confirmAdoption,
    error,
    notice,
    selectSnapshot,
    createSnapshot,
    openAdoptionConfirmation,
    cancelAdoption,
    adoptSnapshot,
  }
}

const SnapshotCreationPanel: FC<{ busy: boolean; onCreate: () => void }> = ({ busy, onCreate }) => (
  <section className="rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-card)] p-4">
    <div className="mb-2 flex items-center gap-2">
      <PackagePlus className="h-4 w-4 text-[var(--ink-accent)]" />
      <h2 className="text-sm font-semibold">创建世界设定快照</h2>
    </div>
    <p className="mb-3 text-xs leading-relaxed text-[var(--ink-text-muted)]">
      快照包含当前作品的世界设定表单和 Codex
      实体图谱。它是本机全局、只追加版本的副本，不会实时同步；章节和其他插件数据不会纳入。
    </p>
    <button
      type="button"
      onClick={onCreate}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-lg bg-[var(--ink-accent)] px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
    >
      <Archive className="h-3.5 w-3.5" />
      为当前作品创建新版本
    </button>
  </section>
)

const SnapshotCatalog: FC<{
  snapshots: WorldPackSnapshot[]
  selectedSnapshotId: string | null
  projectId: string
  loading: boolean
  onSelect: (id: string) => void
}> = ({ snapshots, selectedSnapshotId, projectId, loading, onSelect }) => (
  <section className="space-y-2">
    <h2 className="text-sm font-semibold">本机快照目录</h2>
    {loading ? (
      <p className="text-xs text-[var(--ink-text-muted)]">正在读取快照…</p>
    ) : snapshots.length === 0 ? (
      <p className="rounded-lg border border-dashed border-[var(--ink-border)] p-3 text-xs text-[var(--ink-text-muted)]">
        目录为空。先从有世界设定的作品创建快照。
      </p>
    ) : (
      <ul className="space-y-2">
        {snapshots.map((snapshot) => (
          <li key={snapshot.id}>
            <button
              type="button"
              aria-pressed={selectedSnapshotId === snapshot.id}
              onClick={() => onSelect(snapshot.id)}
              className={`w-full rounded-lg border p-3 text-left transition-colors ${
                selectedSnapshotId === snapshot.id
                  ? 'border-[var(--ink-accent)] bg-[var(--ink-bg-card)]'
                  : 'border-[var(--ink-border)] bg-[var(--ink-bg-card)] hover:border-[var(--ink-accent)]/60'
              }`}
            >
              <span className="block text-xs font-medium text-[var(--ink-text)]">
                {snapshot.sourceProjectName} · v{snapshot.version}
              </span>
              <span className="mt-1 block text-[10px] text-[var(--ink-text-muted)]">
                {snapshot.sourceProjectId === projectId ? '当前作品来源' : '其他作品来源'} ·{' '}
                {new Date(snapshot.createdAt).toLocaleString()}
              </span>
              <span className="mt-1 block text-[10px] text-[var(--ink-text-faint)]">
                {Object.values(snapshot.worldbase).filter((value) => !isBlank(value)).length}{' '}
                个设定字段 · {snapshot.entities.length} 个实体
              </span>
            </button>
          </li>
        ))}
      </ul>
    )}
  </section>
)

const WorldPackDiffPanel: FC<{
  snapshot: WorldPackSnapshot | undefined
  diff: WorldPackDiff | null
  loading: boolean
  busy: boolean
  onAdopt: () => void
}> = ({ snapshot, diff, loading, busy, onAdopt }) => {
  const hasAdditions = (diff?.counts.fieldsToAdd ?? 0) > 0 || (diff?.counts.entitiesToAdd ?? 0) > 0

  return (
    <section className="min-w-0 space-y-3">
      <div className="flex items-center gap-2">
        <GitCompare className="h-4 w-4 text-[var(--ink-accent)]" />
        <h2 className="text-sm font-semibold">与当前作品的差异</h2>
      </div>
      <p className="text-xs leading-relaxed text-[var(--ink-text-muted)]">
        采用前显示差异。确认后只补入目标中为空的设定字段和不存在的实体；不同字段、同名实体及目标独有内容都会保留，不会被覆盖。
      </p>
      {loading ? (
        <p className="text-xs text-[var(--ink-text-muted)]">正在比较…</p>
      ) : snapshot && diff ? (
        <DiffDetails diff={diff} busy={busy} hasAdditions={hasAdditions} onAdopt={onAdopt} />
      ) : (
        <p className="rounded-lg border border-dashed border-[var(--ink-border)] p-3 text-xs text-[var(--ink-text-muted)]">
          选择快照以查看差异。
        </p>
      )}
    </section>
  )
}

const DiffDetails: FC<{
  diff: WorldPackDiff
  busy: boolean
  hasAdditions: boolean
  onAdopt: () => void
}> = ({ diff, busy, hasAdditions, onAdopt }) => (
  <>
    <div className="flex flex-wrap gap-2 text-[10px]">
      <CountBadge label="设定可新增" value={diff.counts.fieldsToAdd} />
      <CountBadge label="设定冲突·保留目标" value={diff.counts.conflictingFields} />
      <CountBadge label="实体可新增" value={diff.counts.entitiesToAdd} />
      <CountBadge label="实体冲突·保留目标" value={diff.counts.conflictingEntities} />
      {diff.counts.ambiguousEntities > 0 && (
        <CountBadge label="实体匹配不唯一·跳过" value={diff.counts.ambiguousEntities} />
      )}
    </div>
    <DiffList diff={diff} />
    <button
      type="button"
      onClick={onAdopt}
      disabled={busy || !hasAdditions}
      className="rounded-lg bg-[var(--ink-accent)] px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
    >
      采用可安全新增的内容到当前作品
    </button>
    {!hasAdditions && (
      <p className="text-[11px] text-[var(--ink-text-muted)]">
        当前没有可安全新增的内容；冲突和目标已有内容不会自动合并。
      </p>
    )}
  </>
)

const CountBadge: FC<{ label: string; value: number }> = ({ label, value }) => (
  <span className="rounded-md border border-[var(--ink-border)] px-2 py-1 text-[var(--ink-text-muted)]">
    {label}：{value}
  </span>
)

const DiffList: FC<{ diff: WorldPackDiff }> = ({ diff }) => {
  const sourceNames = new Map(
    diff.entities.map(({ sourceEntity }) => [sourceEntity.id, sourceEntity.name]),
  )
  const targetNames = new Map(
    [
      ...diff.entities.flatMap(({ matchingTargets }) => matchingTargets),
      ...diff.targetOnlyEntities,
    ].map((entity) => [entity.id, entity.name]),
  )

  return (
    <div className="space-y-4 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-card)] p-3">
      <section>
        <h3 className="mb-2 text-xs font-semibold">世界设定字段</h3>
        <ul className="space-y-2">
          {diff.fields.map((field) => (
            <li
              key={field.field}
              className="rounded-lg border border-[var(--ink-border)]/70 p-2 text-[11px]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={statusClass(field.status)}>{fieldStatusLabel(field.status)}</span>
                <strong>{field.field}</strong>
              </div>
              <div className="mt-1 grid gap-1 sm:grid-cols-2">
                <ValueLine label="快照" value={field.sourceValue} />
                {field.status !== 'add' && <ValueLine label="当前" value={field.targetValue} />}
              </div>
            </li>
          ))}
          {diff.fields.length === 0 && <EmptyLine>快照没有非空世界设定字段。</EmptyLine>}
          {diff.targetOnlyFields.map(({ field, targetValue }) => (
            <li
              key={`target-${field}`}
              className="rounded-lg border border-[var(--ink-border)]/70 p-2 text-[11px]"
            >
              <span className={statusClass('same')}>目标独有·保持不变</span>
              <strong className="ml-2">{field}</strong>
              <ValueLine label="当前" value={targetValue} />
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="mb-2 text-xs font-semibold">Codex 实体</h3>
        <ul className="space-y-2">
          {diff.entities.map((entityDiff) => (
            <li
              key={entityDiff.sourceEntity.id}
              className="rounded-lg border border-[var(--ink-border)]/70 p-2 text-[11px]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={statusClass(entityDiff.status)}>
                  {entityStatusLabel(entityDiff.status)}
                </span>
                <strong>{entityDiff.sourceEntity.name}</strong>
                <span className="text-[var(--ink-text-faint)]">
                  {entityDiff.sourceEntity.category}
                </span>
              </div>
              <ValueLine label="快照摘要" value={entityDiff.sourceEntity.summary} />
              {entityDiff.matchingTargets.map((target) => (
                <ValueLine key={target.id} label="当前摘要" value={target.summary} />
              ))}
              <details className="mt-2 rounded-md border border-[var(--ink-border)]/60 p-2">
                <summary className="cursor-pointer text-[10px] text-[var(--ink-text-muted)]">
                  查看别名、属性、关系与完整设定
                </summary>
                <EntityFacts
                  label="快照"
                  entity={entityDiff.sourceEntity}
                  parentName={
                    entityDiff.sourceEntity.parentId
                      ? sourceNames.get(entityDiff.sourceEntity.parentId)
                      : undefined
                  }
                />
                {entityDiff.matchingTargets.map((target) => (
                  <EntityFacts
                    key={target.id}
                    label="当前"
                    entity={target}
                    parentName={target.parentId ? targetNames.get(target.parentId) : undefined}
                  />
                ))}
              </details>
            </li>
          ))}
          {diff.entities.length === 0 && <EmptyLine>快照没有 Codex 实体。</EmptyLine>}
          {diff.targetOnlyEntities.map((entity) => (
            <li
              key={`target-${entity.id}`}
              className="rounded-lg border border-[var(--ink-border)]/70 p-2 text-[11px]"
            >
              <span className={statusClass('same')}>目标独有·保持不变</span>
              <strong className="ml-2">{entity.name}</strong>
              <ValueLine label="当前摘要" value={entity.summary} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

const EntityFacts: FC<{
  label: string
  entity: WorldPackEntitySnapshot
  parentName?: string
}> = ({ label, entity, parentName }) => (
  <div className="mt-2 border-t border-[var(--ink-border)]/60 pt-2">
    <strong className="text-[10px]">{label}</strong>
    <ValueLine label="别名" value={entity.aliases.length > 0 ? entity.aliases.join('、') : '无'} />
    <ValueLine label="上级" value={parentName ?? (entity.parentId ? '无法匹配' : '无')} />
    <ValueLine label="属性" value={entity.attributes} />
    <ValueLine
      label="关系"
      value={entity.relations.map((relation) => ({
        目标: relation.targetName,
        类型: relation.relationType,
        说明: relation.description,
      }))}
    />
    {entity.detailMarkdown !== undefined && (
      <ValueLine label="完整设定" value={entity.detailMarkdown} />
    )}
  </div>
)

const ValueLine: FC<{ label: string; value: unknown }> = ({ label, value }) => {
  const text = formatValue(value)
  return (
    <div className="mt-1 break-words text-[var(--ink-text-muted)]">
      <p>
        <span className="text-[var(--ink-text-faint)]">{label}：</span>
        {truncate(text)}
      </p>
      {text.length > 240 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-[10px] text-[var(--ink-text-faint)]">
            展开完整内容
          </summary>
          <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-[var(--ink-bg)] p-2 text-[10px]">
            {text}
          </pre>
        </details>
      )}
    </div>
  )
}

const EmptyLine: FC<{ children: string }> = ({ children }) => (
  <li className="text-[11px] text-[var(--ink-text-faint)]">{children}</li>
)

function fieldStatusLabel(status: 'add' | 'same' | 'conflict'): string {
  if (status === 'add') return '可新增'
  if (status === 'conflict') return '冲突·保留目标'
  return '一致'
}

function entityStatusLabel(status: WorldPackEntityDiffStatus): string {
  if (status === 'add') return '可新增'
  if (status === 'conflict') return '同名冲突·保留目标'
  if (status === 'ambiguous') return '匹配不唯一·跳过'
  return '一致'
}

function statusClass(status: WorldPackEntityDiffStatus | 'same'): string {
  if (status === 'add') return 'rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700'
  if (status === 'conflict' || status === 'ambiguous') {
    return 'rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-700'
  }
  return 'rounded bg-[var(--ink-bg-hover)] px-1.5 py-0.5 text-[var(--ink-text-muted)]'
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2) ?? String(value)
  } catch {
    return '[无法预览]'
  }
}

function truncate(value: string): string {
  return value.length > 240 ? `${value.slice(0, 240)}…` : value
}

function adoptionNotice(result: Awaited<ReturnType<WorldPackService['adopt']>>): string {
  const summaries = [
    `新增 ${result.addedWorldbaseFields} 个世界设定字段`,
    `新增 ${result.addedEntities} 个实体`,
  ]
  if (result.preservedConflictingWorldbaseFields || result.preservedConflictingEntities) {
    summaries.push(
      `保留 ${result.preservedConflictingWorldbaseFields} 个字段冲突和 ${result.preservedConflictingEntities} 个实体冲突`,
    )
  }
  if (result.ambiguousEntities)
    summaries.push(`跳过 ${result.ambiguousEntities} 个无法安全匹配的实体`)
  if (result.unresolvedRelations)
    summaries.push(`未迁移 ${result.unresolvedRelations} 条无目标实体的关系`)
  return `采用完成：${summaries.join('；')}。`
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}
