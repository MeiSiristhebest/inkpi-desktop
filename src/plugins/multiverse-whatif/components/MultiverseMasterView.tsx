import { matchesSerializedResult } from '../../../domain/serializedResult'
import { useEffect, useMemo, useRef, useState, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import type { MultiverseBranchRecord, MultiverseSimulationResult } from '../types'
import { MultiverseEngine, type BranchEvent, type CanonChapter } from '../engine/MultiverseEngine'
import { indexedDbProjectRepository } from '../../../adapters/indexedDbProjectRepository'
import { indexedDbMultiverseRepository } from '../../../adapters/indexedDbMultiverseRepository'
import { semanticTextFromContent } from '../../../domain/content'
import { redactPluginValue } from '../../../core/pluginDataRedaction'
import { useOptionalPluginHostContext } from '../../../core/pluginHostContext'
import { usePluginAiTask } from '../../../core/usePluginAiTask'
import { PluginAiTaskPanel } from '../../../components/plugins/PluginAiTaskPanel'
import { chapterSaveEvents } from '../../../ports/chapterSaveEvents'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'

interface DraftEvent {
  eventSummary: string
  assumptions: string
  consequences: string
  premiseLink: string
  revision?: number
}
export const MultiverseMasterView: FC<DesktopPluginViewProps> = (props) => (
  <MultiverseSession key={props.projectId} {...props} />
)
const MultiverseSession: FC<DesktopPluginViewProps> = ({ projectId, onStats }) => {
  const host = useOptionalPluginHostContext()
  const [canon, setCanon] = useState<CanonChapter[]>([])
  const [fork, setFork] = useState(1)
  const [premise, setPremise] = useState('')
  const [drafts, setDrafts] = useState<Partial<Record<string, DraftEvent>>>({})
  const [branches, setBranches] = useState<MultiverseBranchRecord[]>([])
  const [workflowRun, setWorkflowRun] = useState<{
    identity: string
    result: MultiverseSimulationResult
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let stale = false
    Promise.all([
      indexedDbProjectRepository.getChaptersByProject(projectId),
      indexedDbProjectRepository.getVolumesByProject?.(projectId) ?? Promise.resolve([]),
      indexedDbMultiverseRepository.getAll(projectId),
    ])
      .then(([chapters, volumes, branches]) => {
        if (stale) return
        const scoped = chapters.filter((c) => c.projectId === projectId)
        const ordered = volumes.length
          ? volumes
              .filter((v) => v.projectId === projectId)
              .sort((a, b) => a.order - b.order)
              .flatMap((v) =>
                scoped.filter((c) => c.volumeId === v.id).sort((a, b) => a.order - b.order),
              )
          : new Set(scoped.map((c) => c.volumeId)).size <= 1
            ? scoped.sort((a, b) => a.order - b.order)
            : []
        const mapped = ordered.map((c, i) => ({
          index: i + 1,
          chapterId: c.id,
          chapterRevision: c.revision,
          title: semanticTextFromContent(`${c.id}-title`, c.title, c.revision),
          summary: semanticTextFromContent(c.id, c.content ?? '', c.revision),
          entities: [],
        }))
        setCanon(mapped)
        setFork((previous) =>
          mapped.some((c) => c.index === previous) ? previous : (mapped[0]?.index ?? 1),
        )
        setBranches(branches.filter((b) => b.projectId === projectId))
        setError(ordered.length !== scoped.length ? '部分章节缺少卷顺序，尚未纳入分支。' : null)
      })
      .catch((cause) => {
        if (!stale) setError(String(cause))
      })
    return () => {
      stale = true
    }
  }, [projectId, attempt])
  useEffect(
    () =>
      chapterSaveEvents.subscribe(({ chapter }) => {
        if (chapter.projectId === projectId)
          setCanon((current) =>
            current.map((c) =>
              c.chapterId === chapter.id
                ? {
                    ...c,
                    title: semanticTextFromContent(
                      `${chapter.id}-title`,
                      chapter.title,
                      chapter.revision,
                    ),
                    summary: semanticTextFromContent(
                      chapter.id,
                      chapter.content ?? '',
                      chapter.revision,
                    ),
                    chapterRevision: chapter.revision,
                  }
                : c,
            ),
          )
      }),
    [projectId],
  )
  useEffect(() => {
    onStats?.({ title: '平行分支计划', wordCount: 0, updatedAt: clock.now() })
  }, [branches, onStats])
  const events: BranchEvent[] = canon
    .filter((c) => c.index >= fork)
    .flatMap((c) => {
      const draft = drafts[c.chapterId!]
      return draft?.eventSummary.trim() && draft.revision === c.chapterRevision
        ? [
            {
              chapterIndex: c.index,
              eventSummary: draft.eventSummary,
              assumptions: draft.assumptions.split('\n').filter(Boolean),
              consequences: draft.consequences.split('\n').filter(Boolean),
              premiseLink: draft.premiseLink,
            },
          ]
        : []
    })
  const semanticPremise = semanticTextFromContent(`${projectId}-divergence-premise`, premise)
  const semanticEvents: BranchEvent[] = events.map((event) => ({
    ...event,
    eventSummary: semanticTextFromContent(
      `${projectId}-${event.chapterIndex}-summary`,
      event.eventSummary,
    ),
    assumptions: event.assumptions?.map((assumption, index) =>
      semanticTextFromContent(`${projectId}-${event.chapterIndex}-assumption-${index}`, assumption),
    ),
    consequences: event.consequences?.map((consequence, index) =>
      semanticTextFromContent(
        `${projectId}-${event.chapterIndex}-consequence-${index}`,
        consequence,
      ),
    ),
    premiseLink:
      event.premiseLink === undefined
        ? undefined
        : semanticTextFromContent(
            `${projectId}-${event.chapterIndex}-premise-link`,
            event.premiseLink,
          ),
  }))
  const semanticInput = {
    divergencePremise: semanticPremise,
    canonChapters: canon,
    forkChapterIndex: fork,
    branchEvents: semanticEvents,
  }
  const identity = JSON.stringify([projectId, canon, fork, premise, events])
  const scopeRef = useRef<string | null>(identity)
  scopeRef.current = identity
  useEffect(
    () => () => {
      scopeRef.current = null
    },
    [],
  )
  const ai = usePluginAiTask('multiverse-whatif', identity)
  const local = useMemo(
    () =>
      canon.length && semanticPremise.trim() && canon.some((c) => c.index === fork)
        ? MultiverseEngine.simulateFork(canon, fork, semanticPremise, semanticEvents)
        : null,
    [identity],
  )
  const active = workflowRun?.identity === identity ? workflowRun.result : local
  const run = async () => {
    if (!local || busy) return
    const expected = local
    const scope = identity
    setBusy(true)
    setError(null)
    try {
      if (!host?.aiAssistant?.isAvailable || !host.aiAssistant.runPluginWorkflow)
        throw new Error('Runtime 工作流未连接。')
      const outcome = await host.aiAssistant.runPluginWorkflow('multiverse-whatif', semanticInput, {
        projectId,
        executionMode: 'explicit',
      })
      if (scopeRef.current !== scope) return
      if (outcome?.status !== 'completed')
        throw new Error(outcome?.status === 'failed' ? outcome.error : '工作流尚未完成。')
      if (!matchesSerializedResult(outcome.result, redactPluginValue(expected)))
        throw new Error('返回的分支与当前前提、来源或作者事件不一致。')
      setWorkflowRun({ identity: scope, result: expected })
      setNotice('Runtime 已构建当前分支计划；后续故事尚需作者或模型推演。')
    } catch (cause) {
      if (scopeRef.current === scope) setError(String(cause))
    } finally {
      if (scopeRef.current !== null) setBusy(false)
    }
  }
  const save = async () => {
    if (!active || busy) return
    setBusy(true)
    try {
      const record = MultiverseEngine.createBranchRecord(
        idGenerator.generate('branch'),
        projectId,
        active,
        clock.now(),
      )
      await indexedDbMultiverseRepository.save(record)
      setBranches((current) => [...current, record])
      setNotice('分支计划已归档。')
      setError(null)
    } catch (cause) {
      setError('保存失败：' + String(cause))
    } finally {
      setBusy(false)
    }
  }
  const update = (
    chapter: CanonChapter,
    field: keyof Omit<DraftEvent, 'revision'>,
    value: string,
  ) =>
    setDrafts((current) => ({
      ...current,
      [chapter.chapterId!]: {
        eventSummary: '',
        assumptions: '',
        consequences: '',
        premiseLink: '',
        ...(current[chapter.chapterId!] ?? {}),
        revision: chapter.chapterRevision,
        [field]: value,
      },
    }))
  return (
    <div className="p-6 space-y-4 h-full overflow-y-auto">
      <h2>平行宇宙因果沙盒推演器 (MultiverseWhatIf)</h2>
      <p>分歧前继承主线；分歧后只记录明确假设和作者给定事件。缺少的后续情节保持未知。</p>
      {!canon.length && <p>请先保存具有明确卷顺序的章节。</p>}
      {error && (
        <p role="alert">
          {error}
          <button onClick={() => setAttempt((n) => n + 1)}>重新读取</button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <select
        aria-label="分歧奇点章节"
        value={fork}
        onChange={(e) => setFork(Number(e.target.value))}
      >
        {canon.map((c) => (
          <option key={c.chapterId} value={c.index}>
            第 {c.index} 章 · {c.title}
          </option>
        ))}
      </select>
      <input
        aria-label="What-If 假设前提"
        placeholder="填写改变的选择或条件"
        value={premise}
        onChange={(e) => setPremise(e.target.value)}
      />
      <button
        disabled={!local || busy || !host?.aiAssistant?.isAvailable}
        onClick={() => void run()}
      >
        {busy ? '运行中…' : '运行 Runtime 分支工作流'}
      </button>
      <button disabled={!active || busy} onClick={() => void save()}>
        归档当前推演分支
      </button>
      {active && (
        <section>
          <h3>双轨因果对照：主线与分支</h3>
          {active.nodes.map((node) => {
            const chapter = canon.find((c) => c.index === node.chapterIndex)!
            const draft = drafts[chapter.chapterId!] ?? {
              eventSummary: '',
              assumptions: '',
              consequences: '',
              premiseLink: '',
            }
            return (
              <article key={chapter.chapterId} className="border rounded p-3 space-y-2">
                <h4>
                  第 {node.chapterIndex} 章 · {node.chapterTitle} · 来源版本{' '}
                  {node.sourceRevision ?? '未知'}
                </h4>
                <details>
                  <summary>主线原文 / 作者梗概</summary>
                  <pre className="whitespace-pre-wrap">{node.canonSummary}</pre>
                </details>
                <p>分支：{node.eventSummary}</p>
                <p>
                  {node.status === 'inherited'
                    ? '继承主线'
                    : node.status === 'hypothesis'
                      ? '假设草稿'
                      : '尚未规划'}
                </p>
                {node.divergenceLevel === null ? (
                  <p>状态差异未知；未提供可比的作者事实集。</p>
                ) : node.stateDifferenceMethod === 'inherited' ? (
                  <p>分歧前来源相同。</p>
                ) : (
                  <p>作者事实集差异：{Math.round(node.divergenceLevel * 100)}%</p>
                )}
                {node.chapterIndex >= fork && (
                  <>
                    <textarea
                      aria-label={'分支事件 ' + node.chapterIndex}
                      placeholder="此章的分支事件（作者草稿）"
                      value={draft.eventSummary}
                      onChange={(e) => update(chapter, 'eventSummary', e.target.value)}
                    />
                    <textarea
                      aria-label={'所需假设 ' + node.chapterIndex}
                      placeholder="所需假设，每行一项"
                      value={draft.assumptions}
                      onChange={(e) => update(chapter, 'assumptions', e.target.value)}
                    />
                    <textarea
                      aria-label={'后续影响 ' + node.chapterIndex}
                      placeholder="需要处理的后续影响，每行一项"
                      value={draft.consequences}
                      onChange={(e) => update(chapter, 'consequences', e.target.value)}
                    />
                    <input
                      aria-label={'前提联系 ' + node.chapterIndex}
                      placeholder="说明此事件如何依赖分歧前提"
                      value={draft.premiseLink}
                      onChange={(e) => update(chapter, 'premiseLink', e.target.value)}
                    />
                    {draft.revision !== undefined && draft.revision !== chapter.chapterRevision && (
                      <p>主线版本已变化，旧草稿尚未纳入本次计划。</p>
                    )}
                  </>
                )}
              </article>
            )
          })}
        </section>
      )}
      {host?.aiAssistant?.isAvailable && (
        <button disabled={!active || ai.isRunning} onClick={() => void ai.run(semanticInput)}>
          AI 前提与后果复核
        </button>
      )}
      <PluginAiTaskPanel view={ai.view} onRetry={ai.retry} />
      <h3>已归档平行宇宙分支 ({branches.length})</h3>
      {branches.map((branch) => (
        <article key={branch.id} className="border p-2">
          <p>
            {branch.name} · 第 {branch.forkChapterIndex} 章
          </p>
          <p>{branch.divergencePremise}</p>
          {branch.schemaVersion !== 2 && <p>旧推演记录的情节与数值未经本轮验证。</p>}
          <button
            onClick={() => {
              setFork(branch.forkChapterIndex)
              setPremise(branch.divergencePremise)
              setDrafts(
                Object.fromEntries(
                  branch.nodes
                    .filter((n) => n.status === 'hypothesis' && n.sourceChapterId)
                    .map((n) => [
                      n.sourceChapterId!,
                      {
                        eventSummary: n.eventSummary,
                        assumptions: n.assumptions?.join('\n') ?? '',
                        consequences: n.butterflyEffects.join('\n'),
                        premiseLink: n.premiseLink ?? '',
                        revision: n.sourceRevision,
                      },
                    ]),
                ),
              )
              setNotice('已载入归档假设，按当前主线版本重新核对。')
            }}
          >
            载入计划
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void indexedDbMultiverseRepository
                .delete(branch.id)
                .then(() => setBranches((current) => current.filter((b) => b.id !== branch.id)))
                .catch((cause) => setError(String(cause)))
            }
          >
            删除
          </button>
        </article>
      ))}
    </div>
  )
}
