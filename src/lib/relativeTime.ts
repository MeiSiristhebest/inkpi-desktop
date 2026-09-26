const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * 中文相对时间。书架一类"我上次动过它是什么时候"的场景读的是间隔，不是日历日期，
 * 所以超过一个月的条目退回绝对日期，而不是给出"45 天前"这种无法定位的措辞。
 */
export function formatRelativeTime(timestamp: number, now: number): string {
  const delta = now - timestamp
  if (!Number.isFinite(delta) || delta < MINUTE) return '刚刚'
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)} 分钟前`
  if (delta < DAY) return `${Math.floor(delta / HOUR)} 小时前`
  if (delta < 30 * DAY) return `${Math.floor(delta / DAY)} 天前`
  return new Date(timestamp).toLocaleDateString()
}
