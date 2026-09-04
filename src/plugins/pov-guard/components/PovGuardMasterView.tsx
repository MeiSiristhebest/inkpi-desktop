import { useState, useEffect, type FC } from "react"
import type { DesktopPluginViewProps } from "../../../types/plugin"
import { indexedDbPovGuardRepository } from "../../../adapters/indexedDbPovGuardRepository"
import { PovGuardEngine } from "../engine/PovGuardEngine"
import type { PovViolation } from "../types"
import { ShieldAlert, AlertTriangle, EyeOff, Play } from "lucide-react"
import { clock } from "../../../adapters/clock"

export const PovGuardMasterView: FC<DesktopPluginViewProps> = ({ projectId, onStats }) => {
  const [currentText, setCurrentText] = useState("")
  const [povChar, setPovChar] = useState("林凡")
  const [povMode, setPovMode] = useState<"first_person" | "third_limited" | "third_objective" | "omniscient">("third_limited")
  const [violations, setViolations] = useState<PovViolation[]>([])
  const [isAuditing, setIsAuditing] = useState(false)

  useEffect(() => {
    onStats?.({
      title: "POV 心智防火墙",
      wordCount: currentText.length,
      updatedAt: clock.now(),
    })
  }, [currentText, onStats])

  const runAudit = async () => {
    setIsAuditing(true)
    const snapshots = await indexedDbPovGuardRepository.getAll(projectId)
    const latestSnapshot = snapshots[0]

    const result = PovGuardEngine.analyze(currentText, {
      povCharacter: povChar,
      povMode,
      allCharacters: latestSnapshot?.allowedCharacters || [
        { characterId: "c1", characterName: povChar, knownSecretIds: [] },
        { characterId: "c2", characterName: "反派首领", knownSecretIds: ["sec-1"] },
        { characterId: "c3", characterName: "师尊", knownSecretIds: ["sec-2"] },
      ],
      secrets: latestSnapshot?.secrets || [
        { id: "sec-1", title: "噬灵魔典", confidentialityLevel: "top_secret", originChapterOrder: 1, holders: ["反派首领"] },
        { id: "sec-2", title: "九霄禁术", confidentialityLevel: "secret", originChapterOrder: 3, holders: ["师尊"] },
      ],
    })
    setViolations(result.violations)
    setIsAuditing(false)
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto text-slate-800 dark:text-slate-100">
      <div className="flex items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-indigo-500" />
            <span>POV 心智防火墙 (PovGuard)</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            基于心智理论(Theory of Mind)与模态逻辑，阻断非受控跳视角(Head-Hopping)与全知视角泄漏
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-slate-500">主视角角色:</span>
            <input
              className="border px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              value={povChar}
              onChange={(e) => setPovChar(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-slate-500">视角模式:</span>
            <select
              className="border px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              value={povMode}
              onChange={(e) => setPovMode(e.target.value as any)}
            >
              <option value="third_limited">第三人称受限 (Third Limited)</option>
              <option value="first_person">第一人称 (First Person)</option>
              <option value="third_objective">第三人称客观 (Objective)</option>
              <option value="omniscient">全知视角 (Omniscient)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col space-y-2">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">待审正文:</label>
          <textarea
            className="w-full h-96 p-3 text-sm border rounded font-serif resize-none bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
            placeholder="输入章节正文，点击审校执行视角违规与心智越界扫描..."
            value={currentText}
            onChange={(e) => setCurrentText(e.target.value)}
          />
          <button
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-semibold flex items-center justify-center gap-2 transition"
            onClick={runAudit}
            disabled={isAuditing || !currentText.trim()}
          >
            <Play className="w-4 h-4" />
            {isAuditing ? "正在执行心智透视扫描..." : "执行 POV 防火墙审校"}
          </button>
        </div>

        <div className="flex flex-col space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">违规阻断列表:</label>
            <span className="text-xs text-slate-500">检出 {violations.length} 处越界</span>
          </div>
          <div className="w-full h-96 overflow-y-auto border rounded p-3 space-y-3 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-xs">
            {violations.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400">
                心智视界纯正，未检测到视角越界或信息泄露
              </div>
            ) : (
              violations.map((v) => (
                <div
                  key={v.id}
                  className="p-3 border rounded bg-white dark:bg-slate-800 space-y-1.5 shadow-sm border-amber-300 dark:border-amber-700"
                >
                  <div className="flex items-center justify-between font-bold text-amber-600 dark:text-amber-400">
                    <span className="flex items-center gap-1.5">
                      {v.type === "head_hopping" ? <AlertTriangle className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      {v.type === "head_hopping" ? "🚨 视角越界(Head-Hopping)" : "🔒 全知信息泄漏"}
                    </span>
                    <span className="text-slate-400 font-normal">第 {v.paragraphIndex + 1} 段</span>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950/40 p-2 rounded font-mono text-slate-700 dark:text-slate-300">
                    "{v.snippet}"
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">{v.explanation}</p>
                  {v.suggestedFix && (
                    <p className="text-indigo-600 dark:text-indigo-400 font-medium">
                      💡 修复建议: {v.suggestedFix}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
