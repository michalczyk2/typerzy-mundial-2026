'use client'

import Link from 'next/link'
import { useEffect, useState, useSyncExternalStore, useTransition } from 'react'
import { evaluateFootWordleGuess } from '@/app/(main)/daily-challenge/footwordle/actions'
import { cn } from '@/lib/utils'
import type {
  FootWordleGameStatus,
  FootWordleGuessResult,
  FootWordleLetterStatus,
  FootWordlePublicPuzzle,
  FootWordleStats,
  FootWordleStoredGame,
} from '@/lib/footwordle-types'

const KEYBOARD_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']
const STATS_STORAGE_KEY = 'daily-challenge:footwordle:stats'
const STATS_EVENT_NAME = 'daily-challenge:footwordle-stats-updated'

const STATUS_PRIORITY: Record<FootWordleLetterStatus, number> = {
  absent: 1,
  present: 2,
  correct: 3,
}

const emptyStats: FootWordleStats = {
  playedGames: 0,
  wonGames: 0,
  resultsByDay: {},
}

const storedGameSnapshotCache = new Map<
  string,
  {
    raw: string | null
    value: FootWordleStoredGame | null
  }
>()

let storedStatsSnapshotCache: {
  raw: string | null
  value: FootWordleStats
} = {
  raw: null,
  value: emptyStats,
}

function normalizeInput(value: string): string {
  return value
    .toLocaleUpperCase('pl-PL')
    .replace(/\u0141/g, 'L')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z]/g, '')
}

function storageKey(dayKey: string): string {
  return `daily-challenge:footwordle:${dayKey}`
}

function storageEventName(dayKey: string): string {
  return `daily-challenge:footwordle-updated:${dayKey}`
}

function createEmptyGame(dayKey: string): FootWordleStoredGame {
  return {
    dayKey,
    attempts: 0,
    guesses: [],
    status: 'playing',
  }
}

function isStoredGame(value: unknown, dayKey: string): value is FootWordleStoredGame {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<FootWordleStoredGame>

  return (
    candidate.dayKey === dayKey &&
    typeof candidate.attempts === 'number' &&
    Array.isArray(candidate.guesses) &&
    (candidate.status === 'playing' || candidate.status === 'won' || candidate.status === 'lost')
  )
}

function isStoredStats(value: unknown): value is FootWordleStats {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<FootWordleStats>

  return (
    typeof candidate.playedGames === 'number' &&
    typeof candidate.wonGames === 'number' &&
    Boolean(candidate.resultsByDay) &&
    typeof candidate.resultsByDay === 'object'
  )
}

function readStoredGame(dayKey: string, maxAttempts: number): FootWordleStoredGame | null {
  if (typeof window === 'undefined') {
    return null
  }

  const key = storageKey(dayKey)
  const cacheKey = `${key}:${maxAttempts}`
  const saved = window.localStorage.getItem(key)
  const cached = storedGameSnapshotCache.get(cacheKey)

  if (cached?.raw === saved) {
    return cached.value
  }

  if (!saved) {
    storedGameSnapshotCache.set(cacheKey, { raw: saved, value: null })
    return null
  }

  try {
    const parsed: unknown = JSON.parse(saved)

    if (!isStoredGame(parsed, dayKey)) {
      window.localStorage.removeItem(key)
      storedGameSnapshotCache.set(cacheKey, { raw: null, value: null })
      return null
    }

    const guesses = parsed.guesses.slice(0, maxAttempts)
    const value = {
      ...parsed,
      attempts: guesses.length,
      guesses,
    }

    storedGameSnapshotCache.set(cacheKey, { raw: saved, value })

    return value
  } catch {
    window.localStorage.removeItem(key)
    storedGameSnapshotCache.set(cacheKey, { raw: null, value: null })
    return null
  }
}

