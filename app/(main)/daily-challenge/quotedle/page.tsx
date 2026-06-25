import Link from 'next/link'
import { QuotedleGame } from '@/components/daily/QuotedleGame'
import { getQuotedlePublicPuzzle } from '@/lib/quotedle'

export const dynamic = 'force-dynamic'

export default function QuotedlePage() {
  const puzzle = getQuotedlePublicPuzzle()

  return (
    <div className="space-y-4 pb-20 md:pb-8">
      <section className="relative overflow-hidden rounded-3xl border border-gray-800 bg-gray-900 p-4 sm:p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.20),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.12),transparent_32%)]" />
        <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full border border-fuchsia-500/20" />
        <div className="absolute -bottom-24 left-1/2 h-48 w-48 rounded-full border border-purple-500/10" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/daily-challenge"
              className="text-sm font-bold text-fuchsia-400 transition hover:text-fuchsia-300"
            >
              ← Wroc do Daily Challenge
            </Link>
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.22em] text-fuchsia-500">
              Quotedle
            </p>
            <h1 className="mt-2 max-w-2xl text-3xl font-black tracking-tight text-white sm:text-4xl">
              Odgadnij autora cytatu
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-gray-400">
              Przeczytaj cytat i wpisz, kto go powiedział. Masz {puzzle.maxAttempts} prób — po każdej nietrafieniu dostajesz wskazówkę.
            </p>
          </div>

          <div className="rounded-2xl border border-fuchsia-900/60 bg-gray-950/70 p-4 text-left shadow-2xl shadow-fuchsia-950/20 lg:min-w-64">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-gray-500">
              Dzisiejsza gra
            </p>
            <p className="mt-2 text-2xl font-black text-white">Kto to powiedział?</p>
            <p className="mt-1 text-sm text-gray-500">
              {puzzle.maxAttempts} prob · {puzzle.maxPoints} pkt · mock data
            </p>
          </div>
        </div>
      </section>

      <QuotedleGame puzzle={puzzle} />
    </div>
  )
}
