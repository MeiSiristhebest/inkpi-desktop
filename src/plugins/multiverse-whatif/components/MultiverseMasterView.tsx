import { useState, useEffect, type FC } from "react"
import type { DesktopPluginViewProps } from "../../../types/plugin"
import { indexedDbMultiverseRepository } from "../../../adapters/indexedDbMultiverseRepository"
import { MultiverseEngine } from "../engine/MultiverseEngine"
import type { MultiverseBranchRecord, MultiverseSimulationResult } from "../types"
import { GitFork, GitBranch, Send, Trash2, ArrowRight } from "lucide-react"
import { clock } from "../../../adapters/clock"
import { idGenerator } from "../../../adapters/idGenerator"

const DEFAULT_CANON_CHAPTERS = [
  { index: 12, title: "第12章 太虚秘境", summary: "主角林凡进入宗门禁地太虚秘境争夺造化", entities: ["林凡", "苏清月"] },
  { index: 13, title: "第13章 阴阳煞阵", summary: "林凡偶遇被黑煞门围攻的青玄宗圣女苏清月", entities: ["林凡", "苏清月", "黑煞门长老"] },
  { index: 14, title: "第14章 舍身相救", summary: "危急关头林凡施展禁术击退强敌，救下垂死的苏清月，获得青玄宗结盟青睐", entities: ["林凡", "苏清月"] },
  { index: 15, title: "第15章 宗门大比", summary: "在苏清月圣药相助下，林凡在宗门大比中一举夺魁碾压赵家仇敌", entities: ["林凡", "赵家长老"] },
  { index: 16, title: "第16章 踏平赵家", summary: "主角携手青玄宗大势彻底覆灭赵家，扬名东荒", entities: ["林凡", "赵家"] },
]

export const MultiverseMasterView: FC<DesktopPluginViewProps> = ({ projectId, onStats }) => {
  const [forkIndex, setForkIndex] = useState<number>(14)
  const [premise, setPremise] = useState<string>("如果主角在第14章没有现身救下女配苏清月，选择暗中取宝独善其身")
  const [branches, setBranches] = useState<MultiverseBranchRecord[]>([])
  const [activeBranch, setActiveBranch] = useState<MultiverseSimulationResult | null>(null)

  const loadBranches = async () => {
    const list = await indexedDbMultiverseRepository.getAll(projectId)
    setBranches(list)
  }

  useEffect(() => {
    loadBranches().catch(console.error)
  }, [projectId])

  useEffect(() => {
    onStats?.({
      title: "平行宇宙因果沙盒",
      wordCount: branches.length,
      updatedAt: clock.now(),
    })
  }, [branches, onStats])

  // 执行实时分支因果模拟
  useEffect(() => {
    const sim = MultiverseEngine.simulateFork(DEFAULT_CANON_CHAPTERS, forkIndex, premise)
    setActiveBranch(sim)
  }, [forkIndex, premise])

  const handleSaveBranch = async () => {
    if (!activeBranch) return
    const record: MultiverseBranchRecord = MultiverseEngine.createBranchRecord(
      idGenerator.generate("branch"),
      projectId,
      activeBranch,
      clock.now()
    )
    await indexedDbMultiverseRepository.save(record)
    await loadBranches()
  }

  const handleDeleteBranch = async (id: string) => {
    await indexedDbMultiverseRepository.delete(id)
    await loadBranches()
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto text-slate-800 dark:text-slate-100">
      <div className="flex items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <GitFork className="w-6 h-6 text-purple-500" />
            <span>平行宇宙因果沙盒推演器 (MultiverseWhatIf)</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            设定剧情分支分歧奇点，推演“如果主角未救女配/错失机缘”的因果涟漪与蝴蝶效应
          </p>
        </div>
        <button
          type="button"
          onClick={handleSaveBranch}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded-lg font-medium shadow-sm transition"
        >
          <Send className="w-3.5 h-3.5" />
          <span>归档当前推演分支</span>
        </button>
      </div>

      {/* 分支控制输入 */}
      <div className="p-4 rounded-xl border bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <label className="text-xs font-bold text-slate-500 block mb-1">分歧奇点章节 (Fork Point):</label>
          <select
            value={forkIndex}
            onChange={(e) => setForkIndex(Number(e.target.value))}
            className="w-full p-2 border rounded text-xs bg-white dark:bg-slate-950"
          >
            {DEFAULT_CANON_CHAPTERS.map((ch) => (
              <option key={ch.index} value={ch.index}>
                {ch.title}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="text-xs font-bold text-slate-500 block mb-1">“What-If” 假设前提假设词:</label>
          <input
            type="text"
            value={premise}
            onChange={(e) => setPremise(e.target.value)}
            className="w-full p-2 border rounded text-xs bg-white dark:bg-slate-950"
            placeholder="例如：如果主角在第14章没有救下女配..."
          />
        </div>
      </div>

      {/* 主宇宙 vs 平行宇宙双轨因果对照 */}
      {activeBranch && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <GitBranch className="w-4 h-4 text-purple-500" />
            <span>双轨因果对照：主宇宙 (Canon) vs 平行宇宙 (What-If)</span>
          </h3>

          <div className="space-y-3">
            {DEFAULT_CANON_CHAPTERS.map((canon, idx) => {
              const branch = activeBranch.nodes[idx]
              const isFork = canon.index === forkIndex
              const isPost = canon.index > forkIndex

              return (
                <div
                  key={canon.index}
                  className={`p-4 rounded-xl border grid grid-cols-1 md:grid-cols-2 gap-4 text-xs transition ${
                    isFork
                      ? "border-purple-400 bg-purple-50/40 dark:bg-purple-950/20"
                      : isPost
                      ? "border-slate-300 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
                  }`}
                >
                  {/* 左侧：原著主宇宙 */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between font-bold text-slate-500">
                      <span>{canon.title} · 主宇宙</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600">
                        Canon
                      </span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300">{canon.summary}</p>
                  </div>

                  {/* 右侧：推演分支宇宙 */}
                  <div className="space-y-1 border-t md:border-t-0 md:border-l md:pl-4 border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                        <ArrowRight className="w-3.5 h-3.5" />
                        {branch?.chapterTitle}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        (branch?.divergenceLevel || 0) >= 0.7
                          ? "bg-rose-100 dark:bg-rose-950 text-rose-600"
                          : (branch?.divergenceLevel || 0) > 0
                          ? "bg-purple-100 dark:bg-purple-950 text-purple-600"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                      }`}>
                        偏离度: {Math.round((branch?.divergenceLevel || 0) * 100)}%
                      </span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-200">{branch?.eventSummary}</p>
                    {branch?.butterflyEffects && branch.butterflyEffects.length > 0 && (
                      <div className="text-[11px] text-purple-600 dark:text-purple-300 font-medium">
                        {branch.butterflyEffects.join("；")}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 已归档历史分支库 */}
      {branches.length > 0 && (
        <div className="border-t pt-4 border-slate-200 dark:border-slate-800 space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            已归档平行宇宙分支 ({branches.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {branches.map((b) => (
              <div
                key={b.id}
                className="p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs space-y-2 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between font-bold text-purple-600 dark:text-purple-400 mb-1">
                    <span>{b.name}</span>
                    <span className="text-[10px] text-slate-400">第 {b.forkChapterIndex} 章奇点</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">{b.divergencePremise}</p>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400">
                    {new Date(b.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteBranch(b.id)}
                    className="text-rose-500 hover:text-rose-600 transition flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> 删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

