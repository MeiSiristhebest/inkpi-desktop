import { useEffect, useRef, useState, useCallback } from 'react'
import type { Clock } from '../../../ports/clock'
import { clock } from '../../../adapters/clock'
import { localStorageKeyValueStore } from '../../../adapters/localStorageKeyValueStore'
import type { KeyValueStore } from '../../../ports/keyValueStore'

export interface WritingSessionStats {
  sessionWords: number
  speedPerHour: number
  writingSeconds: number
  idleSeconds: number
  isTyping: boolean
}

interface UseWritingSessionStatsProps {
  projectId: string
  isActive?: boolean
  clockPort?: Clock
  kvStore?: KeyValueStore
}

// 设定输入空闲阈值：8秒无击键判定为停顿构思（符合人机交互感知标准）
const IDLE_THRESHOLD_MS = 8000
// 指数平滑时间窗口（秒）：避免离散突刺，同时确保 10~15 秒内平滑收敛到真实时速
const EMA_WINDOW_SECONDS = 60

// 获取今日日期字符串 YYYY-MM-DD
function getTodayDateStr(clockPort: Clock): string {
  const d = new Date(clockPort.now())
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const date = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${date}`
}

export function useWritingSessionStats({
  projectId,
  isActive = true,
  clockPort = clock,
  kvStore = localStorageKeyValueStore,
}: UseWritingSessionStatsProps): WritingSessionStats & {
  recordTypedWords: (count: number) => void
  recordPasteWords: (count: number) => void
} {
  const todayDate = getTodayDateStr(clockPort)
  const storageKey = `inkpi-author-stats-${projectId}-${todayDate}`

  // 1. 初始化持久化状态
  const [stats, setStats] = useState(() => {
    try {
      const raw = localStorageKeyValueStore.getSync(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        return {
          sessionWords: Number(parsed.sessionWords) || 0,
          writingSeconds: Number(parsed.writingSeconds) || 0,
          idleSeconds: Number(parsed.idleSeconds) || 0,
        }
      }
    } catch {
      /* ignore */
    }
    return { sessionWords: 0, writingSeconds: 0, idleSeconds: 0 }
  })

  const [isTyping, setIsTyping] = useState(false)
  const lastInputTimeRef = useRef<number>(0)

  // 核心数学模型：基于时间衰减的加权瞬时速度（EMA，单位：字/秒）
  const emaSpeedRef = useRef<number>(0)
  const [smoothSpeedPerHour, setSmoothSpeedPerHour] = useState<number>(0)

  // 保存到本地存储
  const persistStats = useCallback(
    (next: { sessionWords: number; writingSeconds: number; idleSeconds: number }) => {
      void kvStore.set(storageKey, JSON.stringify(next))
    },
    [kvStore, storageKey],
  )

  // 2. 纯键盘手打字数注入（排除粘贴）
  const recordTypedWords = useCallback(
    (count: number) => {
      if (count <= 0) return
      const now = clockPort.now()
      lastInputTimeRef.current = now
      setIsTyping(true)

      // 瞬时冲量注入：count 字进入当前瞬时窗口
      const instantWordsPerSec = count / 1.0 // 假设该击键周期为 1s
      // 指数加权移动平均更新：alpha = 2 / (N + 1)
      const alpha = 2 / (EMA_WINDOW_SECONDS + 1)
      emaSpeedRef.current = alpha * instantWordsPerSec + (1 - alpha) * emaSpeedRef.current

      setStats((prev) => {
        const next = {
          ...prev,
          sessionWords: prev.sessionWords + count,
        }
        persistStats(next)
        return next
      })
    },
    [clockPort, persistStats],
  )

  // 3. 外部粘贴行为记录（仅刷新时间戳，绝不注入手打字数）
  const recordPasteWords = useCallback(() => {
    lastInputTimeRef.current = clockPort.now()
  }, [clockPort])

  // 4. 高精度 1Hz 心跳调度器：状态判定、平滑衰减与时长积分
  useEffect(() => {
    if (!isActive || !projectId) return

    const timer = setInterval(() => {
      const now = clockPort.now()
      const timeSinceLastInput = now - lastInputTimeRef.current
      const typingNow = lastInputTimeRef.current > 0 && timeSinceLastInput < IDLE_THRESHOLD_MS
      setIsTyping(typingNow)

      // 速度的自然阻尼衰减（当用户停手时，时速自然滑降而非突变）
      if (!typingNow) {
        emaSpeedRef.current *= 0.92 // 每秒按阻尼衰减
        if (emaSpeedRef.current < 0.05) emaSpeedRef.current = 0
      }

      setStats((prev) => {
        let nextWriting = prev.writingSeconds
        let nextIdle = prev.idleSeconds

        if (typingNow) {
          nextWriting += 1
        } else {
          nextIdle += 1
        }

        // 双模型融合时速：
        // 模型A（瞬时动态响应）：emaSpeedRef.current * 3600
        // 模型B（全周期平均兜底）：(sessionWords / writingHours)
        const avgSpeed = nextWriting > 0 ? prev.sessionWords / (nextWriting / 3600) : 0
        const instantSpeed = emaSpeedRef.current * 3600

        // 当刚刚开始码字时，取瞬时与平均的加权和谐值，彻底消除开局暴涨与长篇迟钝
        let calculated = 0
        if (prev.sessionWords > 0 && nextWriting >= 3) {
          calculated = Math.round(0.6 * instantSpeed + 0.4 * avgSpeed)
        }
        setSmoothSpeedPerHour(calculated)

        const next = {
          sessionWords: prev.sessionWords,
          writingSeconds: nextWriting,
          idleSeconds: nextIdle,
        }
        persistStats(next)
        return next
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isActive, projectId, clockPort, persistStats])

  return {
    sessionWords: stats.sessionWords,
    speedPerHour: smoothSpeedPerHour,
    writingSeconds: stats.writingSeconds,
    idleSeconds: stats.idleSeconds,
    isTyping,
    recordTypedWords,
    recordPasteWords,
  }
}