function readStoredStats(): FootWordleStats {
  if (typeof window === 'undefined') {
    return emptyStats
  }

  const saved = window.localStorage.getItem(STATS_STORAGE_KEY)

  if (storedStatsSnapshotCache.raw === saved) {
    return storedStatsSnapshotCache.value
  }

  if (!saved) {
    storedStatsSnapshotCache = { raw: saved, value: emptyStats }
    return emptyStats
  }

  try {
    const parsed: unknown = JSON.parse(saved)

    if (!isStoredStats(parsed)) {
      window.localStorage.removeItem(STATS_STORAGE_KEY)
      storedStatsSnapshotCache = { raw: null, value: emptyStats }
      return emptyStats
    }

    const normalizedStats = {
      playedGames: Math.max(0, parsed.playedGames),
      wonGames: Math.max(0, parsed.wonGames),
      resultsByDay: parsed.resultsByDay,
    }

    storedStatsSnapshotCache = { raw: saved, value: normalizedStats }

    return normalizedStats
  } catch {
    window.localStorage.removeItem(STATS_STORAGE_KEY)
    storedStatsSnapshotCache = { raw: null, value: emptyStats }
    return emptyStats
  }
}

function writeStoredGame(game: FootWordleStoredGame) {
  window.localStorage.setItem(storageKey(game.dayKey), JSON.stringify(game))
  window.dispatchEvent(new Event(storageEventName(game.dayKey)))
}

function writeStoredStats(stats: FootWordleStats) {
  window.localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats))
  window.dispatchEvent(new Event(STATS_EVENT_NAME))
}

function recordFootWordleStats(dayKey: string, result: 'won' | 'lost') {
  const currentStats = readStoredStats()

  if (currentStats.resultsByDay[dayKey]) {
    return
  }

  const resultsByDay = {
    ...currentStats.resultsByDay,
    [dayKey]: result,
  }

  writeStoredStats({
    playedGames: Object.keys(resultsByDay).length,
    wonGames: Object.values(resultsByDay).filter(dayResult => dayResult === 'won').length,
    resultsByDay,
  })
}

function subscribeToStoredGame(dayKey: string, callback: () => void) {
  function onStorage(event: StorageEvent) {
    if (!event.key || event.key === storageKey(dayKey)) {
      callback()
    }
  }

  window.addEventListener('storage', onStorage)
  window.addEventListener(storageEventName(dayKey), callback)

  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(storageEventName(dayKey), callback)
  }
}

function subscribeToStoredStats(callback: () => void) {
  function onStorage(event: StorageEvent) {
    if (!event.key || event.key === STATS_STORAGE_KEY) {
      callback()
    }
  }

  window.addEventListener('storage', onStorage)
  window.addEventListener(STATS_EVENT_NAME, callback)

  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(STATS_EVENT_NAME, callback)
  }
}

function getTileClass(status?: FootWordleLetterStatus, isCurrent = false): string {
  if (status === 'correct') {
    return 'border-emerald-400 bg-emerald-500 text-gray-950 shadow-lg shadow-emerald-950/40'
  }

  if (status === 'present') {
    return 'border-amber-300 bg-amber-400 text-gray-950 shadow-lg shadow-amber-950/30'
  }

  if (status === 'absent') {
    return 'border-gray-600 bg-gray-700 text-gray-300'
  }

  if (isCurrent) {
    return 'border-emerald-800/80 bg-gray-900 text-white'
  }

  return 'border-gray-800 bg-gray-950/80 text-gray-700'
}

function getKeyboardClass(status?: FootWordleLetterStatus): string {
  if (status === 'correct') {
    return 'bg-emerald-500 text-gray-950 border-emerald-400'
  }

  if (status === 'present') {
    return 'bg-amber-400 text-gray-950 border-amber-300'
  }

  if (status === 'absent') {
    return 'bg-gray-700 text-gray-300 border-gray-600'
  }

  return 'bg-gray-900 text-gray-200 border-gray-700 hover:bg-gray-800'
}

function buildKeyboardStatuses(guesses: FootWordleGuessResult[]) {
  const statuses = new Map<string, FootWordleLetterStatus>()

  guesses.forEach(guess => {
    guess.tiles.forEach(tile => {
      const previous = statuses.get(tile.letter)

      if (!previous || STATUS_PRIORITY[tile.status] > STATUS_PRIORITY[previous]) {
        statuses.set(tile.letter, tile.status)
      }
    })
  })

  return statuses
}

function getWinRate(stats: FootWordleStats): number {
  if (stats.playedGames === 0) {
    return 0
  }

  return Math.round((stats.wonGames / stats.playedGames) * 100)
}

