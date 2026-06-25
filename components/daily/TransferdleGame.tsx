'use client'

import Link from 'next/link'
import { FormEvent, useState, useSyncExternalStore, useTransition } from 'react'
import { evaluateTransferdleGuess } from '@/app/(main)/daily-challenge/transferdle/actions'
import { cn } from '@/lib/utils'
import type {
  TransferdleGameStatus,
  TransferdlePublicPuzzle,
  TransferdleStats,
  TransferdleStoredGame,
} from '@/lib/transferdle-types'

const POINTS_BY_ATTEMPT = [100, 85, 70, 55, 40, 25, 15, 5]
const STATS_KEY = 'daily-challenge:transferdle:stats'

const storedGameSnapshotCache = new Map<string, { raw: string | null; value: TransferdleStoredGame | null }>()

function storageKey(dayKey: string): string {
  return `daily-challenge:transferdle:${dayKey}`
}

function storageEventName(dayKey: string): string {
  return `daily-challenge:transferdle-updated:${dayKey}`
}

function createEmptyGame(dayKey: string, transfersCount: number): TransferdleStoredGame {
  return {
    dayKey,
    attempts: 0,
    wrongGuesses: [],
    revealedTransfers: [],
    status: 'playing',
  }
}

function isStoredGame(value: unknown, dayKey: string): value is TransferdleStoredGame {
  if (!value || typeof value !== 'object') return false
  const c = value as Partial<TransferdleStoredGame>
  return (
    c.dayKey === dayKey &&
    typeof c.attempts === 'number' &&
    Array.isArray(c.wrongGuesses) &&
    Array.isArray(c.revealedTransfers) &&
    (c.status === 'playing' || c.status === 'won' || c.status === 'lost')
  )
}

function readStoredGame(dayKey: string, maxAttempts: number): TransferdleStoredGame | null {
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
    storedGameSnapshotCache.set(cacheKey, { raw: saved, value: parsed })
    return parsed
  } catch {
    window.localStorage.removeItem(key)
    storedGameSnapshotCache.set(cacheKey, { raw: null, value: null })
    return null
  }
}

