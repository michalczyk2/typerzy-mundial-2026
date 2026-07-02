export type DailyMultiplier = 1 | 1.5 | 2 | 3

const MULTIPLIERS: DailyMultiplier[] = [1, 1.5, 2, 3]
const WEIGHTS = [40, 30, 20, 10] // sum = 100, aligned with MULTIPLIERS

const lsKey = (dayKey: string) => `daily-multiplier:${dayKey}`

export function spinWheel(): DailyMultiplier {
  const rand = Math.random() * 100
  let cumulative = 0
  for (let i = 0; i < MULTIPLIERS.length; i++) {
    cumulative += WEIGHTS[i]
    if (rand < cumulative) return MULTIPLIERS[i]
  }
  return 1
}

export function getMultiplierForDay(dayKey: string): number {
  if (typeof window === 'undefined') return 1
  try {
    const saved = window.localStorage.getItem(lsKey(dayKey))
    if (!saved) return 1
    const parsed = Number(saved)
    return isFinite(parsed) && parsed > 0 ? parsed : 1
  } catch {
    return 1
  }
}

export function saveMultiplierForDay(dayKey: string, multiplier: DailyMultiplier): void {
  try {
    window.localStorage.setItem(lsKey(dayKey), String(multiplier))
  } catch {}
}

export function hasSpunToday(dayKey: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(lsKey(dayKey)) !== null
  } catch {
    return false
  }
}