function getDefaultMessage(game: FootWordleStoredGame, puzzle: FootWordlePublicPuzzle): string {
  if (game.status === 'won') {
    return 'Zwyciestwo zapisane lokalnie. Swietna robota.'
  }

  if (game.status === 'lost') {
    return 'Gra zakonczona. Poprawne haslo jest w panelu wyniku.'
  }

  if (game.guesses.length > 0) {
    return `Wrociles do gry. Proba ${game.guesses.length + 1}/${puzzle.maxAttempts}.`
  }

  return `Wpisz haslo o dlugosci ${puzzle.answerLength} liter.`
}

function ResultPanel({
  answer,
  points,
  status,
}: {
  answer?: string
  points: number
  status: FootWordleGameStatus
}) {
  if (status === 'playing') {
    return null
  }

  const isWon = status === 'won'

  return (
    <div
      className={cn(
        'animate-footwordle-result relative overflow-hidden rounded-3xl border p-5 shadow-2xl',
        isWon
          ? 'border-emerald-700/70 bg-emerald-950/40 shadow-emerald-950/30'
          : 'border-rose-800/70 bg-rose-950/30 shadow-rose-950/20'
      )}
    >
      {isWon && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {['left-6 top-6', 'left-1/3 top-2', 'right-8 top-8', 'right-1/4 bottom-4'].map(
            position => (
              <span
                key={position}
                className={cn(
                  'animate-footwordle-confetti absolute h-2 w-2 rounded-full bg-emerald-300',
                  position
                )}
              />
            )
          )}
        </div>
      )}

      <div className="relative">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-gray-400">
          {isWon ? 'Zwyciestwo' : 'Koniec gry'}
        </p>
        <h2 className="mt-2 text-2xl font-black text-white">
          {isWon ? 'Brawo! Haslo odgadniete.' : 'Tym razem bez trafienia.'}
        </h2>
        <p className="mt-2 text-sm leading-6 text-gray-300">
          {isWon
            ? `Zdobywasz ${points} pkt w dzisiejszym FootWordle.`
            : 'Poprawne haslo jest ujawnione ponizej. Jutro wpada nowa szansa.'}
        </p>

        <div className="mt-4 rounded-2xl border border-white/10 bg-gray-950/70 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
            Poprawne haslo
          </p>
          <p className="mt-1 break-all text-3xl font-black tracking-[0.12em] text-white">
            {answer ?? '--'}
          </p>
        </div>

        <Link
          href="/daily-challenge"
          className={cn(
            'mt-4 inline-flex w-full items-center justify-center rounded-full px-4 py-2.5 text-sm font-black transition',
            isWon
              ? 'bg-emerald-400 text-gray-950 hover:bg-emerald-300'
              : 'bg-rose-400 text-gray-950 hover:bg-rose-300'
          )}
        >
          Wróć do Daily Challenge
        </Link>
      </div>
    </div>
  )
}

function StatsPanel({ stats }: { stats: FootWordleStats }) {
  const winRate = getWinRate(stats)

  return (
    <div className="rounded-3xl border border-gray-800 bg-gray-900 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-gray-500">
        Statystyki localStorage
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-gray-950 p-3">
          <p className="text-2xl font-black text-white">{stats.playedGames}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-gray-600">
            Gry
          </p>
        </div>
        <div className="rounded-2xl bg-gray-950 p-3">
          <p className="text-2xl font-black text-emerald-300">{stats.wonGames}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-gray-600">
            Wygrane
          </p>
        </div>
        <div className="rounded-2xl bg-gray-950 p-3">
          <p className="text-2xl font-black text-cyan-300">{winRate}%</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-gray-600">
            Win rate
          </p>
        </div>
      </div>
    </div>
  )
}

