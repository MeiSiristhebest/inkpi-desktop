import { useState, useEffect, type FC } from "react"
import type { DesktopPluginViewProps } from "../../../types/plugin"
import { indexedDbAuthorOpsRepository } from "../../../adapters/indexedDbAuthorOpsRepository"
import { AuthorOpsEngine } from "../engine/AuthorOpsEngine"
import type { AuthorOpsProfileRecord, MetricLogEntry } from "../types"
import { TrendingDown, Award, UserCheck, AlertTriangle, Save } from "lucide-react"
import { clock } from "../../../adapters/clock"

export const AuthorOpsMasterView: FC<DesktopPluginViewProps> = ({ projectId, onStats }) => {
  const [profile, setProfile] = useState<AuthorOpsProfileRecord>({
    projectId,
    authorName: "InkPi Author",
    bio: "专注于极致心流商业网络文学创作。",
    works: [
      { title: "万古天帝诀", genre: "玄幻修真", totalWords: 420000, status: "serialized" },
      { title: "赛博大明1644", genre: "科幻历史", totalWords: 1500000, status: "finished" }
    ],
    supportChannels: {
      customUrl: "https://afdian.com/a/inkpi",
    },
    metricLogs: [
      { date: "09-01", chasingReadCount: 12000, averageSubscription: 4500, retentionRate: 88, dropOffChapter: 10, dropOffReason: "正常自然流失", counterAction: "保持节奏" },
      { date: "09-02", chasingReadCount: 11600, averageSubscription: 4400, retentionRate: 85, dropOffChapter: 11, dropOffReason: "平稳", counterAction: "铺垫副本" },
      { date: "09-03", chasingReadCount: 9500, averageSubscription: 3900, retentionRate: 70, dropOffChapter: 12, dropOffReason: "配角过分喧宾夺主", counterAction: "主角强力登场打脸" },
      { date: "09-04", chasingReadCount: 9200, averageSubscription: 3800, retentionRate: 67, dropOffChapter: 13, dropOffReason: "打脸推进", counterAction: "持续回拉" },
    ],
    updatedAt: clock.now(),
  })

  const [activeTab, setActiveTab] = useState<"metrics" | "card">("metrics")
  const [newLog, setNewLog] = useState<MetricLogEntry>({
    date: "09-05",
    chasingReadCount: 9000,
    averageSubscription: 3750,
    retentionRate: 65,
    dropOffChapter: 14,
    dropOffReason: "",
    counterAction: "",
  })

  useEffect(() => {
    indexedDbAuthorOpsRepository.get(projectId).then((saved) => {
      if (saved) setProfile(saved)
    }).catch(console.error)
  }, [projectId])

  useEffect(() => {
    onStats?.({
      title: "连载运营台账",
      wordCount: profile.works.reduce((s, w) => s + w.totalWords, 0),
      updatedAt: profile.updatedAt,
    })
  }, [profile, onStats])

  const dropAnalyses = AuthorOpsEngine.analyzeDropOff(profile.metricLogs)
  const businessCardMarkdown = AuthorOpsEngine.generateBusinessCard(
    profile.authorName,
    profile.bio,
    profile.works,
    profile.supportChannels.customUrl
  )

  const handleSaveProfile = async () => {
    const updated = { ...profile, updatedAt: clock.now() }
    await indexedDbAuthorOpsRepository.save(updated)
    setProfile(updated)
  }

  const handleAddLog = async () => {
    const updatedLogs = [...profile.metricLogs, newLog]
    const updated = { ...profile, metricLogs: updatedLogs, updatedAt: clock.now() }
    await indexedDbAuthorOpsRepository.save(updated)
    setProfile(updated)
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto text-slate-800 dark:text-slate-100">
      <div className="flex items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Award className="w-6 h-6 text-blue-500" />
            <span>连载运营台账与作者商业名片 (AuthorOps)</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            追读流失断崖差分分析、毒点应对干预方案、官方商业合作名片生成
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("metrics")}
            className={`px-3 py-1.5 text-xs rounded font-medium transition ${
              activeTab === "metrics" ? "bg-blue-600 text-white" : "bg-slate-200 dark:bg-slate-800"
            }`}
          >
            运营台账与留存分析
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("card")}
            className={`px-3 py-1.5 text-xs rounded font-medium transition ${
              activeTab === "card" ? "bg-blue-600 text-white" : "bg-slate-200 dark:bg-slate-800"
            }`}
          >
            商业名片生成器
          </button>
        </div>
      </div>

      {activeTab === "metrics" && (
        <div className="space-y-6">
          {/* 断崖点预警 */}
          {dropAnalyses.filter((d) => d.isSevereCliff).length > 0 && (
            <div className="p-4 rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/30 space-y-2">
              <div className="font-bold text-sm text-rose-700 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                <span>严重追读流失断崖警告 (单章留存骤降 &ge; 12%)</span>
              </div>
              <div className="space-y-2 text-xs">
                {dropAnalyses.filter((d) => d.isSevereCliff).map((cliff, idx) => (
                  <div key={idx} className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-rose-200 dark:border-rose-800">
                    <div className="font-bold text-rose-600 flex justify-between">
                      <span>第 {cliff.dropOffChapter} 章：留存骤降 {cliff.gradientLoss}%</span>
                      <span className="text-rose-500 font-normal">疑似踩雷毒点</span>
                    </div>
                    <div className="mt-1 text-slate-600 dark:text-slate-300">原因判定：{cliff.probableReason}</div>
                    <div className="mt-1 text-blue-600 dark:text-blue-400 font-medium">应对策略：{cliff.recommendedCounterAction}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 留存与追读台账表格 */}
          <div className="border rounded-xl p-5 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
              <TrendingDown className="w-4 h-4 text-blue-500" />
              <span>追读与均订流失台账明细</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-slate-500 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-2.5">日期</th>
                    <th className="p-2.5">24小时追读</th>
                    <th className="p-2.5">当前均订</th>
                    <th className="p-2.5">整体留存率</th>
                    <th className="p-2.5">流失章节</th>
                    <th className="p-2.5">归因分析</th>
                    <th className="p-2.5">应对策略</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {profile.metricLogs.map((log, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                      <td className="p-2.5 font-mono">{log.date}</td>
                      <td className="p-2.5 font-bold text-blue-600 dark:text-blue-400">{log.chasingReadCount}</td>
                      <td className="p-2.5">{log.averageSubscription}</td>
                      <td className="p-2.5 font-bold">{log.retentionRate}%</td>
                      <td className="p-2.5">第 {log.dropOffChapter} 章</td>
                      <td className="p-2.5 text-slate-500">{log.dropOffReason || "-"}</td>
                      <td className="p-2.5 text-emerald-600 dark:text-emerald-400">{log.counterAction || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 新增日志录入 */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
              <input
                type="text"
                placeholder="日期 (如 09-05)"
                value={newLog.date}
                onChange={(e) => setNewLog({ ...newLog, date: e.target.value })}
                className="p-1.5 border rounded bg-slate-50 dark:bg-slate-900"
              />
              <input
                type="number"
                placeholder="追读数"
                value={newLog.chasingReadCount}
                onChange={(e) => setNewLog({ ...newLog, chasingReadCount: Number(e.target.value) })}
                className="p-1.5 border rounded bg-slate-50 dark:bg-slate-900"
              />
              <input
                type="number"
                placeholder="均订"
                value={newLog.averageSubscription}
                onChange={(e) => setNewLog({ ...newLog, averageSubscription: Number(e.target.value) })}
                className="p-1.5 border rounded bg-slate-50 dark:bg-slate-900"
              />
              <input
                type="number"
                placeholder="留存率%"
                value={newLog.retentionRate}
                onChange={(e) => setNewLog({ ...newLog, retentionRate: Number(e.target.value) })}
                className="p-1.5 border rounded bg-slate-50 dark:bg-slate-900"
              />
              <input
                type="number"
                placeholder="流失章节"
                value={newLog.dropOffChapter}
                onChange={(e) => setNewLog({ ...newLog, dropOffChapter: Number(e.target.value) })}
                className="p-1.5 border rounded bg-slate-50 dark:bg-slate-900"
              />
              <button
                type="button"
                onClick={handleAddLog}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold transition"
              >
                追加今日数据
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "card" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border rounded-xl p-5 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-blue-500" />
              <span>编辑作者名片资料</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-500 block mb-1">笔名 / 作家对外称谓:</label>
                <input
                  type="text"
                  value={profile.authorName}
                  onChange={(e) => setProfile({ ...profile, authorName: e.target.value })}
                  className="w-full p-2 border rounded bg-slate-50 dark:bg-slate-900"
                />
              </div>

              <div>
                <label className="text-slate-500 block mb-1">创作简介 / 理念:</label>
                <textarea
                  value={profile.bio}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                  className="w-full h-20 p-2 border rounded bg-slate-50 dark:bg-slate-900"
                />
              </div>

              <div>
                <label className="text-slate-500 block mb-1">读者赞赏或商务联系链接:</label>
                <input
                  type="text"
                  value={profile.supportChannels.customUrl || ""}
                  onChange={(e) => setProfile({
                    ...profile,
                    supportChannels: { ...profile.supportChannels, customUrl: e.target.value }
                  })}
                  className="w-full p-2 border rounded bg-slate-50 dark:bg-slate-900"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveProfile}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold flex items-center justify-center gap-1.5 transition"
              >
                <Save className="w-4 h-4" /> 保存名片档案
              </button>
            </div>
          </div>

          <div className="border rounded-xl p-5 bg-slate-900 text-slate-200 border-slate-800 font-mono text-xs space-y-2 overflow-y-auto max-h-[450px]">
            <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">生成的 Markdown 商业名片预览:</div>
            <pre className="whitespace-pre-wrap leading-relaxed text-slate-300">
              {businessCardMarkdown}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