function writeStoredGame(game: TransferdleStoredGame) {
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

function readTransferdleStats(): TransferdleStats {
  if (typeof window === 'undefined') return { playedGames: 0, wonGames: 0, resultsByDay: {} }
  const saved = window.localStorage.getItem(STATS_KEY)
  if (!saved) return { playedGames: 0, wonGames: 0, resultsByDay: {} }
  try { return JSON.parse(saved) as TransferdleStats } catch { return { playedGames: 0, wonGames: 0, resultsByDay: {} } }
}

function recordTransferdleStats(dayKey: string, result: 'won' | 'lost') {
  const stats = readTransferdleStats()
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

function TransferPath({
  revealedTransfers,
  totalCount,
}: {
  revealedTransfers: string[]
  totalCount: number
}) {
  const hiddenCount = totalCount - revealedTransfers.length
  // slots ordered oldest → newest for display
  const revealedForDisplay = [...revealedTransfers].reverse()
  const slots: Array<{ type: 'hidden'; index: number } | { type: 'revealed'; club: string; displayIndex: number }> = [
    ...Array.from({ length: hiddenCount }, (_, i) => ({ type: 'hidden' as const, index: i })),
    ...revealedForDisplay.map((club, displayIndex) => ({ type: 'revealed' as const, club, displayIndex })),
  ]

  return (
    <div className="flex flex-col gap-0">
      {slots.map((slot, slotIndex) => {
        const isLast = slotIndex === slots.length - 1
        const isFirst = slotIndex === 0
        return (
          <div key={slotIndex} className="flex items-stretch gap-3">
            {/* vertical line + dot */}
            <div className="flex flex-col items-center">
              <div className={cn(
                'mt-1 h-3 w-3 rounded-full border-2 flex-shrink-0',
                slot.type === 'revealed' && slot.displayIndex === revealedForDisplay.length - 1
                  ? 'border-violet-400 bg-violet-400'
                  : slot.type === 'revealed'
                    ? 'border-violet-700 bg-violet-900'
                    : 'border-gray-700 bg-gray-800'
              )} />
              {!isLast && (
                <div className={cn(
                  'w-0.5 flex-1 my-0.5',
                  slot.type === 'revealed' ? 'bg-violet-800/60' : 'bg-gray-800'
                )} style={{ minHeight: '24px' }} />
              )}
            </div>

            {/* card */}
            <div className="pb-3 flex-1">
              {slot.type === 'hidden' ? (
                <div className="flex h-12 items-center rounded-xl border border-dashed border-gray-700 bg-gray-900 px-4">
                  <span className="text-sm font-black text-gray-700">?</span>
                  <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-gray-700">
                    {isFirst ? 'Najstarszy klub' : 'Nieznany'}
                  </span>
                </div>
              ) : (
                <div className={cn(
                  'flex h-12 items-center rounded-xl border px-4 animate-footwordle-reveal',
                  slot.displayIndex === revealedForDisplay.length - 1
                    ? 'border-violet-500/70 bg-violet-500/15 text-violet-100'
                    : 'border-violet-800/50 bg-violet-950/30 text-violet-300'
                )} style={{ animationDelay: `${slot.displayIndex * 80}ms` }}>
                  <div className="flex flex-1 items-center justify-between gap-2">
                    <span className="text-sm font-black">{slot.club}</span>
                    <span className="text-[9px] font-bold uppercase tracking-widest opacity-50">
                      {slot.displayIndex === revealedForDisplay.length - 1 ? 'Aktualny' : `${revealedForDisplay.length - 1 - slot.displayIndex} wcześniej`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ResultPanel({
  answer, points, status, attempts, maxAttempts, startedAt, completedAt,
}: {
  answer?: string; points: number; status: TransferdleGameStatus
  attempts: number; maxAttempts: number; startedAt?: string; completedAt?: string
}) {
  if (status === 'playing') return null
  const isWon = status === 'won'
  const timeLabel = startedAt && completedAt
    ? formatElapsed(new Date(completedAt).getTime() - new Date(startedAt).getTime())
    : undefined
  return (
    <div className={cn('animate-footwordle-result relative overflow-hidden rounded-3xl border p-5 shadow-2xl',
      isWon ? 'border-violet-700/70 bg-violet-950/40 shadow-violet-950/30' : 'border-rose-800/70 bg-rose-950/30 shadow-rose-950/20'
    )}>
      {isWon && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {['left-6 top-6', 'left-1/3 top-2', 'right-8 top-8', 'right-1/4 bottom-4'].map(pos => (
            <span key={pos} className={cn('animate-footwordle-confetti absolute h-2 w-2 rounded-full bg-violet-300', pos)} />
          ))}
        </div>
      )}
      <div className="relative">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-gray-400">{isWon ? 'Brawo!' : 'Koniec prob'}</p>
        <h2 className="mt-2 text-2xl font-black text-white">{isWon ? 'Odgadles piłkarza!' : 'Poprawna odpowiedz:'}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-bold text-gray-400">{attempts}/{maxAttempts} prob</span>
          {isWon && <span className="rounded-full bg-violet-950 px-3 py-1 text-xs font-bold text-violet-400">+{points} pkt</span>}
          {timeLabel && <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-bold text-gray-400">⏱ {timeLabel}</span>}
        </div>
        <div className="mt-4 rounded-2xl border border-white/10 bg-gray-950/70 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Piłkarz dnia</p>
          <p className="mt-1 text-3xl font-black tracking-tight text-white">{answer ?? '--'}</p>
        </div>
        <Link href="/daily-challenge" className={cn('mt-4 inline-flex w-full items-center justify-center rounded-full px-4 py-2.5 text-sm font-black transition',
          isWon ? 'bg-violet-400 text-gray-950 hover:bg-violet-300' : 'bg-rose-400 text-gray-950 hover:bg-rose-300'
        )}>
          Wróć do Daily Challenge
        </Link>
      </div>
    </div>
  )
}

export function TransferdleGame({ puzzle }: { puzzle: TransferdlePublicPuzzle }) {
  const storedGame = useSyncExternalStore(
    callback => subscribeToStoredGame(puzzle.dayKey, callback),
    () => readStoredGame(puzzle.dayKey, puzzle.maxAttempts),
    () => null
  )
  const game = storedGame ?? createEmptyGame(puzzle.dayKey, puzzle.transfersCount)
  const { wrongGuesses, revealedTransfers, status } = game

  // On first render (no stored game), reveal only the first (current) club — but
  // we don't have the club name yet; the server sends it on first wrong guess or
  // we handle it: actually the initial state shows 0 revealed transfers since
  // we only get them from the server. We show "?" until first submission.
  // Special case: if game was just started and revealedTransfers is empty,
  // show 1 slot as "?" with a special "aktualy" label noting it'll appear after first attempt.
  // Actually let's just show all slots as "?" until first server response.

  const [query, setQuery] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [isPending, startTransition] = useTransition()
  const isLocked = isPending || isChecking || status !== 'playing'
  const earnedPoints = game.earnedPoints ?? (status === 'won' ? puzzle.maxPoints : 0)
  const attemptsLeft = puzzle.maxAttempts - game.attempts
  const currentPoints = game.attempts < puzzle.maxAttempts
    ? (POINTS_BY_ATTEMPT[game.attempts] ?? 5)
    : 0

  const visibleMessage =
    message ??
    (status === 'playing'
      ? game.attempts === 0
        ? 'Widzisz aktualny klub piłkarza po pierwszej probie. Wpisz imię i nazwisko.'
        : `Zostalo ${attemptsLeft} ${attemptsLeft === 1 ? 'proba' : 'prob'}. Mozliwe punkty: ${currentPoints} pkt.`
      : 'Gra zakonczona lokalnie.')

  function submitGuess(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    if (isLocked) return

    const trimmed = query.trim()
    if (!trimmed) {
      setMessage('Wpisz imię i nazwisko piłkarza.')
      return
    }

    const nextAttemptNumber = game.attempts + 1
    const startedAt = game.startedAt ?? (game.attempts === 0 ? new Date().toISOString() : undefined)
    setIsChecking(true)

    startTransition(async () => {
      try {
        const response = await evaluateTransferdleGuess(trimmed, puzzle.dayKey, nextAttemptNumber)
        if (!response.ok) { setMessage(response.error); return }

        const { result } = response
        const nextStatus: TransferdleGameStatus = result.isCorrect
          ? 'won'
          : nextAttemptNumber >= puzzle.maxAttempts ? 'lost' : 'playing'
        const completedAt = nextStatus !== 'playing' ? new Date().toISOString() : undefined

        writeStoredGame({
          dayKey: puzzle.dayKey,
          attempts: nextAttemptNumber,
          wrongGuesses: result.isCorrect ? wrongGuesses : [...wrongGuesses, trimmed],
          revealedTransfers: result.revealedTransfers,
          status: nextStatus,
          revealedAnswer: result.revealedAnswer,
          earnedPoints: result.earnedPoints,
          startedAt: startedAt ?? game.startedAt,
          completedAt: completedAt ?? game.completedAt,
        })

        if (nextStatus !== 'playing') recordTransferdleStats(puzzle.dayKey, nextStatus)
        setQuery('')

        if (nextStatus === 'won') setMessage(`Brawo! +${result.earnedPoints ?? 0} pkt.`)
        else if (nextStatus === 'lost') setMessage('Koniec prob. Sprawdz odpowiedz w panelu.')
        else {
          const remaining = puzzle.maxAttempts - nextAttemptNumber
          const nextPts = POINTS_BY_ATTEMPT[nextAttemptNumber] ?? 5
          setMessage(`Pudlo! Odkryto kolejny klub. Zostalo ${remaining} prob (maks. ${nextPts} pkt).`)
        }
      } finally {
        setIsChecking(false)
      }
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <section className="space-y-4">
        <div className="rounded-3xl border border-gray-800 bg-gray-900 p-4 lg:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-500">Ścieżka transferów</p>
              <h2 className="mt-1 text-xl font-black text-white">Kto to?</h2>
            </div>
            <span className={cn('rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide',
              status === 'won' && 'bg-violet-950 text-violet-300',
              status === 'lost' && 'bg-rose-950 text-rose-300',
              status === 'playing' && 'bg-gray-950 text-gray-400'
            )}>
              {status === 'won' ? 'Ukonczono' : status === 'lost' ? 'Koniec prob' : 'W trakcie'}
            </span>
          </div>

          <div className="rounded-2xl border border-violet-900/40 bg-violet-950/10 p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-400/70">
              Kariera (najstarszy → aktualny) · odkryto {revealedTransfers.length}/{puzzle.transfersCount}
            </p>
            <TransferPath
              revealedTransfers={revealedTransfers}
              totalCount={puzzle.transfersCount}
            />
            {revealedTransfers.length === 0 && (
              <p className="mt-3 text-xs text-gray-600">
                Po pierwszej probie zobaczysz aktualny klub piłkarza.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-gray-800 bg-gray-900 p-4">
          <form onSubmit={submitGuess}>
            <label htmlFor="transferdle-search" className="text-xs font-black uppercase tracking-[0.22em] text-gray-500">
              Kto to jest? Wpisz imię i nazwisko
            </label>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                id="transferdle-search"
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                disabled={isLocked}
                placeholder="np. Cristiano Ronaldo"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="min-h-12 flex-1 rounded-2xl border border-gray-700 bg-gray-900 px-4 text-base font-bold text-white outline-none transition placeholder:text-gray-600 focus:border-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={isLocked}
                className="min-h-12 rounded-2xl bg-violet-500 px-5 text-sm font-black text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
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
      </section>

      <aside className="space-y-4">
        {status === 'playing' && (
          <div className="rounded-3xl border border-gray-800/60 bg-gray-950/50 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-gray-600">Piłkarz dnia</p>
            <div className="mt-3 rounded-2xl border border-white/5 bg-gray-900 p-4">
              <p className="text-xl font-black tracking-widest text-gray-700">??? ??? ???</p>
              <p className="mt-1 text-xs text-gray-700">Ukryty do zakończenia gry</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl border border-gray-800 bg-gray-950 p-2">
                <p className="text-[9px] font-bold uppercase text-gray-600">Proba</p>
                <p className="mt-0.5 text-lg font-black text-white">{game.attempts}/{puzzle.maxAttempts}</p>
              </div>
              <div className="rounded-xl border border-violet-900/40 bg-violet-950/20 p-2">
                <p className="text-[9px] font-bold uppercase text-gray-600">Maks. pkt</p>
                <p className="mt-0.5 text-lg font-black text-violet-300">{currentPoints}</p>
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

        <div className="rounded-3xl border border-violet-900/60 bg-gray-950/80 p-5 shadow-2xl shadow-violet-950/20">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-gray-500">Zasady</p>
          <h2 className="mt-2 text-2xl font-black text-white">8 prób · max 100 pkt</h2>
          <p className="mt-2 text-sm leading-6 text-gray-400">
            Każda błędna próba odkrywa kolejny (starszy) klub z kariery piłkarza. Im wcześniej zgadniesz, tym więcej punktów.
          </p>
          <div className="mt-4 grid grid-cols-4 gap-1 rounded-2xl border border-white/5 bg-gray-900 p-3">
            {POINTS_BY_ATTEMPT.map((pts, i) => (
              <div key={i} className={cn('rounded-xl p-2 text-center',
                game.attempts === i + 1 && status === 'won'
                  ? 'border border-violet-500 bg-violet-950/60'
                  : 'bg-gray-950'
              )}>
                <p className="text-[8px] font-bold uppercase text-gray-600">{i + 1}.</p>
                <p className="mt-0.5 text-sm font-black text-violet-300">{pts}</p>
              </div>
            ))}
          </div>
        </div>

        <Link
          href="/daily-challenge"
          className="inline-flex w-full items-center justify-center rounded-full border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm font-black text-gray-200 transition hover:border-violet-700 hover:text-violet-300"
        >
          Wróć do Daily Challenge
        </Link>
      </aside>
    </div>
  )
}
