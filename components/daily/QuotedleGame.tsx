'use client'

import Link from 'next/link'
import { FormEvent, useState, useSyncExternalStore, useTransition } from 'react'
import { evaluateQuotedleGuess } from '@/app/(main)/daily-challenge/quotedle/actions'
import { saveDailyResult } from '@/lib/save-daily-result'
import { getMultiplierForDay } from '@/lib/daily-multiplier'
import { cn } from '@/lib/utils'
import type {
  QuotedleGameStatus,
  QuotedlePublicPuzzle,
  QuotedleStats,
  QuotedleStoredGame,
} from '@/lib/quotedle-types'

const STATS_KEY = 'daily-challenge:quotedle:stats'

const storedGameSnapshotCache = new Map<string, { raw: string | null; value: QuotedleStoredGame | null }>()

function storageKey(dayKey: string): string {
  return `daily-challenge:quotedle:${dayKey}`
}

function storageEventName(dayKey: string): string {
  return `daily-challenge:quotedle-updated:${dayKey}`
}

function createEmptyGame(dayKey: string): QuotedleStoredGame {
  return { dayKey, attempts: 0, wrongGuesses: [], hintsRevealed: [], status: 'playing' }
}

function isStoredGame(value: unknown, dayKey: string): value is QuotedleStoredGame {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<QuotedleStoredGame>
  return (
    candidate.dayKey === dayKey &&
    typeof candidate.attempts === 'number' &&
    Array.isArray(candidate.wrongGuesses) &&
    Array.isArray(candidate.hintsRevealed) &&
    (candidate.status === 'playing' || candidate.status === 'won' || candidate.status === 'lost')
  )
}

function readStoredGame(dayKey: string, maxAttempts: number): QuotedleStoredGame | null {
  if (typeof window === 'undefined') return null
  const key = storageKey(dayKey)
  const cacheKey = `${key}:${maxAttempts}`
  const saved = window.localStorage.getItem(key)
  const cached = storedGameSnapshotCache.get(cacheKey)
  if (cached?.raw === saved) return cached.value
  if (!saved) { storedGameSnapshotCache.set(cacheKey, { raw: saved, value: null }); return null }
  try {
    const parsed: unknown = JSON.parse(saved)
    if (!isStoredGame(parsed, dayKey)) {
      window.localStorage.removeItem(key)
      storedGameSnapshotCache.set(cacheKey, { raw: null, value: null })
      return null
    }
    const value = { ...parsed, attempts: Math.min(parsed.attempts, maxAttempts) }
    storedGameSnapshotCache.set(cacheKey, { raw: saved, value })
    return value
  } catch {
    window.localStorage.removeItem(key)
    storedGameSnapshotCache.set(cacheKey, { raw: null, value: null })
    return null
  }
}

function writeStoredGame(game: QuotedleStoredGame) {
  window.localStorage.setItem(storageKey(game.dayKey), JSON.stringify(game))
  window.dispatchEvent(new Event(storageEventName(game.dayKey)))
}

function subscribeToStoredGame(dayKey: string, callback: () => void) {
  function onStorage(event: StorageEvent) {
    if (!event.key || event.key === storageKey(dayKey)) callback()
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener(storageEventName(dayKey), callback)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(storageEventName(dayKey), callback)
  }
}

function readQuotedleStats(): QuotedleStats {
  if (typeof window === 'undefined') return { playedGames: 0, wonGames: 0, resultsByDay: {} }
  const saved = window.localStorage.getItem(STATS_KEY)
  if (!saved) return { playedGames: 0, wonGames: 0, resultsByDay: {} }
  try { return JSON.parse(saved) as QuotedleStats } catch { return { playedGames: 0, wonGames: 0, resultsByDay: {} } }
}

function recordQuotedleStats(dayKey: string, result: 'won' | 'lost') {
  const stats = readQuotedleStats()
  if (stats.resultsByDay[dayKey]) return
  stats.resultsByDay[dayKey] = result
  stats.playedGames++
  if (result === 'won') stats.wonGames++
  window.localStorage.setItem(STATS_KEY, JSON.stringify(stats))
}

