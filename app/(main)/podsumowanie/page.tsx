'use client'
import { useState, useEffect, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'
import { FlagImg } from '@/components/ui/FlagImg'
import { cn } from '@/lib/utils'
import type { TeamPickStat, PerUserKoPick, RoundStat } from '@/app/api/data/podsumowanie/route'

interface SummaryData {
  teamPickStats: TeamPickStat[]
  perUserKoPicks: PerUserKoPick[]
  roundStats: RoundStat[]
}

const MEDAL_EMOJI = ['🥇', '🥈', '🥉']
const MEDAL_BG = [
  'bg-yellow-500/10 border-yellow-500/30',
  'bg-gray-400/10 border-gray-400/30',
  'bg-orange-700/10 border-orange-700/30',
]
const MEDAL_TEXT = ['text-yellow-400', 'text-gray-300', 'text-orange-400']
const MEDAL_PTS = ['text-yellow-300', 'text-gray-200', 'text-orange-300']

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
      {children}
    </h2>
  )
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-gray-800 overflow-hidden', className)}>
      {children}
    </div>
  )
}

function CardHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-2 border-b border-gray-800 bg-gray-900/50">
      <p className="text-xs text-gray-400 font-medium">{children}</p>
    </div>
  )
}

function EmptyCard({ text }: { text: string }) {
  return (
    <Card>
      <div className="px-4 py-6 text-center text-gray-500 text-sm">{text}</div>
    </Card>
  )
}

