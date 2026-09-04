import { useState, useEffect, type FC } from "react"
import type { DesktopPluginViewProps } from "../../../types/plugin"
import { indexedDbAftermathRepository } from "../../../adapters/indexedDbAftermathRepository"
import { indexedDbCodexEntityRepository } from "../../../adapters/indexedDbCodexEntityRepository"
import { pluginEventBus } from "../../../core/pluginEventBus"
import { AftermathEngine } from "../engine/AftermathEngine"
import type { AftermathPatchRecord } from "../types"
import { GitPullRequest, Check, X, Sparkles } from "lucide-react"
import { clock } from "../../../adapters/clock"
import { idGenerator } from "../../../adapters/idGenerator"

export const AftermathMasterView: FC<DesktopPluginViewProps> = ({ projectId, onStats }) => {
  const [patches, setPatches] = useState<AftermathPatchRecord[]>([])
  const [chapterText, setChapterText] = useState("林凡在洞府闭关七七四十九日，轰然一声巨响，林凡一举迈入金丹初期！随后他在废墟中搜寻，伸手夺得九幽魔印。")

  const loadPatches = async () => {
    const all = await indexedDbAftermathRepository.getAll(projectId)
    setPatches(all)
  }

  useEffect(() => {
    loadPatches().catch(console.error)
  }, [projectId])

  useEffect(() => {
    onStats?.({
      title: "章后设定回写器",
      wordCount: chapterText.length,
      updatedAt: clock.now(),
    })
  }, [chapterText, onStats])

  const handleScan = async () => {
    const res = AftermathEngine.analyzeChapter(chapterText, "ch-manual", 1, [
      { id: "c1", name: "林凡", category: "character", currentTier: "筑基大圆满" },
      { id: "i1", name: "九幽魔印", category: "item", currentOwner: "神秘魔修" },
    ])

    for (const p of res.patches) {
      const record: AftermathPatchRecord = {
        ...p,
        id: idGenerator.generate("patch"),
        projectId,
        status: "pending",
        createdAt: clock.now(),
      }
      await indexedDbAftermathRepository.save(record)
    }
    await loadPatches()
  }

  const handleResolve = async (id: string, status: "applied" | "rejected") => {
    const patch = patches.find((p) => p.id === id)
    if (!patch) return
    const updated: AftermathPatchRecord = {
      ...patch,
      status,
      appliedAt: status === "applied" ? clock.now() : undefined,
    }
    await indexedDbAftermathRepository.save(updated)

    if (status === "applied") {
      const allEntities = await indexedDbCodexEntityRepository.getAll()
      const targetEntity = allEntities.find(
        (e) => e.name === patch.entityName && e.projectId === projectId
      )

      if (targetEntity) {
        const changeNote = `[设定变更] ${patch.propertyName}: ${patch.beforeValue} -> ${patch.afterValue}`
        const updatedEntity: typeof targetEntity = {
          ...targetEntity,
          attributes: {
            ...targetEntity.attributes,
            [patch.propertyName]: patch.afterValue,
          },
          detailMarkdown: targetEntity.detailMarkdown
            ? `${targetEntity.detailMarkdown}\n${changeNote}`
            : changeNote,
          summary: targetEntity.summary
            ? `${targetEntity.summary.slice(0, 30)}... (${patch.propertyName}:${patch.afterValue})`
            : changeNote,
          updatedAt: clock.now(),
        }
        await indexedDbCodexEntityRepository.save(updatedEntity)
        pluginEventBus.scopedBus(projectId).emit("CODEX_ENTITY_TOUCHED", {
          projectId,
          entityId: targetEntity.id,
          entityName: targetEntity.name,
          category: targetEntity.category || "character",
        })
      }
    }

    await loadPatches()
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
            自动捕获章节完稿中的角色境界突破、宝物易主与人际羁绊，生成世界观同步补丁一键确认
          </p>
        </div>
        <div className="text-xs text-slate-400">
          待审批补丁: <span className="font-bold text-amber-500">{patches.filter((p) => p.status === "pending").length}</span> 处
        </div>
      </div>

      <div className="border rounded-xl p-5 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-3">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">最新完卷章节正文分析试炼:</label>
        <textarea
          className="w-full h-28 p-3 text-xs border rounded font-serif bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800"
          value={chapterText}
          onChange={(e) => setChapterText(e.target.value)}
        />
        <button
          onClick={handleScan}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold flex items-center gap-1.5 transition"
        >
          <Sparkles className="w-4 h-4" /> 扫描章节设定变迁
        </button>
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
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    patch.status === "applied"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                      : patch.status === "rejected"
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                  }`}>
                    {patch.status.toUpperCase()}
                  </span>
                  {patch.status === "pending" && (
                    <>
                      <button
                        onClick={() => handleResolve(patch.id, "applied")}
                        className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleResolve(patch.id, "rejected")}
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
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{patch.afterValue}</span>
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
