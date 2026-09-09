import { useEffect, useMemo, useRef, useState, type FC, type ReactNode } from 'react'
import { Activity, Brain, Database, RefreshCw, Square } from 'lucide-react'
import type { TaskStatusSnapshot } from '@inkpi/protocol'
import type { ChapterRecord } from '../../types'
import { htmlToPlain } from '../../domain/text'
import { semanticDocumentFromText } from '../../domain/content'
import type { ContinuityAuditTaskInput, DeepReasoningTaskInput } from '../../ai/tasks/taskFactories'
import type { ContinuityFinding, DeepReasoningResult } from '../../ai/results/taskResults'
import { projectContinuityFindingsToEditor, type ContinuityDiagnosticMarker } from '../../ai/results/continuityDiagnostics'
import type { SemanticDocument } from '../../domain/content'
import type {
  DistillationCheckpoint,
  DistillationWorkflowResult,
  ProjectDistillationInput,
  DistillationWorkflowOptions,
} from '../../ai/orchestrator/verticalSlices'
import {
  createDistillationSourceFingerprint,
  indexedDbDistillationCheckpointStore,
  type DistillationCheckpointStore,
} from '../../ai/orchestrator/distillationCheckpointStore'
import { idGenerator } from '../../adapters/idGenerator'

const DISTILLATION_TASK_ID = 'project-distillation'

interface CreativeWorkflowsPanelProps {
  chapters: ChapterRecord[]
  connected: boolean
  onContinuityAudit: (
    input: ContinuityAuditTaskInput,
    options?: { signal?: AbortSignal; pollIntervalMs?: number; onProgress?: (snapshot: TaskStatusSnapshot) => void },
  ) => Promise<ContinuityFinding[] | null>
  onDeepReasoning: (
    input: DeepReasoningTaskInput,
    options?: { signal?: AbortSignal; pollIntervalMs?: number; onProgress?: (snapshot: TaskStatusSnapshot) => void },
  ) => Promise<DeepReasoningResult | null>
  onDistillationWorkflow: (
    input: ProjectDistillationInput,
    options?: DistillationWorkflowOptions,
  ) => Promise<DistillationWorkflowResult | null>
  onSteerTask: (taskId: string, input: unknown) => Promise<boolean>
  distillationCheckpointStore?: DistillationCheckpointStore
}

type WorkflowTab = 'audit' | 'reason' | 'distill'

