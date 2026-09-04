import React, { useState, useEffect } from 'react'
import { Lock, Unlock, Zap } from 'lucide-react'
import { Modal } from '../../../ui/molecules/Modal'

interface LockModalProps {
  currentWordCount: number
  onClose: () => void
}

export const LockModal: React.FC<LockModalProps> = ({ currentWordCount, onClose }) => {
  const [targetDelta, setTargetDelta] = useState<number>(500)
  const [targetMinutes, setTargetMinutes] = useState<number>(30)
  const [mode, setMode] = useState<'words' | 'time'>('words')
  const [isLocked, setIsLocked] = useState<boolean>(false)
  const [startWordCount, setStartWordCount] = useState<number>(currentWordCount)
  const [timeLeft, setTimeLeft] = useState<number>(30 * 60)

  useEffect(() => {
    let timer: any
    if (isLocked && mode === 'time' && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((t) => t - 1), 1000)
    }
    return () => clearInterval(timer)
  }, [isLocked, mode, timeLeft])

  const wordsWritten = Math.max(0, currentWordCount - startWordCount)
  const wordProgress = Math.min(100, Math.round((wordsWritten / targetDelta) * 100))

  const isFulfilled = mode === 'words' ? wordsWritten >= targetDelta : timeLeft <= 0

  const handleStartLock = () => {
    setStartWordCount(currentWordCount)
    setTimeLeft(targetMinutes * 60)
    setIsLocked(true)
  }

  const handleUnlock = () => {
    setIsLocked(false)
    onClose()
  }

  return (
    <Modal
      onClose={onClose}
      widthClass="max-w-md"
      overlayClassName="bg-black/60 backdrop-blur-sm"
      panelClassName="bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] rounded-2xl shadow-2xl p-6 text-[var(--ink-text)] text-center space-y-5"
    >
      <div className="flex justify-center">
        <div className="w-12 h-12 rounded-2xl bg-[var(--ink-accent)]/10 border border-[var(--ink-accent)]/20 flex items-center justify-center text-[var(--ink-accent)] shadow-xs">
          <Lock className="w-6 h-6" />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold">小黑屋 · 强制专注码字</h3>
        <p className="text-xs text-[var(--ink-text-muted)] mt-1">
          {isLocked
            ? '已进入锁定状态！完成目标前请专注打字，不可分心。'
            : '设定专注目标。在完成设定的目标字数或时间前，阻断外部干扰。'}
        </p>
      </div>

      {!isLocked ? (
        <div className="space-y-4 text-left">
          <div className="flex gap-2">
            <button
              onClick={() => setMode('words')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border ${
                mode === 'words'
                  ? 'bg-[var(--ink-accent)] text-white border-transparent'
                  : 'border-[var(--ink-border)] bg-[var(--ink-bg)]'
              }`}
            >
              字数挑战
            </button>
            <button
              onClick={() => setMode('time')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border ${
                mode === 'time'
                  ? 'bg-[var(--ink-accent)] text-white border-transparent'
                  : 'border-[var(--ink-border)] bg-[var(--ink-bg)]'
              }`}
            >
              时长挑战
            </button>
          </div>

          {mode === 'words' ? (
            <div>
              <label className="text-xs text-[var(--ink-text-muted)] block mb-1">
                目标新增字数：
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[500, 1000, 2000].map((num) => (
                  <button
                    key={num}
                    onClick={() => setTargetDelta(num)}
                    className={`py-2 rounded-lg text-xs font-bold border transition-colors ${
                      targetDelta === num
                        ? 'border-[var(--ink-accent)] text-[var(--ink-accent)] bg-[var(--ink-accent)]/10'
                        : 'border-[var(--ink-border)] hover:border-[var(--ink-text-muted)]'
                    }`}
                  >
                    {num} 字
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="text-xs text-[var(--ink-text-muted)] block mb-1">
                目标专注时长：
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[15, 30, 45].map((m) => (
                  <button
                    key={m}
                    onClick={() => setTargetMinutes(m)}
                    className={`py-2 rounded-lg text-xs font-bold border transition-colors ${
                      targetMinutes === m
                        ? 'border-[var(--ink-accent)] text-[var(--ink-accent)] bg-[var(--ink-accent)]/10'
                        : 'border-[var(--ink-border)] hover:border-[var(--ink-text-muted)]'
                    }`}
                  >
                    {m} 分钟
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-lg text-xs border border-[var(--ink-border)] text-[var(--ink-text-muted)] hover:bg-[var(--ink-bg-hover)]"
            >
              取消
            </button>
            <button
              onClick={handleStartLock}
              className="flex-1 py-2 rounded-lg text-xs font-bold bg-[var(--ink-accent)] text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 shadow"
            >
              <Zap className="w-3.5 h-3.5" />
              开始闭关
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {mode === 'words' ? (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-[var(--ink-text-muted)] font-medium">
                <span>
                  进度：{wordsWritten} / {targetDelta} 字
                </span>
                <span>{wordProgress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[var(--ink-bg)] overflow-hidden">
                <div
                  className="h-full bg-[var(--ink-accent)] transition-all duration-300"
                  style={{ width: `${wordProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="py-4">
              <div className="text-3xl font-mono font-bold text-[var(--ink-accent)] tabular-nums">
                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
              </div>
              <span className="text-[11px] text-[var(--ink-text-muted)]">倒计时结束后自动解锁</span>
            </div>
          )}

          {isFulfilled ? (
            <button
              onClick={handleUnlock}
              className="w-full py-2.5 rounded-xl bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg animate-bounce"
            >
              <Unlock className="w-4 h-4" />
              恭喜达标！破关而出
            </button>
          ) : (
            <div className="pt-2 text-[11px] text-[var(--ink-text-muted)]">
              尚未达成目标，请直接回到正文继续书写...
              <button
                onClick={onClose}
                className="block mx-auto mt-2 text-[10px] underline hover:text-[var(--ink-text)] opacity-70"
              >
                暂留后台继续码字
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