export function FootWordleGame({ puzzle }: { puzzle: FootWordlePublicPuzzle }) {
  const storedGame = useSyncExternalStore(
    callback => subscribeToStoredGame(puzzle.dayKey, callback),
    () => readStoredGame(puzzle.dayKey, puzzle.maxAttempts),
    () => null
  )
  const stats = useSyncExternalStore(
    subscribeToStoredStats,
    readStoredStats,
    () => emptyStats
  )
  const game = storedGame ?? createEmptyGame(puzzle.dayKey)
  const { guesses, status } = game
  const [currentGuess, setCurrentGuess] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [isPending, startTransition] = useTransition()
  const isLocked = isPending || isChecking
  const keyboardStatuses = buildKeyboardStatuses(guesses)
  const visibleMessage = message ?? getDefaultMessage(game, puzzle)
  const terminalAnswer =
    game.revealedAnswer ??
    guesses.find(guess => guess.isCorrect)?.guess ??
    guesses.find(guess => guess.revealedAnswer)?.revealedAnswer
  const earnedPoints = game.earnedPoints ?? (status === 'won' ? puzzle.maxPoints : 0)

  function addLetter(value: string) {
    if (status !== 'playing' || isLocked) {
      return
    }

    const letter = normalizeInput(value).slice(0, 1)
    if (!letter) {
      return
    }

    setCurrentGuess(previous => {
      if (previous.length >= puzzle.answerLength) {
        return previous
      }

      return `${previous}${letter}`
    })
  }

  function removeLetter() {
    if (status !== 'playing' || isLocked) {
      return
    }

    setCurrentGuess(previous => previous.slice(0, -1))
  }

  function submitGuess() {
    if (status !== 'playing' || isLocked) {
      return
    }

    if (currentGuess.length !== puzzle.answerLength) {
      setMessage(`Haslo ma ${puzzle.answerLength} liter.`)
      return
    }

    const guessToSubmit = currentGuess
    const nextAttemptNumber = guesses.length + 1
    setIsChecking(true)

    startTransition(async () => {
      try {
        const response = await evaluateFootWordleGuess(
          guessToSubmit,
          puzzle.dayKey,
          nextAttemptNumber
        )

        if (!response.ok) {
          setMessage(response.error)
          return
        }

        const nextGuesses = [...guesses, response.result]
        const nextStatus: FootWordleGameStatus = response.result.isCorrect
          ? 'won'
          : nextGuesses.length >= puzzle.maxAttempts
            ? 'lost'
            : 'playing'
        const revealedAnswer =
          nextStatus === 'playing'
            ? undefined
            : response.result.revealedAnswer ?? response.result.guess
        const points = nextStatus === 'won' ? puzzle.maxPoints : 0

        writeStoredGame({
          dayKey: puzzle.dayKey,
          attempts: nextGuesses.length,
          guesses: nextGuesses,
          status: nextStatus,
          revealedAnswer,
          earnedPoints: nextStatus === 'playing' ? undefined : points,
        })
        setCurrentGuess('')

        if (nextStatus === 'won') {
          setMessage(`Brawo! Zdobywasz ${points} pkt.`)
        } else if (nextStatus === 'lost') {
          setMessage('Koniec prob. Zobacz poprawne haslo w panelu wyniku.')
        } else {
          setMessage(`Proba ${nextGuesses.length}/${puzzle.maxAttempts} zapisana. Graj dalej.`)
        }
      } finally {
        setIsChecking(false)
      }
    })
  }

  function handleKey(value: string) {
    if (value === 'ENTER') {
      submitGuess()
      return
    }

    if (value === 'BACKSPACE') {
      removeLetter()
      return
    }

    addLetter(value)
  }

  useEffect(() => {
    if (status === 'won' || status === 'lost') {
      recordFootWordleStats(puzzle.dayKey, status)
    }
  }, [puzzle.dayKey, status])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const isEditable =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable

      if (isEditable) {
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        handleKey('ENTER')
        return
      }

      if (event.key === 'Backspace') {
        event.preventDefault()
        handleKey('BACKSPACE')
        return
      }

      const normalized = normalizeInput(event.key)
      if (normalized.length === 1) {
        event.preventDefault()
        handleKey(normalized)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <section className="rounded-3xl border border-gray-800 bg-gray-900 p-4 lg:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-500">
              Plansza FootWordle
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {puzzle.maxAttempts} prob, {puzzle.answerLength} liter
            </p>
          </div>
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide',
              status === 'won' && 'bg-emerald-950 text-emerald-300',
              status === 'lost' && 'bg-rose-950 text-rose-300',
              status === 'playing' && 'bg-gray-950 text-gray-400'
            )}
          >
            {status === 'won' ? 'Ukonczono' : status === 'lost' ? 'Koniec prob' : 'W trakcie'}
          </span>
        </div>

        <div className="mx-auto space-y-1.5">
          {Array.from({ length: puzzle.maxAttempts }).map((_, rowIndex) => {
            const submittedGuess = guesses[rowIndex]
            const isCurrentRow = rowIndex === guesses.length && status === 'playing'

            return (
              <div
                key={rowIndex}
                className="grid justify-center gap-1 sm:gap-1.5"
                style={{
                  gridTemplateColumns: `repeat(${puzzle.answerLength}, minmax(1.35rem, 2.65rem))`,
                }}
              >
                {Array.from({ length: puzzle.answerLength }).map((__, columnIndex) => {
                  const submittedTile = submittedGuess?.tiles[columnIndex]
                  const currentLetter = isCurrentRow ? currentGuess[columnIndex] : ''

                  return (
                    <div
                      key={`${rowIndex}-${columnIndex}`}
                      className={cn(
                        'flex aspect-square min-h-6 items-center justify-center rounded-lg border text-base font-black transition sm:text-lg lg:text-xl',
                        submittedTile && 'animate-footwordle-reveal',
                        getTileClass(submittedTile?.status, Boolean(currentLetter))
                      )}
                      style={
                        submittedTile ? { animationDelay: `${columnIndex * 70}ms` } : undefined
                      }
                    >
                      {submittedTile?.letter ?? currentLetter ?? ''}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        <div className="mt-4 rounded-3xl border border-gray-800 bg-gray-950/55 p-3">
          <p className="min-h-6 text-center text-sm font-semibold text-gray-300">
            {visibleMessage}
          </p>
          <div className="mt-3 space-y-1.5">
            {KEYBOARD_ROWS.map((row, rowIndex) => (
              <div key={row} className="flex justify-center gap-1">
                {rowIndex === 2 && (
                  <button
                    type="button"
                    onClick={() => handleKey('ENTER')}
                    disabled={status !== 'playing' || isLocked}
                    className="h-9 rounded-lg border border-gray-700 bg-gray-900 px-2 text-[10px] font-black text-gray-200 transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3"
                  >
                    Enter
                  </button>
                )}
                {[...row].map(letter => (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => handleKey(letter)}
                    disabled={status !== 'playing' || isLocked}
                    className={cn(
                      'h-9 min-w-7 rounded-lg border px-1.5 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:min-w-8 sm:text-sm',
                      getKeyboardClass(keyboardStatuses.get(letter))
                    )}
                  >
                    {letter}
                  </button>
                ))}
                {rowIndex === 2 && (
                  <button
                    type="button"
                    onClick={() => handleKey('BACKSPACE')}
                    disabled={status !== 'playing' || isLocked}
                    aria-label="Backspace"
                    className="h-9 rounded-lg border border-gray-700 bg-gray-900 px-2 text-sm font-black text-gray-200 transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3"
                  >
                    ←
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <aside className="space-y-4">
        <ResultPanel answer={terminalAnswer} points={earnedPoints} status={status} />

        <div className="rounded-3xl border border-emerald-900/60 bg-gray-950/80 p-5 shadow-2xl shadow-emerald-950/20">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-gray-500">
            Podpowiedz
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">{puzzle.type}</h2>
          <p className="mt-2 text-sm leading-6 text-gray-400">{puzzle.hint}</p>
          <div className="mt-4 rounded-2xl border border-white/5 bg-gray-900 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">
              Do zdobycia
            </p>
            <p className="mt-1 text-2xl font-black text-emerald-300">
              {puzzle.maxPoints} pkt
            </p>
          </div>
        </div>

        <StatsPanel stats={stats} />

        <Link
          href="/daily-challenge"
          className="inline-flex w-full items-center justify-center rounded-full border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm font-black text-gray-200 transition hover:border-emerald-700 hover:text-emerald-300"
        >
          Wróć do Daily Challenge
        </Link>
      </aside>
    </div>
  )
}
