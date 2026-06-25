'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import {
  dailyChallengeCategories,
  dailyChallengePreview,
  type DailyChallengeCategory,
} from '@/lib/daily-challenge-mock'

function getWarsawDayKey(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const year = parts.find(p => p.type === 'year')?.value ?? '2026'
  const month = parts.find(p => p.type === 'month')?.value ?? '01'
  const day = parts.find(p => p.type === 'day')?.value ?? '01'
  return `${year}-${month}-${day}`
}

type GameDayPoints = { earned: number; max: number }

function readGameDayPoints(gameKey: string, dayKey: string, maxPoints: number): GameDayPoints {
  if (typeof window === 'undefined') return { earned: 0, max: maxPoints }
  try {
    const saved = window.localStorage.getItem(`daily-challenge:${gameKey}:${dayKey}`)
    if (!saved) return { earned: 0, max: maxPoints }
    const parsed = JSON.parse(saved) as { status?: string; earnedPoints?: number }
    const earned = parsed.status === 'won' ? (parsed.earnedPoints ?? maxPoints) : 0
    return { earned, max: maxPoints }
  } catch {
    return { earned: 0, max: maxPoints }
  }
}

function DailyProgress() {
  const [footwordle, setFootwordle] = useState<GameDayPoints>({ earned: 0, max: 100 })
  const [pilkarzdle, setPilkarzdle] = useState<GameDayPoints>({ earned: 0, max: 100 })
  const [quotedle, setQuotedle] = useState<GameDayPoints>({ earned: 0, max: 100 })
  const [clubdle, setClubdle] = useState<GameDayPoints>({ earned: 0, max: 100 })
  const [transferdle, setTransferdle] = useState<GameDayPoints>({ earned: 0, max: 100 })

  useEffect(() => {
    const dayKey = getWarsawDayKey()
    setFootwordle(readGameDayPoints('footwordle', dayKey, 100))
    setPilkarzdle(readGameDayPoints('pilkarzdle', dayKey, 100))
    setQuotedle(readGameDayPoints('quotedle', dayKey, 100))
    setClubdle(readGameDayPoints('clubdle', dayKey, 100))
    setTransferdle(readGameDayPoints('transferdle', dayKey, 100))
  }, [])

  const total = footwordle.earned + pilkarzdle.earned + quotedle.earned + clubdle.earned + transferdle.earned
  const maxTotal = footwordle.max + pilkarzdle.max + quotedle.max + clubdle.max + transferdle.max

  return (
    <section className="mt-6 rounded-2xl border border-gray-800 bg-gray-900 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-500">
        Dzisiejszy postep
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-gray-800 bg-gray-950 p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">FootWordle</p>
          <p className={cn('mt-1 text-xl font-black', footwordle.earned > 0 ? 'text-emerald-300' : 'text-gray-500')}>
            {footwordle.earned}/{footwordle.max}
            <span className="ml-1 text-xs font-bold text-gray-600">pkt</span>
          </p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-950 p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">Piłkarzdle</p>
          <p className={cn('mt-1 text-xl font-black', pilkarzdle.earned > 0 ? 'text-emerald-300' : 'text-gray-500')}>
            {pilkarzdle.earned}/{pilkarzdle.max}
            <span className="ml-1 text-xs font-bold text-gray-600">pkt</span>
          </p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-950 p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">Quotedle</p>
          <p className={cn('mt-1 text-xl font-black', quotedle.earned > 0 ? 'text-fuchsia-300' : 'text-gray-500')}>
            {quotedle.earned}/{quotedle.max}
            <span className="ml-1 text-xs font-bold text-gray-600">pkt</span>
          </p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-950 p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">Clubdle</p>
          <p className={cn('mt-1 text-xl font-black', clubdle.earned > 0 ? 'text-cyan-300' : 'text-gray-500')}>
            {clubdle.earned}/{clubdle.max}
            <span className="ml-1 text-xs font-bold text-gray-600">pkt</span>
          </p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-950 p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">Transferdle</p>
          <p className={cn('mt-1 text-xl font-black', transferdle.earned > 0 ? 'text-violet-300' : 'text-gray-500')}>
            {transferdle.earned}/{transferdle.max}
            <span className="ml-1 text-xs font-bold text-gray-600">pkt</span>
          </p>
        </div>
        <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">Razem</p>
          <p className={cn('mt-1 text-xl font-black', total > 0 ? 'text-emerald-300' : 'text-gray-500')}>
            {total}/{maxTotal}
            <span className="ml-1 text-xs font-bold text-gray-600">pkt</span>
          </p>
        </div>
      </div>
    </section>
  )
}

