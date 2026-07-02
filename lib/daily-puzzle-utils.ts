// Deterministic PRNG — mulberry32
function seededRng(seed: number): () => number {
  let s = seed >>> 0
  return (): number => {
    s += 0x6d2b79f5
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function fisherYatesShuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// 0-based day of year from "YYYY-MM-DD"
function dayOfYear(dayKey: string): number {
  const [yearStr, monthStr, dayStr] = dayKey.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const day = parseInt(dayStr, 10)
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
  const monthDays = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  let d = day - 1
  for (let m = 0; m < month - 1; m++) d += monthDays[m]
  return d
}

export function getWarsawDayKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = parts.find(p => p.type === 'year')?.value ?? '2026'
  const month = parts.find(p => p.type === 'month')?.value ?? '01'
  const day = parts.find(p => p.type === 'day')?.value ?? '01'
  return `${year}-${month}-${day}`
}

export function normalizeDayKey(dayKey: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return dayKey
  return getWarsawDayKey()
}

// Seed = year from dayKey → deterministic Fisher-Yates shuffle of pool;
// index = day-of-year % pool size. Guarantees each entry appears at most once
// per full cycle (no hash collisions, no random repeats within a cycle).
// Year boundary naturally rotates order: seed 2026 ≠ seed 2027.
export function pickForDay<T>(items: readonly T[], dayKey: string): T {
  const normalized = normalizeDayKey(dayKey)
  const year = parseInt(normalized.slice(0, 4), 10)
  const n = dayOfYear(normalized)
  const rng = seededRng(year)
  const shuffled = fisherYatesShuffle(items, rng)
  return shuffled[n % shuffled.length]
}
