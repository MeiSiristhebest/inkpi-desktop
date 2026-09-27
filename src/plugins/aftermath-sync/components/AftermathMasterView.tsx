import { useState, useEffect, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import { indexedDbAftermathRepository } from '../../../adapters/indexedDbAftermathRepository'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'
import { codexApplicationService } from '../../../services/domainApplicationServices'
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

export const AftermathMasterView: FC<DesktopPluginViewProps> = ({ projectId, onStats }) => {
  const [patches, setPatches] = useState<AftermathPatchRecord[]>([])
  // 空白起步：示例正文会被当成作者已写的字数上报（INV-09）。
  const [chapterText, setChapterText] = useState('')
  const [roster, setRoster] = useState<EntityCandidate[]>([])
  const [scanNotice, setScanNotice] = useState<string | null>(null)

  const loadPatches = async () => {
    const all = await indexedDbAftermathRepository.getAll(projectId)
    setPatches(all)
  }

  const loadRoster = async () => {
    const all = await indexedDbCodexEntityRepository.getAll()
    // 名单只取本书设定库里真实存在的角色与物品，绝不现场编一个「未指定角色」。
    setRoster(
      all
        .filter((e) => e.projectId === projectId && ['character', 'item'].includes(e.category))
        .map(toEntityCandidate),
    )
  }

  useEffect(() => {
    loadPatches().catch(console.error)
    loadRoster().catch(console.error)
  }, [projectId])

  useEffect(() => {
    onStats?.({
      title: '章后设定回写器',
      wordCount: chapterText.length,
      updatedAt: clock.now(),
    })
  }, [chapterText, onStats])

  const handleScan = async () => {
    if (!chapterText.trim()) {
      setScanNotice('未输入正文：粘贴你自己写完的章节正文后再扫描')
      return
    }
    if (roster.length === 0) {
      setScanNotice('设定库暂无可对照实体：先去设定库录入角色或物品，本面板不替你虚构名单')
      return
    }
    setScanNotice(null)

    // 'ch-manual' 表示「从本面板手工扫描」；没有真实章序就不传，补丁记录里该字段本就是可选的。
    const res = AftermathEngine.analyzeChapter(chapterText, 'ch-manual', undefined, roster)

    for (const p of res.patches) {
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
    } else {
      setScanNotice(`扫描完成：新增 ${res.patches.length} 条待确认补丁`)
    }
    await loadPatches()
  }

  const handleResolve = async (id: string, status: 'applied' | 'rejected') => {
    const patch = patches.find((p) => p.id === id)
    if (!patch) return
    const updated: AftermathPatchRecord = {
      ...patch,
      status,
      appliedAt: status === 'applied' ? clock.now() : undefined,
    }
    await indexedDbAftermathRepository.save(updated)

    if (status === 'applied') {
      const allEntities = await indexedDbCodexEntityRepository.getAll()
      const targetEntity = allEntities.find(
        (e) => e.name === patch.entityName && e.projectId === projectId,
      )

      if (targetEntity) {
        const changeNote = `[设定变更] ${patch.propertyName}: ${patch.beforeValue} -> ${patch.afterValue}`
        const updatedEntity: typeof targetEntity = {
          ...targetEntity,
          attributes: {
            ...targetEntity.attributes,
            [ATTRIBUTE_WRITE_KEYS[patch.propertyName] ?? patch.propertyName]: patch.afterValue,
          },
          detailMarkdown: targetEntity.detailMarkdown
            ? `${targetEntity.detailMarkdown}\n${changeNote}`
            : changeNote,
          summary: targetEntity.summary
            ? `${targetEntity.summary.slice(0, 30)}... (${patch.propertyName}:${patch.afterValue})`
            : changeNote,
          updatedAt: clock.now(),
        }
        await codexApplicationService.saveEntity(updatedEntity, 'author-confirmed')
      }
    }

    // 对照名单也要重读：留着批准前的旧境界，下一次扫描会把刚批准掉的变更再提案一遍。
    await Promise.all([loadPatches(), loadRoster()])
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto text-slate-800 dark:text-slate-100">
      <div className="flex items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <GitPullRequest className="w-6 h-6 text-indigo-500" />
            <span>章后桥段设定回写器 (AftermathSync)</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            对照本书设定库里的实体，从你粘贴的正文中捕获角色境界突破、宝物易主与人际羁绊，生成待确认补丁
          </p>
        </div>
        <div className="text-xs text-slate-400">
          待审批补丁:{' '}
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
        {patches.length === 0 ? (
          <div className="p-8 border rounded-xl text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-900">
            暂无待审批的设定回写补丁
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
                    {patch.status.toUpperCase()}
                  </span>
                  {patch.status === 'pending' && (
                    <>
                      <button
                        aria-label="批准回写"
                        onClick={() => handleResolve(patch.id, 'applied')}
                        className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        aria-label="驳回回写"
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
            </div>
          ))
        )}
      </div>
    </div>
  )
}