function getNextMidnight(): Date {
  const next = new Date()
  next.setHours(24, 0, 0, 0)
  return next
}

function formatTimeLeft(target: Date): string {
  const diff = Math.max(0, target.getTime() - Date.now())
  const hours = Math.floor(diff / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)

  return [hours, minutes, seconds]
    .map(value => String(value).padStart(2, '0'))
    .join(':')
}

function CategoryCard({ category, index }: { category: DailyChallengeCategory; index: number }) {
  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-gradient-to-br p-4 min-h-[220px]',
        category.accentClass
      )}
    >
      <div className="absolute right-3 top-3 text-4xl font-black text-white/5 tabular-nums">
        {String(index + 1).padStart(2, '0')}
      </div>
      <div className="relative flex h-full flex-col justify-between gap-5">
        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-gray-950/60 text-2xl">
              {category.icon}
            </span>
            <span
              className={cn(
                'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide',
                category.enabled
                  ? 'bg-emerald-950/80 text-emerald-300'
                  : 'bg-gray-950/70 text-gray-500'
              )}
            >
              {category.status}
            </span>
          </div>
          <h2 className="text-lg font-black text-white">{category.title}</h2>
          <p className="mt-2 text-sm leading-6 text-gray-400">{category.description}</p>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-gray-950/55 p-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">
              Maksymalnie
            </p>
            <p className="mt-1 text-lg font-black text-emerald-300">
              {category.maxPoints} pkt
            </p>
          </div>
          {category.enabled ? (
            <Link
              href={category.href}
              className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-black text-gray-950 transition hover:bg-emerald-400"
            >
              Graj
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-full bg-gray-800 px-4 py-2 text-sm font-black text-gray-500"
            >
              Graj
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

export default function DailyChallengePage() {
  const nextMidnight = useMemo(() => getNextMidnight(), [])
  const [timeLeft, setTimeLeft] = useState(() => formatTimeLeft(nextMidnight))

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTimeLeft(formatTimeLeft(nextMidnight))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [nextMidnight])

  return (
    <div className="pb-20 md:pb-8">
      <section className="relative overflow-hidden rounded-3xl border border-gray-800 bg-gray-900 p-5 sm:p-7">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.24),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.16),transparent_32%)]" />
        <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full border border-emerald-500/20" />
        <div className="absolute -bottom-24 left-1/2 h-48 w-48 rounded-full border border-cyan-500/10" />

        <div className="relative grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge variant="default" className="bg-emerald-950 text-emerald-300">
                {dailyChallengePreview.todayLabel}
              </Badge>
              <span className="rounded-full border border-gray-700 px-2.5 py-1 text-xs font-semibold text-gray-400">
                {dailyChallengePreview.status}
              </span>
            </div>
            <h1 className="max-w-2xl text-3xl font-black tracking-tight text-white sm:text-5xl">
              {dailyChallengePreview.title}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-gray-400 sm:text-base">
              {dailyChallengePreview.subtitle}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-900/60 bg-gray-950/70 p-4 shadow-2xl shadow-emerald-950/20">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-gray-500">
              Nowe wyzwanie za
            </p>
            <p className="mt-2 text-4xl font-black text-emerald-300 tabular-nums sm:text-5xl">
              {timeLeft}
            </p>
            <p className="mt-2 text-xs text-gray-500">
              Licznik odswieza sie lokalnie. FootWordle zapisuje postep w localStorage.
            </p>
          </div>
        </div>
      </section>

      <DailyProgress />

      <section className="mt-6 grid gap-3 md:grid-cols-3">
        {dailyChallengePreview.rules.map(rule => (
          <div key={rule} className="rounded-2xl border border-gray-800 bg-gray-900 px-4 py-3">
            <p className="text-sm font-semibold text-gray-200">{rule}</p>
          </div>
        ))}
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-500">
              Kategorie
            </p>
            <h2 className="mt-1 text-xl font-black text-white">6 formatow Daily Challenge</h2>
          </div>
          <span className="hidden rounded-full bg-gray-900 px-3 py-1 text-xs font-semibold text-gray-500 sm:inline-flex">
            MVP bez bazy danych
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {dailyChallengeCategories.map((category, index) => (
            <CategoryCard key={category.id} category={category} index={index} />
          ))}
        </div>
      </section>
    </div>
  )
}
