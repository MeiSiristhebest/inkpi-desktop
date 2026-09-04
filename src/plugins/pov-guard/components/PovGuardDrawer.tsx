import { useState, useEffect, type FC } from "react"
import type { DesktopPluginDrawerProps } from "../../../types/plugin"
import { indexedDbPovGuardRepository } from "../../../adapters/indexedDbPovGuardRepository"
import { PovGuardEngine } from "../engine/PovGuardEngine"
import type { PovAnalysisResult } from "../types"
import { ShieldAlert, AlertTriangle, EyeOff } from "lucide-react"

export const PovGuardDrawer: FC<DesktopPluginDrawerProps> = ({ projectId, currentText }) => {
  const [result, setResult] = useState<PovAnalysisResult | null>(null)

  useEffect(() => {
    if (!currentText || currentText.trim().length === 0) {
      setResult(null)
      return
    }

    const loadAndAudit = async () => {
      const snapshots = await indexedDbPovGuardRepository.getAll(projectId)
      const latestSnapshot = snapshots[0]
      const povChar = latestSnapshot?.povCharacterName || "林凡"
      const povMode = latestSnapshot?.povMode || "third_limited"

      const auditRes = PovGuardEngine.analyze(currentText, {
        povCharacter: povChar,
        povMode,
        allCharacters: latestSnapshot?.allowedCharacters || [
          { characterId: "c1", characterName: povChar, knownSecretIds: [] },
          { characterId: "c2", characterName: "苏雨柔", knownSecretIds: ["s-poison"] },
          { characterId: "c3", characterName: "黑衣人", knownSecretIds: ["s-secret"] },
        ],
        secrets: latestSnapshot?.secrets || [
          {
            id: "s-poison",
            title: "噬灵绝命丹",
            confidentialityLevel: "top_secret",
            originChapterOrder: 1,
            holders: ["苏雨柔"],
          },
        ],
      })
      setResult(auditRes)
    }

    loadAndAudit().catch(console.error)
  }, [projectId, currentText])

  return (
    <div className="p-3 space-y-3 text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <span className="font-bold flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
          <ShieldAlert className="w-4 h-4" /> POV 心智防火墙
        </span>
        {result && (
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500">
            {result.povCharacter} ({result.povMode})
          </span>
        )}
      </div>

      {!result || (!result.headHoppingCount && !result.leakageCount) ? (
        <div className="p-3 rounded bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-center">
          ✓ 心智视界纯正，未检测到跳视角或全知泄漏
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <div className="text-slate-400 text-[10px]">视角游移 (Head-Hopping)</div>
              <div className="text-sm font-bold text-amber-600">{result.headHoppingCount} 处</div>
            </div>
            <div className="p-2 rounded bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
              <div className="text-slate-400 text-[10px]">全知泄漏 (Omniscience)</div>
              <div className="text-sm font-bold text-rose-600">{result.leakageCount} 处</div>
            </div>
          </div>

          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {result.violations.map((v) => (
              <div
                key={v.id}
                className="p-2 rounded border bg-white dark:bg-slate-800 border-amber-200 dark:border-amber-900 space-y-1"
              >
                <div className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                  {v.type === "head_hopping" ? <AlertTriangle className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  <span>{v.type === "head_hopping" ? "越界偷窥心理" : "未解锁情报泄露"}</span>
                </div>
                <div className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                  "{v.snippet}"
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
