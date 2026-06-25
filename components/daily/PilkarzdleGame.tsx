'use client'

import Link from 'next/link'
import { FormEvent, useState, useSyncExternalStore, useTransition } from 'react'
import { evaluatePilkarzdleGuess } from '@/app/(main)/daily-challenge/pilkarzdle/actions'
import { cn } from '@/lib/utils'
import type {
  PilkarzdleComparisonStatus,
  PilkarzdleGameStatus,
  PilkarzdleGuessField,
  PilkarzdleGuessResult,
  PilkarzdlePlayerOption,
  PilkarzdlePublicPuzzle,
  PilkarzdleStats,
  PilkarzdleStoredGame,
} from '@/lib/pilkarzdle-types'

const FIELD_ORDER = ['Kraj', 'Poz.', 'Liga', 'Klub', 'Wiek', 'Wzrost', 'Numer']
const STATS_KEY = 'daily-challenge:pilkarzdle:stats'

const storedGameSnapshotCache = new Map<string, { raw: string | null; value: PilkarzdleStoredGame | null }>()

function normalizeText(value: string): string {
  return value
    .trim()
    .toLocaleUpperCase('pl-PL')
    .replace(/Ł/g, 'L')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9 ]/g, '')
}

function storageKey(dayKey: string): string {
  return `daily-challenge:pilkarzdle:${dayKey}`
}

function storageEventName(dayKey: string): string {
  return `daily-challenge:pilkarzdle-updated:${dayKey}`
}

function createEmptyGame(dayKey: string): PilkarzdleStoredGame {
  return { dayKey, attempts: 0, guesses: [], status: 'playing' }
}

function isStoredGame(value: unknown, dayKey: string): value is PilkarzdleStoredGame {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<PilkarzdleStoredGame>
  return (
    candidate.dayKey === dayKey &&
    typeof candidate.attempts === 'number' &&
    Array.isArray(candidate.guesses) &&
    (candidate.status === 'playing' || candidate.status === 'won' || candidate.status === 'lost')
  )
}

function readStoredGame(dayKey: string, maxAttempts: number): PilkarzdleStoredGame | null {
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
    const guesses = parsed.guesses.slice(0, maxAttempts)
    const value = { ...parsed, attempts: guesses.length, guesses }
    storedGameSnapshotCache.set(cacheKey, { raw: saved, value })
    return value
  } catch {
    window.localStorage.removeItem(key)
    storedGameSnapshotCache.set(cacheKey, { raw: null, value: null })
    return null
  }
}

