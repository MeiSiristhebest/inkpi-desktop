import { useState, useEffect, useRef, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import type { FlowStateLevel, SprintRecord, SynthesizerSoundType } from '../types'
import { sprintEngine } from '../engine/SprintEngine'
import { indexedDbSprintRepository } from '../../../adapters/indexedDbSprintRepository'
import { webAudioSynthesizer } from '../../../adapters/webAudioSynthesizer'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import {
  Flame,
  Play,
  Square,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react'

const FLOW_LEVEL_NAMES: Record<FlowStateLevel, string> = {
  idle: '静止待命',
  warm_up: '蓄热起步',
  focused: '渐入佳境',
  flow_surge: '心流狂飙',
  zen_mode: '人键合一',
}

export const SprintArenaDrawer: FC<DesktopPluginDrawerProps> = ({
  projectId,
  currentText,
}) => {
  const [isActive, setIsActive] = useState(false)
  const [mode, setMode] = useState<'time' | 'word_count'>('time')
  const [targetMinutes, setTargetMinutes] = useState(15)
  const [targetWords, setTargetWords] = useState(500)
  const [soundType, setSoundType] = useState<SynthesizerSoundType | 'none'>('mechanical')

  // 冲刺过程指标
  const [startWordCount, setStartWordCount] = useState(0)
  const [wordsWritten, setWordsWritten] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [currentWpm, setCurrentWpm] = useState(0)
  const [peakWpm, setPeakWpm] = useState(0)
  const [comboCount, setComboCount] = useState(0)
  const [flowLevel, setFlowLevel] = useState<FlowStateLevel>('idle')

  const lastKeyTimeRef = useRef<number>(0)
  const lastCharCountRef = useRef<number>(0)

  // 监听正文变化与击键音频
  useEffect(() => {
    const chars = currentText ? currentText.replace(/\s+/g, '').length : 0
    if (!isActive) {
      lastCharCountRef.current = chars
      return
    }

    const delta = chars - lastCharCountRef.current
    if (delta > 0) {
      const now = clock.now()
      // 音频反馈
      if (soundType !== 'none') {
        webAudioSynthesizer.setMuted(false)
        webAudioSynthesizer.playClick(soundType)
      }

      // Combo 判断
      const isSustained = sprintEngine.isComboSustained(now, lastKeyTimeRef.current)
      const nextCombo = isSustained ? comboCount + delta : 1
      setComboCount(nextCombo)
      lastKeyTimeRef.current = now

      // 增量字数
      const newTotal = chars - startWordCount
      setWordsWritten(Math.max(0, newTotal))

      // 瞬时 WPM 计算
      const instWpm = sprintEngine.calculateWpm(delta, 1.5)
      setCurrentWpm((prev) => {
        const smoothed = sprintEngine.smoothWpm(prev, instWpm, 0.35)
        setPeakWpm((p) => Math.max(p, smoothed))
        setFlowLevel(sprintEngine.determineFlowLevel(nextCombo, smoothed))
        return smoothed
      })
    }
    lastCharCountRef.current = chars
  }, [currentText, isActive, soundType, startWordCount, comboCount])

  // 定时器递增
  useEffect(() => {
    if (!isActive) return
    const timer = setInterval(() => {
      setElapsedSeconds((sec) => sec + 1)
      // 自然衰减
      const now = clock.now()
      if (now - lastKeyTimeRef.current > 3500) {
        setComboCount(0)
        setCurrentWpm((w) => Math.max(0, Math.round(w * 0.7)))
        setFlowLevel('idle')
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [isActive])

  const handleStartSprint = () => {
    const chars = currentText ? currentText.replace(/\s+/g, '').length : 0
    setStartWordCount(chars)
    lastCharCountRef.current = chars
    setWordsWritten(0)
    setElapsedSeconds(0)
    setCurrentWpm(0)
    setPeakWpm(0)
    setComboCount(0)
    setFlowLevel('warm_up')
    setIsActive(true)
  }

  const handleFinishSprint = async () => {
    setIsActive(false)
    webAudioSynthesizer.playDing()

    if (wordsWritten > 0) {
      const avg = elapsedSeconds > 0 ? Math.round((wordsWritten / elapsedSeconds) * 60) : 0
      const record: SprintRecord = {
        id: idGenerator.generate('sprint'),
        projectId,
        durationSeconds: elapsedSeconds,
        wordsWritten,
        averageWpm: avg,
        peakWpm,
        completedAt: clock.now(),
      }
      await indexedDbSprintRepository.save(record)
    }
  }

  // 目标达成百分比
  const progressPct =
    mode === 'time'
      ? Math.min(100, Math.round((elapsedSeconds / (targetMinutes * 60)) * 100))
      : Math.min(100, Math.round((wordsWritten / targetWords) * 100))

  return (
    <aside
      className="w-72 h-full flex flex-col bg-[var(--ink-bg-panel)] border-l border-[var(--ink-border)] text-[var(--ink-text)] text-xs"
      data-testid="sprint-arena-drawer"
    >
      {/* 顶栏 */}
      <div className="p-3 border-b border-[var(--ink-border)] bg-[var(--ink-bg-elevated)]/40 shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-[var(--ink-text)]">
            <Flame className="w-3.5 h-3.5 text-orange-500" />
            <span>心流极速码字冲刺</span>
          </div>
          <button
            onClick={() => setSoundType(soundType === 'none' ? 'mechanical' : 'none')}
            className="p-1 hover:bg-[var(--ink-bg-hover)] rounded text-[var(--ink-text-muted)]"
            title={soundType === 'none' ? '开启按键音效' : '静音'}
          >
            {soundType === 'none' ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-orange-500" />}
          </button>
        </div>

        {/* 冲刺状态控制 */}
        {!isActive ? (
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-1 text-[11px]">
              <button
                onClick={() => setMode('time')}
                className={`flex-1 py-1 rounded text-center transition-colors ${
                  mode === 'time'
                    ? 'bg-[var(--ink-accent)] text-white font-medium'
                    : 'bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[var(--ink-text-muted)]'
                }`}
              >
                时间番茄钟
              </button>
              <button
                onClick={() => setMode('word_count')}
                className={`flex-1 py-1 rounded text-center transition-colors ${
                  mode === 'word_count'
                    ? 'bg-[var(--ink-accent)] text-white font-medium'
                    : 'bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-[var(--ink-text-muted)]'
                }`}
              >
                字数挑战
              </button>
            </div>

            {mode === 'time' ? (
              <div className="flex items-center gap-1 text-[10px]">
                {[15, 25, 45].map((m) => (
                  <button
                    key={m}
                    onClick={() => setTargetMinutes(m)}
                    className={`flex-1 py-1 rounded border ${
                      targetMinutes === m
                        ? 'border-orange-500 text-orange-500 font-semibold'
                        : 'border-[var(--ink-border)] bg-[var(--ink-bg-canvas)] text-[var(--ink-text-muted)]'
                    }`}
                  >
                    {m} 分钟
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[10px]">
                {[300, 500, 1000].map((w) => (
                  <button
                    key={w}
                    onClick={() => setTargetWords(w)}
                    className={`flex-1 py-1 rounded border ${
                      targetWords === w
                        ? 'border-orange-500 text-orange-500 font-semibold'
                        : 'border-[var(--ink-border)] bg-[var(--ink-bg-canvas)] text-[var(--ink-text-muted)]'
                    }`}
                  >
                    {w} 字
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={handleStartSprint}
              className="w-full py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>开启极速冲刺</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-orange-500 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 animate-pulse" />
                <span>冲刺中 ({Math.floor(elapsedSeconds / 60)}分{elapsedSeconds % 60}秒)</span>
              </span>
              <button
                onClick={handleFinishSprint}
                className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-500 text-[10px] hover:bg-rose-500/25 flex items-center gap-1"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
                <span>结算</span>
              </button>
            </div>

            {/* 进度条 */}
            <div className="w-full h-1.5 bg-[var(--ink-bg-canvas)] rounded-full overflow-hidden">
              <div
                style={{ width: `${progressPct}%` }}
                className="h-full bg-orange-500 rounded-full transition-all duration-300"
              />
            </div>
          </div>
        )}
      </div>

      {/* 实时动态指标大卡 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* WPM 与心流等级 */}
        <div className="p-3 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-canvas)] text-center space-y-1">
          <span className="text-[10px] text-[var(--ink-text-muted)] block">当前实时手速</span>
          <div className="text-3xl font-black text-orange-500 font-mono tracking-tight">
            {currentWpm} <span className="text-xs font-normal text-[var(--ink-text-muted)]">WPM</span>
          </div>
          <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-[var(--ink-text)] pt-1">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
            <span>{FLOW_LEVEL_NAMES[flowLevel]}</span>
          </div>
        </div>

        {/* Combo 连击与产出 */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-canvas)] text-center">
            <span className="text-[10px] text-[var(--ink-text-muted)] block">连续击键 (Combo)</span>
            <span className="text-lg font-bold text-amber-500">{comboCount}</span>
          </div>

          <div className="p-2.5 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-canvas)] text-center">
            <span className="text-[10px] text-[var(--ink-text-muted)] block">冲刺净增字数</span>
            <span className="text-lg font-bold text-emerald-500">+{wordsWritten}</span>
          </div>
        </div>

        {/* 音效选择器 */}
        <div className="p-2.5 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-canvas)] space-y-1.5">
          <label className="text-[10px] text-[var(--ink-text-muted)] block">键盘击键音效算法：</label>
          <div className="grid grid-cols-3 gap-1 text-[10px]">
            <button
              onClick={() => setSoundType('mechanical')}
              className={`py-1 rounded border ${
                soundType === 'mechanical'
                  ? 'border-orange-500 text-orange-500 font-semibold'
                  : 'border-[var(--ink-border)] text-[var(--ink-text-muted)]'
              }`}
            >
              青轴敲击
            </button>
            <button
              onClick={() => setSoundType('typewriter')}
              className={`py-1 rounded border ${
                soundType === 'typewriter'
                  ? 'border-orange-500 text-orange-500 font-semibold'
                  : 'border-[var(--ink-border)] text-[var(--ink-text-muted)]'
              }`}
            >
              复古打字机
            </button>
            <button
              onClick={() => setSoundType('none')}
              className={`py-1 rounded border ${
                soundType === 'none'
                  ? 'border-orange-500 text-orange-500 font-semibold'
                  : 'border-[var(--ink-border)] text-[var(--ink-text-muted)]'
              }`}
            >
              静音
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
