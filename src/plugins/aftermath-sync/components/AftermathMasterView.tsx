import { useState, useEffect, useCallback, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { indexedDbAftermathRepository } from '../../../adapters/indexedDbAftermathRepository'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'
import { codexApplicationService } from '../../../services/domainApplicationServices'
import { pluginEventBus } from '../../../core/pluginEventBus'
import { reviewStatusLabel } from '../../../ai/proposals/proposalVocabulary'
import { AftermathEngine } from '../engine/AftermathEngine'
import type { AftermathPatchRecord, EntityCandidate } from '../types'
import type { CodexEntity } from '../../living-codex/types'
import { GitPullRequest, Check, X, Sparkles } from 'lucide-react'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'

// 只读设定库里已有的键，口径与 consistency-sentinel / living-codex 的 Adapters 一致。
const toEntityCandidate = (entity: CodexEntity): EntityCandidate => ({
  id: entity.id,
  name: entity.name,
  category: entity.category as 'character' | 'item',
  currentTier: (entity.attributes?.realm as string) || (entity.attributes?.境界 as string),
  currentOwner:
    (entity.attributes?.['当前持有者'] as string) ||
    entity.relations?.find((r) => r.relationType === '持有者')?.targetName,
})

// propertyName 只是给作者看的标签：批准时必须写回 toEntityCandidate 读取的键，否则同一条变更会被反复提案。
const ATTRIBUTE_WRITE_KEYS: Record<string, string> = {
  战力境界: 'realm',
  所有权归属: '当前持有者',
}

/** 「谁发生了什么变迁」的判定口径：正文反复扫描必须落到同一个键，否则列表会被重复补丁刷满。 */
const patchIdentity = (p: {
  entityId: string
  changeType: string
  propertyName: string
  afterValue: string
}) => `${p.entityId}|${p.changeType}|${p.propertyName}|${p.afterValue}`

export const AftermathMasterView: FC<DesktopPluginViewProps> = (props) => (
  <ProjectAftermathView key={props.projectId} {...props} />
)
const ProjectAftermathView: FC<DesktopPluginViewProps> = ({ projectId, onStats }) => {
  const [patches, setPatches] = useState<AftermathPatchRecord[]>([])
  // 空白起步：示例正文会被当成作者已写的字数上报（INV-09）。
  const [chapterText, setChapterText] = useState('')
  const [roster, setRoster] = useState<EntityCandidate[]>([])
  const [scanNotice, setScanNotice] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
  const [confirmedValues, setConfirmedValues] = useState<Record<string, string>>({})

  const loadPatches = async () => {
    const all = await indexedDbAftermathRepository.getAll(projectId)
    setPatches(all)
  }

  const loadRoster = useCallback(async () => {
    const all = await indexedDbCodexEntityRepository.getAll()
    // 名单只取本书设定库里真实存在的角色与物品，绝不现场编一个「未指定角色」。
    setRoster(
      all
        .filter((e) => e.projectId === projectId && ['character', 'item'].includes(e.category))
        .map(toEntityCandidate),
    )
  }, [projectId])

  useEffect(() => {
    loadPatches().catch(() => setError('提案读取失败，请重试。'))
    loadRoster().catch(() => setError('设定名单读取失败，请重试。'))
  }, [projectId])

  // §P2.12：总线注释里的 codexApplicationService -> aftermath-sync 必须真的连通。作者可能在设定库
  // 面板改完实体就切回来扫描，对照名单停在挂载那一刻的快照上就会把已录的实体再提案一遍。
  useEffect(() => {
    return pluginEventBus.scopedBus(projectId).on('CODEX_ENTITY_TOUCHED', () => {
      loadRoster().catch(() => setError('设定名单刷新失败，请重试。'))
    })
  }, [projectId, loadRoster])

  useEffect(() => {
    onStats?.({
      title: '章后设定回写器',
      wordCount: chapterText.length,
      updatedAt: clock.now(),
    })
  }, [chapterText, onStats])

  const handleScan = async () => {
    if (busy) return
    if (!chapterText.trim()) {
      setScanNotice('未输入正文：粘贴你自己写完的章节正文后再扫描')
      return
    }
    if (roster.length === 0) {
      setScanNotice('设定库暂无可对照实体：先去设定库录入角色或物品，本面板不替你虚构名单')
      return
    }
    setScanNotice(null)
    setBusy(true)
    try {
      // 'ch-manual' 表示「从本面板手工扫描」；没有真实章序就不传，补丁记录里该字段本就是可选的。
      const res = AftermathEngine.analyzeChapter(chapterText, 'ch-manual', undefined, roster)

      // 同一份正文反复扫描得到的是同一批变迁。以前每次都发一个新 id 存进去，于是同一条回写在
      // 审阅列表里刷出好几份，批准其中一份后其余几份还挂着「待审阅」。
      const existing = await indexedDbAftermathRepository.getAll(projectId)
      const seen = new Set(existing.map(patchIdentity))
      const fresh = res.patches.filter((p) => {
        const key = patchIdentity(p)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      for (const p of fresh) {
        const record: AftermathPatchRecord = {
          ...p,
          id: idGenerator.generate('patch'),
          projectId,
          status: 'pending',
          createdAt: clock.now(),
        }
        await indexedDbAftermathRepository.save(record)
      }
      if (res.patches.length === 0) {
        setScanNotice('扫描完成：正文里没有命中可对照实体的状态变迁')
      } else if (fresh.length === 0) {
        setScanNotice(`扫描完成：${res.patches.length} 条变迁此前已经记录过，列表保持原样`)
      } else {
        const skipped = res.patches.length - fresh.length
        setScanNotice(
          `扫描完成：新增 ${fresh.length} 条待审阅补丁` +
            (skipped > 0 ? `（另有 ${skipped} 条已记录过，未重复添加）` : ''),
        )
      }
      await loadPatches()
      setError('')
    } catch {
      setError('提案保存或读取失败，请重试。已保存的提案可重新读取。')
    } finally {
      setBusy(false)
    }
  }

  const handleResolve = async (id: string, status: 'applied' | 'rejected') => {
    if (busy) return
    setBusy(true)
    try {
      const patch = await indexedDbAftermathRepository.get(id)
      if (!patch || patch.projectId !== projectId || patch.status !== 'pending')
        throw new Error('提案不存在或已经处理，请刷新。')
      const reviewNote = reviewNotes[id]?.trim()
      const value = confirmedValues[id]?.trim() ?? patch.afterValue
      if (status === 'applied' && (!reviewNote || !value))
        throw new Error('请填写作者确认说明和设定值。')
      if (status === 'applied' && patch.sourceText && patch.sourceText !== chapterText)
        throw new Error('扫描后输入已变化，请恢复提案输入并重新核对。')
      const updated: AftermathPatchRecord = {
        ...patch,
        status,
        afterValue: status === 'applied' ? value : patch.afterValue,
        authorReviewNote: status === 'applied' ? reviewNote : undefined,
        appliedAt: status === 'applied' ? clock.now() : undefined,
      }
      if (status === 'applied') {
        const allEntities = await indexedDbCodexEntityRepository.getAll()
        const targetEntity = allEntities.find(
          (e) => e.id === patch.entityId && e.projectId === projectId,
        )

        if (!targetEntity) throw new Error('目标实体已删除，请重新扫描。')
        const key = ATTRIBUTE_WRITE_KEYS[patch.propertyName] ?? patch.propertyName
        const currentValue =
          patch.propertyName === '战力境界'
            ? toEntityCandidate(targetEntity).currentTier
            : patch.propertyName === '所有权归属'
              ? toEntityCandidate(targetEntity).currentOwner
              : targetEntity.attributes[key]
        if (
          (currentValue ?? (patch.changeType === 'new_relation' ? '未记录' : '未知')) !==
          patch.beforeValue
        )
          throw new Error('目标设定与扫描时不同，请重新扫描。')
        {
          const changeNote = `[作者确认变更] ${patch.propertyName}: ${patch.beforeValue} -> ${value}\n确认说明：${reviewNote}\n原文：${patch.evidenceSnippet}`
          const updatedEntity: typeof targetEntity = {
            ...targetEntity,
            attributes: {
              ...targetEntity.attributes,
              [key]: value,
            },
            detailMarkdown: targetEntity.detailMarkdown
              ? `${targetEntity.detailMarkdown}\n${changeNote}`
              : changeNote,
            updatedAt: clock.now(),
          }
          await codexApplicationService.saveEntity(
            updatedEntity,
            'author-confirmed',
            [
              {
                store: 'aftermathPatches',
                key: id,
                operation: 'upsert',
                value: updated,
                expected: patch,
              },
            ],
            targetEntity,
          )
        }
      } else await indexedDbAftermathRepository.save(updated)

      // 对照名单也要重读：留着批准前的旧境界，下一次扫描会把刚批准掉的变更再提案一遍。
      await Promise.all([loadPatches(), loadRoster()])
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '回写失败，请重试。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto text-slate-800 dark:text-slate-100">
      {error && <p role="alert">{error}</p>}
      <div className="flex items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <GitPullRequest className="w-6 h-6 text-indigo-500" />
            <span>章后桥段设定回写器 (AftermathSync)</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            对照本书设定库里的实体，从你粘贴的正文中捕获角色境界突破、宝物易主与人际羁绊，生成待审阅补丁
          </p>
        </div>
        <div className="text-xs text-slate-400">
          待审阅补丁:{' '}
          <span className="font-bold text-amber-500">
            {patches.filter((p) => p.status === 'pending').length}
          </span>{' '}
          处
        </div>
      </div>

      <div className="border rounded-xl p-5 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-3">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          最新完卷章节正文分析试炼:
        </label>
        <textarea
          className="w-full h-28 p-3 text-xs border rounded font-serif bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800"
          value={chapterText}
          onChange={(e) => setChapterText(e.target.value)}
          placeholder="粘贴你写完的章节正文；扫描只对照本书设定库里已有的实体"
        />
        <div className="flex items-center justify-between gap-3">
          <span
            className={`text-[11px] ${
              roster.length === 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            {roster.length === 0
              ? '设定库暂无可对照实体'
              : `对照名单：本书设定库中的 ${roster.length} 个角色/物品`}
          </span>
          <button
            onClick={handleScan}
            disabled={busy}
            aria-busy={busy}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold flex items-center gap-1.5 transition"
          >
            <Sparkles className="w-4 h-4" /> 扫描章节设定变迁
          </button>
        </div>
        {scanNotice && (
          <p className="text-[11px] text-indigo-600 dark:text-indigo-400">{scanNotice}</p>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold">设定回写提议列表</h3>
        <p className="text-[11px] text-slate-400">
          采纳会立即改写设定库里的实体，本面板不提供撤销；不确定的补丁先驳回，改好正文再扫一次。
        </p>
        {patches.length === 0 ? (
          <div className="p-8 border rounded-xl text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-900">
            暂无待审阅的设定回写补丁
          </div>
        ) : (
          patches.map((patch) => (
            <div
              key={patch.id}
              className="p-4 border rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-2 shadow-sm"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <span>[{patch.changeType.toUpperCase()}]</span>
                  <span>{patch.entityName}</span>
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      patch.status === 'applied'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                        : patch.status === 'rejected'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                    }`}
                  >
                    {reviewStatusLabel(patch.status)}
                  </span>
                  {patch.status === 'pending' && (
                    <>
                      <button
                        aria-label="采纳回写"
                        disabled={busy || !reviewNotes[patch.id]?.trim()}
                        onClick={() => handleResolve(patch.id, 'applied')}
                        className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        aria-label="忽略回写"
                        disabled={busy}
                        onClick={() => handleResolve(patch.id, 'rejected')}
                        className="p-1 rounded bg-rose-600 text-white hover:bg-rose-700"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                <span>{patch.propertyName}:</span>
                <span className="line-through text-slate-400">{patch.beforeValue}</span>
                <span>➔</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {patch.afterValue}
                </span>
              </div>

              <div className="text-[11px] font-mono text-slate-500 bg-slate-50 dark:bg-slate-950 p-2 rounded">
                依据: "{patch.evidenceSnippet}"
              </div>
              <p className="text-xs">
                {patch.evidenceStatus === 'candidate'
                  ? '字面提取候选，须作者核对语境'
                  : '旧提案：原始输入与语义尚未复核'}
              </p>
              {patch.status === 'pending' && (
                <div className="space-y-1 text-xs">
                  <label className="block">
                    确认后的设定值
                    <input
                      aria-label={`确认后的设定值-${patch.id}`}
                      disabled={busy}
                      className="w-full border bg-transparent"
                      value={confirmedValues[patch.id] ?? patch.afterValue}
                      onChange={(event) =>
                        setConfirmedValues((values) => ({
                          ...values,
                          [patch.id]: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="block">
                    作者确认说明
                    <input
                      aria-label={`作者确认说明-${patch.id}`}
                      disabled={busy}
                      className="w-full border bg-transparent"
                      value={reviewNotes[patch.id] ?? ''}
                      onChange={(event) =>
                        setReviewNotes((notes) => ({ ...notes, [patch.id]: event.target.value }))
                      }
                    />
                  </label>
                  {patch.sourceText && patch.sourceText !== chapterText && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setChapterText(patch.sourceText!)}
                    >
                      恢复提案输入
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