function formatElapsed(ms: number): string {
  const mins = Math.floor(ms / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
}

function ResultPanel({
  answer, points, status, attempts, maxAttempts, startedAt, completedAt,
}: {
  answer?: string; points: number; status: QuotedleGameStatus
  attempts: number; maxAttempts: number; startedAt?: string; completedAt?: string
}) {
  if (status === 'playing') return null
  const isWon = status === 'won'
  const timeLabel = startedAt && completedAt
    ? formatElapsed(new Date(completedAt).getTime() - new Date(startedAt).getTime())
    : undefined
  return (
    <div className={cn('animate-footwordle-result relative overflow-hidden rounded-3xl border p-5 shadow-2xl',
      isWon ? 'border-fuchsia-700/70 bg-fuchsia-950/40 shadow-fuchsia-950/30' : 'border-rose-800/70 bg-rose-950/30 shadow-rose-950/20'
    )}>
      {isWon && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {['left-6 top-6', 'left-1/3 top-2', 'right-8 top-8', 'right-1/4 bottom-4'].map(position => (
            <span key={position} className={cn('animate-footwordle-confetti absolute h-2 w-2 rounded-full bg-fuchsia-300', position)} />
          ))}
        </div>
      )}
      <div className="relative">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-gray-400">{isWon ? 'Brawo!' : 'Koniec prob'}</p>
        <h2 className="mt-2 text-2xl font-black text-white">{isWon ? 'Odgadles autora!' : 'Poprawna odpowiedz:'}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-bold text-gray-400">{attempts}/{maxAttempts} prob</span>
          {isWon && <span className="rounded-full bg-fuchsia-950 px-3 py-1 text-xs font-bold text-fuchsia-400">+{points} pkt</span>}
          {timeLabel && <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-bold text-gray-400">⏱ {timeLabel}</span>}
        </div>
        <div className="mt-4 rounded-2xl border border-white/10 bg-gray-950/70 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Autor cytatu</p>
          <p className="mt-1 text-3xl font-black tracking-tight text-white">{answer ?? '--'}</p>
        </div>
        <Link href="/daily-challenge" className={cn('mt-4 inline-flex w-full items-center justify-center rounded-full px-4 py-2.5 text-sm font-black transition',
          isWon ? 'bg-fuchsia-400 text-gray-950 hover:bg-fuchsia-300' : 'bg-rose-400 text-gray-950 hover:bg-rose-300'
        )}>
          Wróć do Daily Challenge
        </Link>
      </div>
    </div>
  )
}

function HintBadge({ hint, index }: { hint: string; index: number }) {
  return (
    <span
      className="animate-footwordle-reveal inline-flex items-center gap-1.5 rounded-full border border-fuchsia-700/50 bg-fuchsia-950/60 px-3 py-1.5 text-xs font-bold text-fuchsia-200"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <span className="text-fuchsia-400">{index + 1}.</span>
      {hint}
    </span>
  )
}

export function QuotedleGame({ puzzle }: { puzzle: QuotedlePublicPuzzle }) {
  const storedGame = useSyncExternalStore(
    callback => subscribeToStoredGame(puzzle.dayKey, callback),
    () => readStoredGame(puzzle.dayKey, puzzle.maxAttempts),
    () => null
  )
  const game = storedGame ?? createEmptyGame(puzzle.dayKey)
  const { wrongGuesses, hintsRevealed, status } = game
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [isPending, startTransition] = useTransition()
  const isLocked = isPending || isChecking || status !== 'playing'
  const earnedPoints = game.earnedPoints ?? (status === 'won' ? puzzle.maxPoints : 0)
  const attemptsLeft = puzzle.maxAttempts - game.attempts

  const visibleMessage =
    message ??
    (status === 'playing'
      ? `Wpisz pelne imie i nazwisko. Zostalo ${attemptsLeft} ${attemptsLeft === 1 ? 'proba' : 'prob'}.`
      : 'Gra zakonczona lokalnie.')

  function submitGuess(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    if (isLocked) return

    const trimmed = query.trim()
    if (!trimmed) {
      setMessage('Wpisz nazwisko autora.')
      return
    }

    const nextAttemptNumber = game.attempts + 1
    const startedAt = game.startedAt ?? (game.attempts === 0 ? new Date().toISOString() : undefined)
    setIsChecking(true)

    startTransition(async () => {
      try {
        const response = await evaluateQuotedleGuess(trimmed, puzzle.dayKey, nextAttemptNumber)
        if (!response.ok) { setMessage(response.error); return }

        const { result } = response
        const nextStatus: QuotedleGameStatus = result.isCorrect
          ? 'won'
          : nextAttemptNumber >= puzzle.maxAttempts ? 'lost' : 'playing'
        const completedAt = nextStatus !== 'playing' ? new Date().toISOString() : undefined

        const rawEarned = result.earnedPoints ?? 0
        const multipliedEarned = nextStatus !== 'playing'
          ? Math.round(rawEarned * getMultiplierForDay(puzzle.dayKey))
          : rawEarned

        writeStoredGame({
          dayKey: puzzle.dayKey,
          attempts: nextAttemptNumber,
          wrongGuesses: result.isCorrect ? wrongGuesses : [...wrongGuesses, trimmed],
          hintsRevealed: result.hintsRevealed.length > 0 ? result.hintsRevealed : hintsRevealed,
          status: nextStatus,
          revealedAnswer: result.revealedAnswer,
          earnedPoints: multipliedEarned,
          startedAt: startedAt ?? game.startedAt,
          completedAt: completedAt ?? game.completedAt,
        })

        if (nextStatus !== 'playing') recordQuotedleStats(puzzle.dayKey, nextStatus)
        if (nextStatus !== 'playing') void saveDailyResult('quotedle', puzzle.dayKey, multipliedEarned)
        setQuery('')

        if (nextStatus === 'won') setMessage(`Brawo! +${multipliedEarned} pkt.`)
        else if (nextStatus === 'lost') setMessage('Koniec prob. Odpowiedz jest w panelu wyniku.')
        else setMessage(`Pudlo! Zostalo ${puzzle.maxAttempts - nextAttemptNumber} prob. Sprawdz wskazowki.`)
      } finally {
        setIsChecking(false)
      }
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <section className="space-y-4">
        <div className="rounded-3xl border border-gray-800 bg-gray-900 p-4 lg:p-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-fuchsia-500">Cytat dnia</p>
          <blockquote className="mt-3 rounded-2xl border border-fuchsia-900/40 bg-fuchsia-950/20 p-4 lg:p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-400/70 mb-3">💬 Kto to powiedział?</p>
            <p className="text-lg font-black leading-7 text-white lg:text-xl">
              &ldquo;{puzzle.quote}&rdquo;
            </p>
            <footer className="mt-3 text-sm font-bold text-gray-500 tracking-widest">
              — ??? ??? ???
            </footer>
          </blockquote>

          {hintsRevealed.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                Wskazowki ({hintsRevealed.length}/{puzzle.hintsCount})
              </p>
              <div className="flex flex-wrap gap-2">
                {hintsRevealed.map((hint, i) => (
                  <HintBadge key={i} hint={hint} index={i} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-gray-800 bg-gray-900 p-4">
          <form onSubmit={submitGuess}>
            <label htmlFor="quotedle-search" className="text-xs font-black uppercase tracking-[0.22em] text-gray-500">
              Wpisz pelne imie i nazwisko autora
            </label>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                id="quotedle-search"
                type="text"
                value={query}
                onChange={event => setQuery(event.target.value)}
                disabled={isLocked}
                placeholder="np. Johan Cruyff"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="min-h-12 flex-1 rounded-2xl border border-gray-700 bg-gray-900 px-4 text-base font-bold text-white outline-none transition placeholder:text-gray-600 focus:border-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={isLocked}
                className="min-h-12 rounded-2xl bg-fuchsia-500 px-5 text-sm font-black text-gray-950 transition hover:bg-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Sprawdź
              </button>
            </div>
            <p className="mt-3 min-h-6 text-sm font-semibold text-gray-300">{visibleMessage}</p>
          </form>

          {wrongGuesses.length > 0 && (
            <div className="mt-4 border-t border-gray-800 pt-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">Bledne odpowiedzi</p>
              <div className="flex flex-wrap gap-2">
                {wrongGuesses.map((name, i) => (
                  <span key={i} className="rounded-full border border-rose-900/60 bg-rose-950/40 px-3 py-1 text-xs font-bold text-rose-300 line-through">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="hidden rounded-2xl border border-gray-800 bg-gray-900 px-4 py-3 sm:flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-fuchsia-500" />
          <p className="text-xs font-semibold text-gray-400">
            Wskazowki pojawiaja sie po kazdej blednej probie — im pozniej odgadniesz, tym mniej punktow.
          </p>
        </div>
      </section>

      <aside className="space-y-4">
        {status === 'playing' && (
          <div className="rounded-3xl border border-gray-800/60 bg-gray-950/50 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-gray-600">Autor cytatu</p>
            <div className="mt-3 rounded-2xl border border-white/5 bg-gray-900 p-4">
              <p className="text-xl font-black tracking-widest text-gray-700">??? ??? ???</p>
              <p className="mt-1 text-xs text-gray-700">Ukryty do zakończenia gry</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl border border-gray-800 bg-gray-950 p-2">
                <p className="text-[9px] font-bold uppercase text-gray-600">Proba</p>
                <p className="mt-0.5 text-lg font-black text-white">{game.attempts}/{puzzle.maxAttempts}</p>
              </div>
              <div className="rounded-xl border border-fuchsia-900/40 bg-fuchsia-950/20 p-2">
                <p className="text-[9px] font-bold uppercase text-gray-600">Maks. pkt</p>
                <p className="mt-0.5 text-lg font-black text-fuchsia-300">
                  {game.attempts === 0 ? puzzle.maxPoints : Math.max(20, puzzle.maxPoints - game.attempts * 20)}
                </p>
              </div>
            </div>
          </div>
        )}

        <ResultPanel
          answer={game.revealedAnswer}
          points={earnedPoints}
          status={status}
          attempts={game.attempts}
          maxAttempts={puzzle.maxAttempts}
          startedAt={game.startedAt}
          completedAt={game.completedAt}
        />

        <div className="rounded-3xl border border-fuchsia-900/60 bg-gray-950/80 p-5 shadow-2xl shadow-fuchsia-950/20">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-gray-500">Zasady</p>
          <h2 className="mt-2 text-2xl font-black text-white">5 prób, 5 wskazówek</h2>
          <p className="mt-2 text-sm leading-6 text-gray-400">
            Przeczytaj cytat i wpisz autora. Kazda bledna proba odkrywa kolejna wskazowke. Im szybciej odgadniesz, tym wiecej punktow.
          </p>
          <div className="mt-4 grid grid-cols-5 gap-1 rounded-2xl border border-white/5 bg-gray-900 p-3">
            {[100, 80, 60, 40, 20].map((pts, i) => (
              <div key={i} className={cn('rounded-xl p-2 text-center',
                game.attempts === i + 1 && status === 'won'
                  ? 'border border-fuchsia-500 bg-fuchsia-950/60'
                  : 'bg-gray-950'
              )}>
                <p className="text-[8px] font-bold uppercase text-gray-600">{i + 1}. proba</p>
                <p className="mt-0.5 text-sm font-black text-fuchsia-300">{pts}</p>
              </div>
            ))}
          </div>
        </div>

        <Link
          href="/daily-challenge"
          className="inline-flex w-full items-center justify-center rounded-full border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm font-black text-gray-200 transition hover:border-fuchsia-700 hover:text-fuchsia-300"
        >
          Wróć do Daily Challenge
        </Link>
      </aside>
    </div>
  )
}