function writeStoredGame(game: PilkarzdleStoredGame) {
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

function readPilkarzdleStats(): PilkarzdleStats {
  if (typeof window === 'undefined') return { playedGames: 0, wonGames: 0, resultsByDay: {} }
  const saved = window.localStorage.getItem(STATS_KEY)
  if (!saved) return { playedGames: 0, wonGames: 0, resultsByDay: {} }
  try { return JSON.parse(saved) as PilkarzdleStats } catch { return { playedGames: 0, wonGames: 0, resultsByDay: {} } }
}

function recordPilkarzdleStats(dayKey: string, result: 'won' | 'lost') {
  const stats = readPilkarzdleStats()
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

function findOptionByInput(options: PilkarzdlePlayerOption[], input: string) {
  const normalizedInput = normalizeText(input)
  return options.find(option => normalizeText(option.name) === normalizedInput)
}

function getComparisonClass(status: PilkarzdleComparisonStatus): string {
  if (status === 'correct') return 'border-emerald-400 bg-emerald-500 text-gray-950 shadow-lg shadow-emerald-950/30'
  if (status === 'close') return 'border-amber-300 bg-amber-400 text-gray-950 shadow-lg shadow-amber-950/25'
  return 'border-rose-700 bg-rose-950/80 text-rose-100 shadow-lg shadow-rose-950/20'
}

function getStatusLabel(status: PilkarzdleComparisonStatus): string {
  if (status === 'correct') return 'Trafione'
  if (status === 'close') return 'Blisko'
  return 'Pudlo'
}

function ResultPanel({
  answer, points, status, attempts, maxAttempts, startedAt, completedAt,
}: {
  answer?: string; points: number; status: PilkarzdleGameStatus
  attempts: number; maxAttempts: number; startedAt?: string; completedAt?: string
}) {
  if (status === 'playing') return null
  const isWon = status === 'won'
  const timeLabel = startedAt && completedAt
    ? formatElapsed(new Date(completedAt).getTime() - new Date(startedAt).getTime())
    : undefined
  return (
    <div className={cn('animate-footwordle-result relative overflow-hidden rounded-3xl border p-5 shadow-2xl',
      isWon ? 'border-emerald-700/70 bg-emerald-950/40 shadow-emerald-950/30' : 'border-rose-800/70 bg-rose-950/30 shadow-rose-950/20'
    )}>
      {isWon && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {['left-6 top-6', 'left-1/3 top-2', 'right-8 top-8', 'right-1/4 bottom-4'].map(position => (
            <span key={position} className={cn('animate-footwordle-confetti absolute h-2 w-2 rounded-full bg-emerald-300', position)} />
          ))}
        </div>
      )}
      <div className="relative">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-gray-400">{isWon ? 'Brawo!' : 'Koniec prob'}</p>
        <h2 className="mt-2 text-2xl font-black text-white">{isWon ? 'Odgadles pilkarza dnia.' : 'Poprawna odpowiedz:'}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-bold text-gray-400">{attempts}/{maxAttempts} prob</span>
          {isWon && <span className="rounded-full bg-emerald-950 px-3 py-1 text-xs font-bold text-emerald-400">+{points} pkt</span>}
          {timeLabel && <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-bold text-gray-400">⏱ {timeLabel}</span>}
        </div>
        <div className="mt-4 rounded-2xl border border-white/10 bg-gray-950/70 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Piłkarz dnia</p>
          <p className="mt-1 text-3xl font-black tracking-tight text-white">{answer ?? '--'}</p>
        </div>
        <Link href="/daily-challenge" className={cn('mt-4 inline-flex w-full items-center justify-center rounded-full px-4 py-2.5 text-sm font-black transition',
          isWon ? 'bg-emerald-400 text-gray-950 hover:bg-emerald-300' : 'bg-rose-400 text-gray-950 hover:bg-rose-300'
        )}>
          Wróć do Daily Challenge
        </Link>
      </div>
    </div>
  )
}

function FieldCell({ field, fieldIndex }: { field: PilkarzdleGuessField; fieldIndex: number }) {
  const isNumeric = field.id === 'age' || field.id === 'height' || field.id === 'shirtNumber'
  const arrow = isNumeric && field.hint ? (field.hint === 'wyzej' ? ' ↑' : ' ↓') : ''
  const hintLabel = isNumeric && field.hint
    ? (() => {
        if (field.id === 'age') return field.hint === 'wyzej' ? 'Starszy' : 'Mlodszy'
        if (field.id === 'height') return field.hint === 'wyzej' ? 'Wyzszy' : 'Nizszy'
        return field.hint === 'wyzej' ? 'Wyz. nr' : 'Niz. nr'
      })()
    : getStatusLabel(field.status)
  return (
    <div
      className={cn('animate-footwordle-reveal rounded-xl border p-2 text-center', getComparisonClass(field.status))}
      style={{ animationDelay: `${fieldIndex * 70}ms` }}
    >
      <p className="text-[9px] font-black uppercase tracking-[0.15em] opacity-70">{field.label}</p>
      <p className="mt-1 min-h-8 text-xs font-black leading-4">{field.value}{arrow}</p>
      <p className="mt-1 text-[9px] font-black uppercase tracking-wide opacity-70">{hintLabel}</p>
    </div>
  )
}

function GuessRow({ guess, index }: { guess: PilkarzdleGuessResult; index: number }) {
  return (
    <article className="animate-footwordle-result overflow-hidden rounded-2xl border border-gray-800 bg-gray-950/60 p-2">
      <div className="grid gap-1.5 lg:grid-cols-[150px_repeat(7,minmax(0,1fr))]">
        <div className="rounded-xl border border-white/10 bg-gray-900 p-2">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-gray-600">Proba {index + 1}</p>
          <h3 className="mt-1 text-sm font-black text-white">{guess.name}</h3>
        </div>
        {guess.fields.map((field, fieldIndex) => (
          <FieldCell key={field.id} field={field} fieldIndex={fieldIndex} />
        ))}
      </div>
    </article>
  )
}

export function PilkarzdleGame({ puzzle }: { puzzle: PilkarzdlePublicPuzzle }) {
  const storedGame = useSyncExternalStore(
    callback => subscribeToStoredGame(puzzle.dayKey, callback),
    () => readStoredGame(puzzle.dayKey, puzzle.maxAttempts),
    () => null
  )
  const game = storedGame ?? createEmptyGame(puzzle.dayKey)
  const { guesses, status } = game
  const guessedIds = new Set(guesses.map(guess => guess.playerId))
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [isPending, startTransition] = useTransition()
  const isLocked = isPending || isChecking || status !== 'playing'
  const terminalAnswer =
    game.revealedAnswer ??
    guesses.find(guess => guess.isCorrect)?.name ??
    guesses.find(guess => guess.revealedAnswer)?.revealedAnswer
  const earnedPoints = game.earnedPoints ?? (status === 'won' ? puzzle.maxPoints : 0)
  const visibleMessage =
    message ??
    (status === 'playing'
      ? `Wpisz pelne nazwisko. Zostalo ${puzzle.maxAttempts - guesses.length} prob.`
      : 'Gra zakonczona lokalnie.')

  function submitGuess(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    if (isLocked) return

    const selectedOption = findOptionByInput(puzzle.candidates, query)
    if (!selectedOption) {
      setMessage('Nie znaleziono pilkarza. Wpisz pelne imie i nazwisko.')
      return
    }
    if (guessedIds.has(selectedOption.id)) {
      setMessage('Ten pilkarz byl juz sprawdzany.')
      return
    }

    const nextAttemptNumber = guesses.length + 1
    const startedAt = game.startedAt ?? (guesses.length === 0 ? new Date().toISOString() : undefined)
    setIsChecking(true)

    startTransition(async () => {
      try {
        const response = await evaluatePilkarzdleGuess(selectedOption.id, puzzle.dayKey, nextAttemptNumber)
        if (!response.ok) { setMessage(response.error); return }

        const nextGuesses = [...guesses, response.result]
        const nextStatus: PilkarzdleGameStatus = response.result.isCorrect
          ? 'won'
          : nextGuesses.length >= puzzle.maxAttempts ? 'lost' : 'playing'
        const points = nextStatus === 'won' ? puzzle.maxPoints : 0
        const revealedAnswer = nextStatus === 'playing' ? undefined : response.result.revealedAnswer ?? response.result.name
        const completedAt = nextStatus !== 'playing' ? new Date().toISOString() : undefined

        writeStoredGame({
          dayKey: puzzle.dayKey,
          attempts: nextGuesses.length,
          guesses: nextGuesses,
          status: nextStatus,
          revealedAnswer,
          earnedPoints: nextStatus === 'playing' ? undefined : points,
          startedAt: startedAt ?? game.startedAt,
          completedAt: completedAt ?? game.completedAt,
        })

        if (nextStatus !== 'playing') recordPilkarzdleStats(puzzle.dayKey, nextStatus)
        setQuery('')

        if (nextStatus === 'won') setMessage(`Brawo! +${points} pkt.`)
        else if (nextStatus === 'lost') setMessage('Koniec prob. Odpowiedz jest w panelu wyniku.')
        else setMessage(`Proba ${nextGuesses.length}/${puzzle.maxAttempts}. Szukamy dalej.`)
      } finally {
        setIsChecking(false)
      }
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <section className="rounded-3xl border border-gray-800 bg-gray-900 p-4 lg:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-500">Classic board</p>
            <h2 className="mt-1 text-xl font-black text-white">Porownania pilkarza</h2>
          </div>
          <span className={cn('rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide',
            status === 'won' && 'bg-emerald-950 text-emerald-300',
            status === 'lost' && 'bg-rose-950 text-rose-300',
            status === 'playing' && 'bg-gray-950 text-gray-400'
          )}>
            {status === 'won' ? 'Ukonczono' : status === 'lost' ? 'Koniec prob' : 'W trakcie'}
          </span>
        </div>

        <form onSubmit={submitGuess} className="rounded-3xl border border-gray-800 bg-gray-950/55 p-4">
          <label htmlFor="pilkarzdle-search" className="text-xs font-black uppercase tracking-[0.22em] text-gray-500">
            Wpisz pelne nazwisko pilkarza
          </label>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              id="pilkarzdle-search"
              type="text"
              value={query}
              onChange={event => setQuery(event.target.value)}
              disabled={isLocked}
              placeholder="np. Cristiano Ronaldo"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="min-h-12 flex-1 rounded-2xl border border-gray-700 bg-gray-900 px-4 text-base font-bold text-white outline-none transition placeholder:text-gray-600 focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isLocked}
              className="min-h-12 rounded-2xl bg-emerald-500 px-5 text-sm font-black text-gray-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sprawdź
            </button>
          </div>
          <p className="mt-3 min-h-6 text-sm font-semibold text-gray-300">{visibleMessage}</p>
        </form>

        <div className="mt-4 hidden grid-cols-[150px_repeat(7,minmax(0,1fr))] gap-1.5 px-2 lg:grid">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600">Pilkarz</span>
          {FIELD_ORDER.map(f => (
            <span key={f} className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-gray-600">{f}</span>
          ))}
        </div>

        <div className="mt-2 space-y-3">
          {guesses.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-800 bg-gray-950/35 p-8 text-center">
              <p className="text-sm font-semibold text-gray-400">
                Pierwsza proba odsloni kolory porownan. Zielony = trafione, zolty = blisko, czerwony = bledne.
              </p>
            </div>
          ) : (
            guesses.map((guess, index) => (
              <GuessRow key={`${guess.playerId}-${index}`} guess={guess} index={index} />
            ))
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
          </div>
        )}

        <ResultPanel
          answer={terminalAnswer}
          points={earnedPoints}
          status={status}
          attempts={guesses.length}
          maxAttempts={puzzle.maxAttempts}
          startedAt={game.startedAt}
          completedAt={game.completedAt}
        />

        <div className="rounded-3xl border border-emerald-900/60 bg-gray-950/80 p-5 shadow-2xl shadow-emerald-950/20">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-gray-500">Zasady</p>
          <h2 className="mt-2 text-2xl font-black text-white">8 prób, 7 pól</h2>
          <p className="mt-2 text-sm leading-6 text-gray-400">
            Wpisz pelne nazwisko i zatwierdz. Porownuj narodowosc, pozycje, lige, klub, wiek, wzrost i numer koszulki. Zolty = blisko: ten sam kontynent/formacja/kraj ligi/liga albo roznica maks. 3.
          </p>
          <div className="mt-4 rounded-2xl border border-white/5 bg-gray-900 p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">Do zdobycia</p>
            <p className="mt-1 text-2xl font-black text-emerald-300">{puzzle.maxPoints} pkt</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-3xl border border-gray-800 bg-gray-900 p-3 text-center">
          <div className="rounded-2xl bg-emerald-500 p-3 text-gray-950">
            <p className="text-[10px] font-black uppercase">Zielony</p>
            <p className="mt-1 text-xs font-bold">Trafione</p>
          </div>
          <div className="rounded-2xl bg-amber-400 p-3 text-gray-950">
            <p className="text-[10px] font-black uppercase">Zolty</p>
            <p className="mt-1 text-xs font-bold">Blisko</p>
          </div>
          <div className="rounded-2xl bg-rose-950 p-3 text-rose-100">
            <p className="text-[10px] font-black uppercase">Czerwony</p>
            <p className="mt-1 text-xs font-bold">Pudlo</p>
          </div>
        </div>

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
