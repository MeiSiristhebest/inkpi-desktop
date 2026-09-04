import { useState, useEffect, type FC } from "react"
import type { DesktopPluginViewProps } from "../../../types/plugin"
import { indexedDbIronChamberRepository } from "../../../adapters/indexedDbIronChamberRepository"
import { IronChamberEngine } from "../engine/IronChamberEngine"
import type { IronChamberRecord, ChamberLockMode } from "../types"
import { Lock, Unlock, ShieldAlert, AlertCircle } from "lucide-react"
import { clock } from "../../../adapters/clock"
import { idGenerator } from "../../../adapters/idGenerator"

export const IronChamberMasterView: FC<DesktopPluginViewProps> = ({ projectId, onStats }) => {
  const [activeRecord, setActiveRecord] = useState<IronChamberRecord | null>(null)
  
  const [mode, setMode] = useState<ChamberLockMode>("words")
  const [targetWords, setTargetWords] = useState(2000)
  const [targetMinutes, setTargetMinutes] = useState(45)
  const [inputSimText, setInputSimText] = useState("")
  const [emergencyReason, setEmergencyReason] = useState("")
  const [showPanicModal, setShowPanicModal] = useState(false)
  const [panicError, setPanicError] = useState<string | null>(null)

  const loadData = async () => {
    const all = await indexedDbIronChamberRepository.getAll(projectId)
    const active = all.find((r) => r.status === "locked")
    setActiveRecord(active || null)
  }

  useEffect(() => {
    loadData().catch(console.error)
  }, [projectId])

  useEffect(() => {
    onStats?.({
      title: "黑曜石小黑屋",
      wordCount: inputSimText.length,
      updatedAt: clock.now(),
    })
  }, [inputSimText, onStats])

  const startLock = async () => {
    const newRecord: IronChamberRecord = {
      id: idGenerator.generate("chamber"),
      projectId,
      mode,
      targetWords,
      targetMinutes,
      startWords: inputSimText.length,
      currentWords: inputSimText.length,
      status: "locked",
      pledgedAt: clock.now(),
    }
    await indexedDbIronChamberRepository.save(newRecord)
    setActiveRecord(newRecord)
    await loadData()
  }

  const handleAttemptUnlock = async () => {
    if (!activeRecord) return
    const result = IronChamberEngine.transitionToUnlock(activeRecord, inputSimText.length, clock.now())
    if (result.canUnlock) {
      const updated: IronChamberRecord = {
        ...activeRecord,
        status: "completed",
        completedAt: clock.now(),
      }
      await indexedDbIronChamberRepository.save(updated)
      setActiveRecord(null)
      await loadData()
    } else {
      alert(result.message)
    }
  }

  const handleEmergencyAbort = async () => {
    if (!activeRecord) return
    const validation = IronChamberEngine.validateEmergencyAbort(emergencyReason)
    if (!validation.valid) {
      setPanicError(validation.error || "说明不足")
      return
    }

    const updated: IronChamberRecord = {
      ...activeRecord,
      status: "emergency_abort",
      completedAt: clock.now(),
      emergencyReasons: [...(activeRecord.emergencyReasons || []), emergencyReason],
    }
    await indexedDbIronChamberRepository.save(updated)
    setActiveRecord(null)
    setShowPanicModal(false)
    setEmergencyReason("")
    setPanicError(null)
    await loadData()
  }

  const progress = activeRecord
    ? IronChamberEngine.calculateProgress(activeRecord, inputSimText.length, clock.now())
    : null

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto text-slate-800 dark:text-slate-100">
      <div className="flex items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Lock className="w-6 h-6 text-indigo-500" />
            <span>黑曜石小黑屋 (IronChamber)</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            基于心流不可逆承诺契约（Commitment Contract），强制切断干扰建立创作心流
          </p>
        </div>
        {activeRecord && (
          <div className="flex items-center gap-2 px-3 py-1 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-600 font-bold text-xs border border-rose-200 dark:border-rose-900">
            <span>● 强制契约锁定中</span>
          </div>
        )}
      </div>

      {!activeRecord ? (
        <div className="border rounded-xl p-6 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">发起心流契约</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">锁定模式:</label>
              <select
                className="mt-1 w-full border px-2 py-1.5 rounded bg-white dark:bg-slate-800 text-xs border-slate-300 dark:border-slate-700"
                value={mode}
                onChange={(e) => setMode(e.target.value as any)}
              >
                <option value="words">字数目标 (不达标不解锁)</option>
                <option value="minutes">时长倒计时 (专注直到闹钟)</option>
                <option value="dual">双重极限 (字数与时长必须兼达)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">目标新增字数:</label>
              <input
                type="number"
                className="mt-1 w-full border px-2 py-1.5 rounded bg-white dark:bg-slate-800 text-xs border-slate-300 dark:border-slate-700"
                value={targetWords}
                onChange={(e) => setTargetWords(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">目标专注时长(分钟):</label>
              <input
                type="number"
                className="mt-1 w-full border px-2 py-1.5 rounded bg-white dark:bg-slate-800 text-xs border-slate-300 dark:border-slate-700"
                value={targetMinutes}
                onChange={(e) => setTargetMinutes(Number(e.target.value))}
              />
            </div>
          </div>

          <button
            onClick={startLock}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition"
          >
            <Lock className="w-4 h-4" /> 签署心流契约并进入小黑屋
          </button>
        </div>
      ) : (
        <div className="border rounded-xl p-6 bg-slate-900 text-slate-100 border-indigo-900 space-y-6 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-indigo-400">当前契约履行状态</div>
            <div className="text-xs text-slate-400">模式: {activeRecord.mode.toUpperCase()}</div>
          </div>

          {progress && (
            <div className="grid grid-cols-2 gap-6 text-center">
              <div className="p-4 rounded-lg bg-slate-800/80 border border-slate-700">
                <div className="text-xs text-slate-400 mb-1">字数达成进度</div>
                <div className="text-3xl font-black text-indigo-400">
                  {progress.deltaWords} <span className="text-sm font-normal text-slate-400">/ {progress.targetWords} 字</span>
                </div>
                <div className="w-full bg-slate-700 h-2 rounded-full mt-3 overflow-hidden">
                  <div className="bg-indigo-500 h-full transition-all" style={{ width: `${progress.wordsPercentage}%` }} />
                </div>
              </div>

              <div className="p-4 rounded-lg bg-slate-800/80 border border-slate-700">
                <div className="text-xs text-slate-400 mb-1">时间流逝倒计时</div>
                <div className="text-3xl font-black text-amber-400">
                  {Math.floor(progress.elapsedSeconds / 60)} <span className="text-sm font-normal text-slate-400">/ {activeRecord.targetMinutes} 分钟</span>
                </div>
                <div className="w-full bg-slate-700 h-2 rounded-full mt-3 overflow-hidden">
                  <div className="bg-amber-500 h-full transition-all" style={{ width: `${progress.timePercentage}%` }} />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400">全屏专注沉浸编辑区:</label>
            <textarea
              className="w-full h-64 p-4 text-sm rounded bg-slate-950 border border-slate-800 text-slate-100 font-serif leading-relaxed focus:outline-none focus:border-indigo-500 resize-none"
              placeholder="心流沉浸中...请全神贯注输入，直至契约圆满解除..."
              value={inputSimText}
              onChange={(e) => setInputSimText(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setShowPanicModal(true)}
              className="px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 transition flex items-center gap-1"
            >
              <AlertCircle className="w-3.5 h-3.5" /> 紧急脱逃协议 (中断惩罚)
            </button>
            <button
              onClick={handleAttemptUnlock}
              disabled={!progress?.isFulfilled}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition ${
                progress?.isFulfilled
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg cursor-pointer"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              }`}
            >
              <Unlock className="w-4 h-4" /> 达成目标，正式解锁
            </button>
          </div>
        </div>
      )}

      {showPanicModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-rose-800 rounded-xl p-6 max-w-md w-full space-y-4 text-slate-100">
            <div className="flex items-center gap-2 text-rose-500 font-bold">
              <ShieldAlert className="w-5 h-5" />
              <span>紧急脱逃反思协议</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              不可逆心流契约被设计用于克服拖延。强行退出将把违约记录写入项目历史日志。
              请如实填写不少于 15 字的放弃反思说明：
            </p>
            <textarea
              className="w-full h-24 p-2 text-xs rounded bg-slate-950 border border-slate-700 text-slate-200 resize-none"
              placeholder="为什么中途放弃？有何不可抗力或心理阻力？"
              value={emergencyReason}
              onChange={(e) => setEmergencyReason(e.target.value)}
            />
            {panicError && <div className="text-rose-400 text-xs">{panicError}</div>}
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowPanicModal(false)}
                className="px-3 py-1.5 rounded text-xs bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                继续坚持码字
              </button>
              <button
                onClick={handleEmergencyAbort}
                className="px-3 py-1.5 rounded text-xs bg-rose-700 hover:bg-rose-800 text-white font-bold"
              >
                确认强行违约脱逃
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
