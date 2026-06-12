import Link from 'next/link'
import { FootWordleGame } from '@/components/daily/FootWordleGame'
import { getFootWordlePublicPuzzle } from '@/lib/footwordle'

export const dynamic = 'force-dynamic'

export default function FootWordlePage() {
  const puzzle = getFootWordlePublicPuzzle()

  return (
    <div className="space-y-4 pb-20 md:pb-8">
      <section className="relative overflow-hidden rounded-3xl border border-gray-800 bg-gray-900 p-4 sm:p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.24),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.16),transparent_32%)]" />
        <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full border border-emerald-500/20" />
        <div className="absolute -bottom-24 left-1/2 h-48 w-48 rounded-full border border-cyan-500/10" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/daily-challenge"
              className="text-sm font-bold text-emerald-400 transition hover:text-emerald-300"
            >
              ← Wroc do Daily Challenge
            </Link>
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.22em] text-emerald-500">
              FootWordle
            </p>
            <h1 className="mt-2 max-w-2xl text-3xl font-black tracking-tight text-white sm:text-4xl">
              Zgadnij pilkarskie haslo dnia
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-gray-400">
              Masz 6 prob. Zielony kolor oznacza dobra litere w dobrym miejscu, zolty dobra litere
              w zlym miejscu, a szary brak litery w hasle.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-900/60 bg-gray-950/70 p-4 text-left shadow-2xl shadow-emerald-950/20 lg:min-w-64">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-gray-500">
              Dzisiejsza gra
            </p>
            <p className="mt-2 text-2xl font-black text-white">{puzzle.type}</p>
            <p className="mt-1 text-sm text-gray-500">
              {puzzle.answerLength} liter · {puzzle.maxAttempts} prob · {puzzle.maxPoints} pkt
            </p>
          </div>
        </div>
      </section>

      <FootWordleGame puzzle={puzzle} />
    </div>
  )
}