/** Real UI entry point for the remaining creative vertical slices. */
export const CreativeWorkflowsPanel: FC<CreativeWorkflowsPanelProps> = ({
  chapters,
  connected,
  onContinuityAudit,
  onDeepReasoning,
  onDistillationWorkflow,
  onSteerTask,
}) => {
  const [tab, setTab] = useState<WorkflowTab>('audit')
  const [selectedChapterId, setSelectedChapterId] = useState(chapters[0]?.id ?? '')
  const [auditFindings, setAuditFindings] = useState<ContinuityFinding[]>([])
  const [auditDocument, setAuditDocument] = useState<SemanticDocument | null>(null)
  const [deepResult, setDeepResult] = useState<DeepReasoningResult | null>(null)
  const [distillation, setDistillation] = useState<DistillationWorkflowResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<TaskStatusSnapshot | null>(null)
  const [steering, setSteering] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checkpoint, setCheckpoint] = useState<DistillationCheckpoint | undefined>()
  const auditController = useRef<AbortController | null>(null)
  const runToken = useRef(0)

  useEffect(() => {
    if (!chapters.some((chapter) => chapter.id === selectedChapterId)) {
      setSelectedChapterId(chapters[0]?.id ?? '')
    }
  }, [chapters, selectedChapterId])

  useEffect(() => () => auditController.current?.abort(), [])

  const selectedChapter = useMemo(
    () => chapters.find((chapter) => chapter.id === selectedChapterId) ?? chapters[0],
    [chapters, selectedChapterId],
  )
  const documents = useMemo(
    () => chapters.map((chapter) => semanticDocumentFromText(chapter.id, htmlToPlain(chapter.content || ''), chapter.revision ?? 0)),
    [chapters],
  )
  const auditMarkers: ContinuityDiagnosticMarker[] = useMemo(
    () => (auditDocument ? projectContinuityFindingsToEditor(auditDocument, auditFindings) : []),
    [auditDocument, auditFindings],
  )

  const runAudit = async () => {
    if (!selectedChapter || !connected || busy) return
    auditController.current?.abort()
    const controller = new AbortController()
    auditController.current = controller
    const token = ++runToken.current
    setBusy(true)
    setError(null)
    setProgress(null)
    setAuditDocument(documentForAudit(selectedChapter))
    setAuditFindings([])
    try {
      const document = documentForAudit(selectedChapter)
      const result = await onContinuityAudit(
        {
          taskId: idGenerator.generate(`continuity-${selectedChapter.id}`),
          document,
          scope: 'document',
        },
        { signal: controller.signal, onProgress: setProgress },
      )
      if (token === runToken.current) {
        setAuditDocument(document)
        setAuditFindings(result ?? [])
      }
    } catch (cause) {
      if (!controller.signal.aborted && token === runToken.current) {
        setError(cause instanceof Error ? cause.message : String(cause))
      }
    } finally {
      if (token === runToken.current) setBusy(false)
    }
  }

  const runReasoning = async () => {
    if (!selectedChapter || !connected || busy) return
    const token = ++runToken.current
    setBusy(true)
    setError(null)
    setDeepResult(null)
    setProgress(null)
    const taskId = idGenerator.generate(`deep-reason-${selectedChapter.id}`)
    setSteering('')
    try {
      const document = semanticDocumentFromText(
        selectedChapter.id,
        htmlToPlain(selectedChapter.content || ''),
        selectedChapter.revision ?? 0,
      )
      const result = await onDeepReasoning(
        {
          taskId,
          document,
          question: '分析当前章节的关键约束、角色动机和下一步剧情风险。',
        },
        { onProgress: setProgress },
      )
      if (token === runToken.current) setDeepResult(result)
    } catch (cause) {
      if (token === runToken.current) setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      if (token === runToken.current) setBusy(false)
    }
  }

  const runDistillation = async () => {
    if (documents.length === 0 || !connected || busy) return
    const token = ++runToken.current
    setBusy(true)
    setError(null)
    setProgress(null)
    try {
      const result = await onDistillationWorkflow(
        {
          taskId: 'project-distillation',
          documents,
          target: 'project',
          fields: ['summary', 'entities', 'events', 'promises'],
        },
        {
          chunkSize: 10,
          checkpoint,
          continueOnError: true,
          onProgress: ({ completedChunks, totalChunks, failedChunks }) =>
            setProgress({
              taskId: 'project-distillation',
              kind: 'narrative.project.distill',
              status: completedChunks === totalChunks ? 'completed' : 'running',
              progress: totalChunks ? completedChunks / totalChunks : 0,
              checkpoint: failedChunks.length ? { step: 'retry-failed-chunks', updatedAt: Date.now() } : undefined,
            }),
        },
      )
      if (token === runToken.current && result) {
        setDistillation(result)
        setCheckpoint(result.checkpoint)
      }
    } catch (cause) {
      if (token === runToken.current) setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      if (token === runToken.current) setBusy(false)
    }
  }

  const steer = async () => {
    const taskId = progress?.taskId
    if (!taskId || !steering.trim()) return
    const accepted = await onSteerTask(taskId, { direction: steering.trim() })
    if (!accepted) setError('Runtime 未接受 steering 输入')
    else setSteering('')
  }

  return (
    <section data-testid="creative-workflows-panel" className="border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[13px] font-medium">
          <Activity className="h-3.5 w-3.5 text-[var(--ink-accent)]" /> 创作工作流
        </div>
        <span className="text-[10px] text-[var(--ink-text-faint)]">{connected ? 'Runtime 已连接' : '离线'}</span>
      </div>
      <div className="mb-2 grid grid-cols-3 gap-1">
        <TabButton active={tab === 'audit'} onClick={() => setTab('audit')}><Activity className="h-3 w-3" />连续性</TabButton>
        <TabButton active={tab === 'reason'} onClick={() => setTab('reason')}><Brain className="h-3 w-3" />深度推理</TabButton>
        <TabButton active={tab === 'distill'} onClick={() => setTab('distill')}><Database className="h-3 w-3" />项目提炼</TabButton>
      </div>
      {tab !== 'distill' && (
        <select aria-label="选择章节" value={selectedChapterId} onChange={(event) => setSelectedChapterId(event.target.value)} className="mb-2 w-full rounded border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] px-2 py-1 text-xs">
          {chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}
        </select>
      )}
      <button type="button" disabled={!connected || busy || (tab !== 'distill' && !selectedChapter)} onClick={() => void (tab === 'audit' ? runAudit() : tab === 'reason' ? runReasoning() : runDistillation())} className="flex w-full items-center justify-center gap-1 rounded bg-[var(--ink-accent)] px-2 py-1.5 text-xs text-white disabled:opacity-40">
        {busy ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Activity className="h-3 w-3" />}
        {busy ? '运行中…' : tab === 'audit' ? '审计当前章节' : tab === 'reason' ? '开始深度推理' : checkpoint ? '继续项目提炼' : '开始项目提炼'}
      </button>
      {tab === 'reason' && progress?.status !== 'completed' && progress?.taskId && (
        <div className="mt-2 flex gap-1">
          <input aria-label="推理 steering" value={steering} onChange={(event) => setSteering(event.target.value)} placeholder="运行中补充方向…" className="min-w-0 flex-1 rounded border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] px-2 py-1 text-xs" />
          <button type="button" onClick={() => void steer()} disabled={!steering.trim()} className="rounded border border-[var(--ink-border)] px-2 py-1 text-xs disabled:opacity-40">引导</button>
        </div>
      )}
      {busy && tab === 'audit' && <button type="button" onClick={() => auditController.current?.abort()} className="mt-2 flex items-center gap-1 text-xs text-rose-500"><Square className="h-3 w-3" />取消审计</button>}
      {progress && <div data-testid="workflow-progress" className="mt-2 text-[11px] text-[var(--ink-text-faint)]">{Math.round((progress.progress ?? 0) * 100)}% · {progress.status}</div>}
      {error && <div role="alert" className="mt-2 text-xs text-rose-500">{error}</div>}
      {tab === 'audit' && auditMarkers.length > 0 && <div data-testid="continuity-findings" className="mt-2 space-y-1">{auditMarkers.map((marker) => <div key={marker.findingId} data-testid="continuity-diagnostic" data-finding-id={marker.findingId} data-location-kind={marker.locationStatus} className="rounded border border-[var(--ink-border)] p-1.5 text-xs"><div><span className="mr-1 font-medium">{marker.severity}</span>{marker.description}</div>{marker.locations.length > 0 ? <div className="mt-1 flex flex-wrap gap-1" aria-label="编辑器诊断位置">{marker.locations.map((location) => <span key={`${marker.findingId}-${location.blockId}`} data-testid="continuity-diagnostic-location" data-block-id={location.blockId} data-semantic-from={location.semanticFrom} data-semantic-to={location.semanticTo} data-editor-from={location.editorFrom} data-editor-to={location.editorTo} className="rounded bg-[var(--ink-bg-elevated)] px-1.5 py-0.5 text-[10px] text-[var(--ink-text-faint)]">编辑器位置 {location.editorFrom}–{location.editorTo}</span>)}</div> : <span data-testid="continuity-diagnostic-unlocated" className="mt-1 inline-block text-[10px] text-[var(--ink-text-faint)]">未定位到编辑器位置</span>}</div>)}</div>}
      {tab === 'audit' && !busy && auditMarkers.length === 0 && <p className="mt-2 text-xs text-[var(--ink-text-faint)]">暂无诊断结果。</p>}
      {tab === 'reason' && deepResult && <div data-testid="deep-reasoning-result" className="mt-2 space-y-1 text-xs"><p>{deepResult.answer}</p>{deepResult.risks.length > 0 && <p className="text-rose-500">风险：{deepResult.risks.join('；')}</p>}</div>}
      {tab === 'distill' && distillation && <div data-testid="distillation-result" className="mt-2 space-y-1 text-xs"><p>{distillation.facts.summary}</p><p className="text-[var(--ink-text-faint)]">{distillation.completedChunks}/{distillation.totalChunks} chunks · 实体 {distillation.facts.entities.length} · 事件 {distillation.facts.events.length} · 伏笔 {distillation.facts.promises.length}</p>{distillation.failedChunks.length > 0 && <p className="text-amber-500">待重试：{distillation.failedChunks.length}</p>}</div>}
    </section>
  )
}

function documentForAudit(chapter: ChapterRecord): SemanticDocument {
  return semanticDocumentFromText(
    chapter.id,
    htmlToPlain(chapter.content || ''),
    chapter.revision ?? 0,
  )
}

const TabButton: FC<{ active: boolean; onClick: () => void; children: ReactNode }> = ({ active, onClick, children }) => (
  <button type="button" onClick={onClick} className={`flex items-center justify-center gap-1 rounded px-1 py-1 text-[11px] ${active ? 'bg-[var(--ink-accent-soft)] text-[var(--ink-accent)]' : 'text-[var(--ink-text-muted)]'}`}>{children}</button>
)