export default function PodsumowaniePage() {
  const { users, currentUser } = useAppStore()
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(IS_PRODUCTION_MODE)

  useEffect(() => {
    if (!IS_PRODUCTION_MODE) { setLoading(false); return }
    fetch('/api/data/podsumowanie')
      .then(r => r.ok ? r.json() : null)
      .then(json => { if (json && !json.error) setData(json) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const ranked = useMemo(() =>
    users
      .filter(u => u.status === 'active' && u.role !== 'admin')
      .sort((a, b) => b.total_points - a.total_points),
    [users]
  )

  const nickById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const u of users) m[u.id] = u.nick
    return m
  }, [users])

  // Top 3 for podium — displayed silver | gold | bronze
  const podiumOrder = [ranked[1] ?? null, ranked[0] ?? null, ranked[2] ?? null]
  // podiumOrder index → medal index: i=0→silver(1), i=1→gold(0), i=2→bronze(2)
  const podiumMedalIdx = [1, 0, 2]

  // Section 4 stats from store
  const exactRanking = useMemo(() =>
    [...ranked].sort((a, b) => (b.correct_scores ?? 0) - (a.correct_scores ?? 0)).slice(0, 5),
    [ranked]
  )
  const streakRanking = useMemo(() =>
    [...ranked]
      .filter(u => (u.best_streak ?? 0) > 0)
      .sort((a, b) => (b.best_streak ?? 0) - (a.best_streak ?? 0))
      .slice(0, 5),
    [ranked]
  )
  const activityRanking = useMemo(() =>
    [...ranked].sort((a, b) => (b.predictions_count ?? 0) - (a.predictions_count ?? 0)).slice(0, 3),
    [ranked]
  )

  // Best/worst round per user, derived from roundStats
  const { bestRounds, worstRounds } = useMemo(() => {
    if (!data?.roundStats?.length) return { bestRounds: [], worstRounds: [] }
    const byUser: Record<string, { day: string; points: number }[]> = {}
    for (const r of data.roundStats) {
      if (!byUser[r.user_id]) byUser[r.user_id] = []
      byUser[r.user_id].push({ day: r.day, points: r.points })
    }
    const best: { user_id: string; day: string; points: number }[] = []
    const worst: { user_id: string; day: string; points: number }[] = []
    for (const [user_id, rounds] of Object.entries(byUser)) {
      if (!rounds.length) continue
      const sorted = [...rounds].sort((a, b) => b.points - a.points)
      best.push({ user_id, ...sorted[0] })
      worst.push({ user_id, ...sorted[sorted.length - 1] })
    }
    best.sort((a, b) => b.points - a.points)
    worst.sort((a, b) => a.points - b.points)
    return { bestRounds: best.slice(0, 5), worstRounds: worst.slice(0, 5) }
  }, [data])

  const perUserKoPicks = useMemo(() => {
    if (!data?.perUserKoPicks?.length) return []
    return data.perUserKoPicks
      .map(p => ({ ...p, nick: nickById[p.user_id] }))
      .filter(p => p.nick)
      .sort((a, b) => b.picks - a.picks)
  }, [data, nickById])

  if (!currentUser) return null

  return (
    <div className="space-y-8 pb-4">
      <h1 className="text-2xl font-black text-white">Podsumowanie sezonu</h1>

      {/* ── 1. PODIUM ───────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader>Podium końcowe</SectionHeader>
        {ranked.length === 0 ? (
          <EmptyCard text="Brak danych rankingowych." />
        ) : (
          <div className="grid grid-cols-3 gap-3 items-end">
            {podiumOrder.map((user, i) => {
              const mi = podiumMedalIdx[i]
              if (!user) return <div key={i} />
              return (
                <div key={user.id}
                  className={cn(
                    'rounded-xl border p-3 flex flex-col items-center gap-1 text-center',
                    i === 1 ? '' : 'mt-6',
                    MEDAL_BG[mi]
                  )}
                >
                  <span className={cn('text-3xl', i === 1 ? 'text-4xl' : '')}>{MEDAL_EMOJI[mi]}</span>
                  <span className={cn('font-bold text-xs truncate w-full', MEDAL_TEXT[mi])}>
                    {user.nick}
                  </span>
                  <span className={cn('font-black', i === 1 ? 'text-xl' : 'text-lg', MEDAL_PTS[mi])}>
                    {user.total_points}
                  </span>
                  <span className="text-gray-500 text-[10px]">pkt</span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── 2. PEŁNY RANKING ────────────────────────────────────────────────── */}
      <section>
        <SectionHeader>Pełny ranking</SectionHeader>
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-[11px] uppercase">
                <th className="py-2 px-3 text-left w-7">#</th>
                <th className="py-2 px-3 text-left">Nick</th>
                <th className="py-2 px-3 text-right font-semibold">Pkt</th>
                <th className="py-2 px-3 text-right hidden sm:table-cell text-gray-600">Mecze</th>
                <th className="py-2 px-3 text-right hidden sm:table-cell text-gray-600">Bonus</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((user, idx) => (
                <tr key={user.id}
                  className={cn(
                    'border-b border-gray-800/40 last:border-0 transition-colors',
                    user.id === currentUser.id
                      ? 'bg-emerald-950/30'
                      : 'hover:bg-gray-900/40'
                  )}
                >
                  <td className="py-2.5 px-3 text-gray-600 font-mono text-xs">{idx + 1}</td>
                  <td className="py-2.5 px-3 font-medium text-white">
                    {idx < 3 && <span className="mr-1 text-xs">{MEDAL_EMOJI[idx]}</span>}
                    {user.nick}
                    {user.id === currentUser.id && (
                      <span className="text-emerald-500 text-[10px] ml-1">(Ty)</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-white">{user.total_points}</td>
                  <td className="py-2.5 px-3 text-right text-gray-500 hidden sm:table-cell text-xs">{user.match_points}</td>
                  <td className="py-2.5 px-3 text-right text-gray-500 hidden sm:table-cell text-xs">{user.bonus_points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      {/* ── 3. NAJCZĘSTSZE TYPY ─────────────────────────────────────────────── */}
      <section>
        <SectionHeader>Najczęstsze typy (mecze KO)</SectionHeader>
        {loading ? (
          <EmptyCard text="Ładowanie…" />
        ) : !IS_PRODUCTION_MODE ? (
          <EmptyCard text="Dane dostępne po wdrożeniu na produkcję." />
        ) : !data?.teamPickStats?.length ? (
          <EmptyCard text="Brak typów z predykowanym zwycięzcą w meczach KO." />
        ) : (
          <div className="space-y-3">
            <Card>
              <CardHeader>Najczęściej typowane drużyny — ogólnie</CardHeader>
              <div className="divide-y divide-gray-800/40">
                {data.teamPickStats.slice(0, 8).map((t, i) => (
                  <div key={t.team_name} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-gray-600 font-mono text-xs w-4">{i + 1}</span>
                    <FlagImg code={t.team_code} name={t.team_name} size="sm" />
                    <span className="flex-1 text-white text-sm font-medium">{t.team_name}</span>
                    <span className="text-gray-400 text-xs tabular-nums">{t.total_picks}× typowana</span>
                  </div>
                ))}
              </div>
            </Card>

            {perUserKoPicks.length > 0 && (
              <Card>
                <CardHeader>Ulubiona drużyna KO każdego gracza</CardHeader>
                <div className="divide-y divide-gray-800/40">
                  {perUserKoPicks.map(p => (
                    <div key={p.user_id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="text-white text-sm font-medium w-20 shrink-0 truncate">{p.nick}</span>
                      <FlagImg code={p.team_code} name={p.team_name} size="sm" />
                      <span className="flex-1 text-gray-300 text-sm truncate">{p.team_name}</span>
                      <span className="text-gray-500 text-xs tabular-nums shrink-0">
                        {p.picks}/{p.total_ko_matches}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </section>

      {/* ── 4. CIEKAWOSTKI ──────────────────────────────────────────────────── */}
      <section>
        <SectionHeader>Ciekawostki</SectionHeader>
        <div className="space-y-3">
          {/* Round stats — only when data available */}
          {IS_PRODUCTION_MODE && !loading && (
            <>
              {bestRounds.length > 0 ? (
                <Card>
                  <CardHeader>🔝 Najlepsza kolejka (per gracz)</CardHeader>
                  <div className="divide-y divide-gray-800/40">
                    {bestRounds.map(r => (
                      <div key={`${r.user_id}-${r.day}-b`} className="flex items-center px-4 py-2.5 gap-3">
                        <span className="flex-1 text-white text-sm font-medium">
                          {nickById[r.user_id] ?? '?'}
                        </span>
                        <span className="text-gray-500 text-xs">kolejka {r.day}</span>
                        <span className="text-emerald-400 font-bold tabular-nums">{r.points} pkt</span>
                      </div>
                    ))}
                  </div>
                </Card>
              ) : (
                <EmptyCard text="Brak danych kolejkowych (mecze bez przypisanej kolejki)." />
              )}

              {worstRounds.length > 0 && (
                <Card>
                  <CardHeader>📉 Najgorsza kolejka (per gracz)</CardHeader>
                  <div className="divide-y divide-gray-800/40">
                    {worstRounds.map(r => (
                      <div key={`${r.user_id}-${r.day}-w`} className="flex items-center px-4 py-2.5 gap-3">
                        <span className="flex-1 text-white text-sm font-medium">
                          {nickById[r.user_id] ?? '?'}
                        </span>
                        <span className="text-gray-500 text-xs">kolejka {r.day}</span>
                        <span className="text-red-400 font-bold tabular-nums">{r.points} pkt</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}

          {/* Exact scores ranking — always from store */}
          <Card>
            <CardHeader>🎯 Najwięcej trafionych dokładnych wyników</CardHeader>
            <div className="divide-y divide-gray-800/40">
              {exactRanking.map((u, i) => (
                <div key={u.id} className="flex items-center px-4 py-2.5 gap-3">
                  <span className="text-gray-600 font-mono text-xs w-4">{i + 1}</span>
                  <span className="flex-1 text-white text-sm font-medium">{u.nick}</span>
                  <span className="text-gray-400 text-xs tabular-nums">
                    {u.correct_scores ?? 0} dokładnych
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Best streak — only if anyone has one */}
          {streakRanking.length > 0 && (
            <Card>
              <CardHeader>🔥 Najdłuższa passa trafionych typów</CardHeader>
              <div className="divide-y divide-gray-800/40">
                {streakRanking.map((u, i) => (
                  <div key={u.id} className="flex items-center px-4 py-2.5 gap-3">
                    <span className="text-gray-600 font-mono text-xs w-4">{i + 1}</span>
                    <span className="flex-1 text-white text-sm font-medium">{u.nick}</span>
                    <span className="text-orange-400 font-bold tabular-nums">
                      {u.best_streak} z rzędu
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Most active */}
          <Card>
            <CardHeader>📝 Najaktywniejszy typer</CardHeader>
            <div className="divide-y divide-gray-800/40">
              {activityRanking.map((u, i) => (
                <div key={u.id} className="flex items-center px-4 py-2.5 gap-3">
                  <span className="text-gray-600 font-mono text-xs w-4">{i + 1}</span>
                  <span className="flex-1 text-white text-sm font-medium">{u.nick}</span>
                  <span className="text-gray-400 text-xs tabular-nums">
                    {u.predictions_count ?? 0} typów
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>
    </div>
  )
}
