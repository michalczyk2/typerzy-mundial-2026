'use client'
import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { FlagImg } from '@/components/ui/FlagImg'
import { Badge } from '@/components/ui/Badge'
import { formatMatchDate, formatMatchTime, isMatchLocked, getPhaseLabel } from '@/lib/utils'
import type { PredictionResult } from '@/types'

export default function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { currentUser, matches, predictions, users, addPrediction, updatePrediction } = useAppStore()

  const match = matches.find(m => m.id === id)
  const myPrediction = predictions.find(p => p.match_id === id && p.user_id === currentUser?.id)
  const allMatchPredictions = predictions.filter(p => p.match_id === id)

  const teamA = match?.team_a || match?.home_placeholder || '?'
  const teamB = match?.team_b || match?.away_placeholder || '?'
  const locked = match ? isMatchLocked(match.match_date) : true

  const [selectedResult, setSelectedResult] = useState<PredictionResult | null>(
    myPrediction?.predicted_result ?? null
  )
  const [scoreA, setScoreA] = useState(myPrediction ? String(myPrediction.predicted_a) : '')
  const [scoreB, setScoreB] = useState(myPrediction ? String(myPrediction.predicted_b) : '')
  const [predictedWinner, setPredictedWinner] = useState<string | null>(myPrediction?.predicted_winner ?? null)
  const [saved, setSaved] = useState(false)

  if (!match) return (
    <div className="text-center py-20 space-y-4">
      <p className="text-gray-400">Mecz nie został znaleziony.</p>
      <button onClick={() => router.back()} className="text-emerald-400 text-sm hover:underline">← Wróć</button>
    </div>
  )

  const isFinished = match.status === 'finished'
  const isLive = match.status === 'live'

  const derivedResult = (): PredictionResult | null => {
    const a = Number(scoreA), b = Number(scoreB)
    if (scoreA === '' || scoreB === '') return null
    return a > b ? 'home' : a < b ? 'away' : 'draw'
  }

  const isDoubleChance = selectedResult === 'home_or_draw' || selectedResult === 'away_or_draw'

  const scoreMismatch = (() => {
    if (selectedResult === null) return false
    const d = derivedResult()
    if (d === null) return false
    if (selectedResult === 'home_or_draw') return d === 'away'
    if (selectedResult === 'away_or_draw') return d === 'home'
    return d !== selectedResult
  })()

  const handleResultClick = (r: PredictionResult) => {
    setSelectedResult(r)
    setSaved(false)
    if (r === 'home_or_draw' || r === 'away_or_draw') return
    if (r === 'home' && Number(scoreA) <= Number(scoreB) && scoreA !== '') {
      setScoreA('1'); setScoreB('0')
    }
    if (r === 'away' && Number(scoreA) >= Number(scoreB) && scoreB !== '') {
      setScoreA('0'); setScoreB('1')
    }
    if (r === 'draw') {
      const v = scoreA || '1'; setScoreA(v); setScoreB(v)
    }
  }

  const handleScoreChange = (side: 'a' | 'b', val: string) => {
    const clean = val.replace(/[^0-9]/g, '').slice(0, 2)
    const newA = side === 'a' ? clean : scoreA
    const newB = side === 'b' ? clean : scoreB
    if (side === 'a') setScoreA(clean); else setScoreB(clean)
    if (!isDoubleChance && newA !== '' && newB !== '') {
      setSelectedResult(Number(newA) > Number(newB) ? 'home' : Number(newA) < Number(newB) ? 'away' : 'draw')
    }
    setSaved(false)
  }

  const isKoPhase = match.phase !== 'group'

  const handleSave = () => {
    if (!currentUser || locked || scoreA === '' || scoreB === '' || selectedResult === null || scoreMismatch) return
    const a = Number(scoreA), b = Number(scoreB)
    if (myPrediction) {
      updatePrediction(myPrediction.id, a, b, selectedResult, predictedWinner)
    } else {
      addPrediction(match.id, a, b, selectedResult, predictedWinner)
    }
    setSaved(true)
  }

  const outcomeLabel = (r: PredictionResult) => {
    if (r === 'home') return teamA
    if (r === 'draw') return 'Remis'
    if (r === 'home_or_draw') return `${teamA} lub Remis`
    if (r === 'away_or_draw') return `${teamB} lub Remis`
    return teamB
  }

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-24">
      <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
        ← Mecze
      </button>

      {/* Match header */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-950 border-b border-gray-800 text-xs text-gray-500">
          <span>
            {match.group_name
              ? `Grupa ${match.group_name} · Kolejka ${match.round}`
              : getPhaseLabel(match.phase)}
          </span>
          <div className="flex items-center gap-2">
            {isLive && <Badge variant="live">NA ŻYWO</Badge>}
            {isFinished && <Badge variant="finished">Zakończony</Badge>}
            {!isLive && !isFinished && <Badge variant="scheduled">Zaplanowany</Badge>}
          </div>
        </div>

        <div className="px-4 py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 flex flex-col items-center gap-3">
              {match.team_a_code && <FlagImg code={match.team_a_code} name={teamA} size="lg" />}
              <span className="text-white font-bold text-sm text-center leading-tight">{teamA}</span>
            </div>

            <div className="flex flex-col items-center min-w-[100px] gap-1">
              {isFinished || isLive ? (
                <>
                  <div className="text-4xl font-black text-white tabular-nums">
                    {match.score_a}<span className="text-gray-600 mx-2">:</span>{match.score_b}
                  </div>
                  {isLive && <span className="text-red-400 text-xs font-bold animate-pulse">LIVE</span>}
                  {match.halftime_a !== null && isFinished && (
                    <span className="text-gray-600 text-xs">({match.halftime_a}:{match.halftime_b})</span>
                  )}
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold text-gray-100">{formatMatchTime(match.match_date)}</div>
                  <div className="text-sm text-gray-500">{formatMatchDate(match.match_date)}</div>
                </>
              )}
            </div>

            <div className="flex-1 flex flex-col items-center gap-3">
              {match.team_b_code && <FlagImg code={match.team_b_code} name={teamB} size="lg" />}
              <span className="text-white font-bold text-sm text-center leading-tight">{teamB}</span>
            </div>
          </div>

          {(match.stadium || match.city) && (
            <p className="text-center text-xs text-gray-600 mt-4">
              {[match.stadium, match.city].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>

      {/* Prediction — only for active users */}
      {currentUser && currentUser.status === 'active' && currentUser.role !== 'admin' && (
        locked ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">🔒</span>
              <p className="text-gray-400 font-semibold text-sm">Typowanie zablokowane</p>
            </div>
            {myPrediction ? (
              <div className="bg-gray-950 rounded-lg px-4 py-3">
                <span className="text-gray-400 text-sm">Twój typ: </span>
                <span className="text-white font-black text-lg tabular-nums">
                  {myPrediction.predicted_a}:{myPrediction.predicted_b}
                </span>
                <span className="text-gray-500 text-xs ml-2">({outcomeLabel(myPrediction.predicted_result)})</span>
                {myPrediction.points_earned > 0 && (
                  <span className="text-emerald-400 text-sm font-bold ml-3">+{myPrediction.points_earned} pkt</span>
                )}
              </div>
            ) : (
              <p className="text-gray-600 text-sm">Nie dodałeś typu przed startem meczu.</p>
            )}
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">
            <h2 className="text-white font-bold text-base">Twój typ</h2>

            {/* Outcome buttons */}
            <div>
              <p className="text-gray-500 text-xs mb-3 uppercase tracking-wide font-medium">Wynik meczu</p>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {(['home', 'draw', 'away'] as PredictionResult[]).map(r => (
                  <button
                    key={r}
                    onClick={() => handleResultClick(r)}
                    className={`py-4 px-2 rounded-xl text-sm font-bold border-2 transition-all text-center leading-tight ${
                      selectedResult === r
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/50 scale-[1.02]'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
                    }`}
                  >
                    {outcomeLabel(r)}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['home_or_draw', 'away_or_draw'] as PredictionResult[]).map(r => (
                  <button
                    key={r}
                    onClick={() => handleResultClick(r)}
                    className={`py-2.5 px-2 rounded-lg text-xs font-semibold border transition-all text-center leading-tight ${
                      selectedResult === r
                        ? 'bg-blue-700 border-blue-500 text-white shadow-md'
                        : 'bg-gray-800/70 border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600'
                    }`}
                  >
                    {outcomeLabel(r)}
                    <span className="block text-[10px] opacity-60 mt-0.5">szansa podwójna</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Exact score */}
            <div>
              <p className="text-gray-500 text-xs mb-3 uppercase tracking-wide font-medium">Dokładny wynik</p>
              <div className="flex items-center justify-center gap-4">
                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-gray-500 text-xs truncate max-w-[80px] text-center">{teamA}</span>
                  <input
                    type="number" min="0" max="20" value={scoreA}
                    onChange={e => handleScoreChange('a', e.target.value)}
                    placeholder="–"
                    className="w-16 h-14 text-center text-3xl font-black bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-emerald-500 transition-colors tabular-nums"
                  />
                </div>
                <span className="text-gray-600 text-3xl font-black mt-5">:</span>
                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-gray-500 text-xs truncate max-w-[80px] text-center">{teamB}</span>
                  <input
                    type="number" min="0" max="20" value={scoreB}
                    onChange={e => handleScoreChange('b', e.target.value)}
                    placeholder="–"
                    className="w-16 h-14 text-center text-3xl font-black bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-emerald-500 transition-colors tabular-nums"
                  />
                </div>
              </div>
            </div>

            {isKoPhase && (
              <div>
                <p className="text-gray-500 text-xs mb-3 uppercase tracking-wide font-medium">Kto awansuje? <span className="text-amber-400 normal-case">+2 pkt</span></p>
                <div className="grid grid-cols-2 gap-2">
                  {[{ name: teamA, code: match.team_a_code }, { name: teamB, code: match.team_b_code }].map(team => (
                    <button
                      key={team.name}
                      onClick={() => { setPredictedWinner(predictedWinner === team.name ? null : team.name); setSaved(false) }}
                      className={`py-3 px-2 rounded-xl text-sm font-bold border-2 transition-all text-center leading-tight ${
                        predictedWinner === team.name
                          ? 'bg-amber-700/40 border-amber-500 text-amber-300 shadow-lg shadow-amber-900/30 scale-[1.02]'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
                      }`}
                    >
                      {team.name}
                    </button>
                  ))}
                </div>
                {!predictedWinner && (
                  <p className="text-gray-600 text-xs mt-2 text-center">Brak wyboru — możesz pominąć</p>
                )}
              </div>
            )}

            {scoreMismatch && (
              <div className="bg-amber-950/40 border border-amber-800/50 rounded-lg px-3 py-2.5 text-amber-400 text-xs">
                ⚠ Wynik {scoreA}:{scoreB} nie zgadza się z wybranym rezultatem meczu — zapisz dopiero po poprawieniu
              </div>
            )}

            {/* Scoring info */}
            <div className="bg-gray-950 rounded-xl px-4 py-3 text-xs space-y-2.5">
              {isDoubleChance ? (
                <>
                  <div className="flex justify-between items-center text-gray-400">
                    <span>Szansa podwójna (trafna końcówka)</span>
                    <span className="text-blue-300 font-bold">+1 pkt</span>
                  </div>
                  <div className="flex justify-between items-center text-gray-400">
                    <span>Dokładny wynik</span>
                    <span className="text-gray-200 font-bold">+5 pkt</span>
                  </div>
                  <div className="flex justify-between items-center text-gray-500 text-[10px]">
                    <span>Nie kwalifikuje do bonusu Idealny typ</span>
                    <span>—</span>
                  </div>
                  <div className="flex justify-between items-center text-gray-300 font-bold border-t border-gray-800 pt-2.5">
                    <span>Maksymalnie za mecz</span>
                    <span className="text-blue-400 text-sm">6 pkt</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center text-gray-400">
                    <span>Trafiony wynik meczu</span>
                    <span className="text-gray-200 font-bold">+3 pkt</span>
                  </div>
                  <div className="flex justify-between items-center text-gray-400">
                    <span>Trafiony dokładny wynik</span>
                    <span className="text-gray-200 font-bold">+5 pkt</span>
                  </div>
                  <div className="flex justify-between items-center text-gray-400">
                    <span>Bonus Idealny typ (jedyny z 8 pkt)</span>
                    <span className="text-gray-200 font-bold">+2 pkt</span>
                  </div>
                  <div className="flex justify-between items-center text-gray-300 font-bold border-t border-gray-800 pt-2.5">
                    <span>Maksymalnie za mecz</span>
                    <span className="text-emerald-400 text-sm">8 pkt</span>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={selectedResult === null || scoreMismatch}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all text-base"
            >
              {scoreMismatch ? 'Popraw wynik przed zapisem' : saved ? '✓ Zapisano!' : myPrediction ? 'Aktualizuj typ' : 'Zapisz typ'}
            </button>

            {saved && (
              <p className="text-center text-xs text-gray-500">Możesz zmienić typ do startu meczu.</p>
            )}
          </div>
        )
      )}

      {/* Other users' predictions — shown only after lock */}
      {locked && allMatchPredictions.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-white font-bold mb-4 text-base">Typy grupy</h2>
          <div className="space-y-0">
            {allMatchPredictions.filter(pred => {
              const u = users.find(u => u.id === pred.user_id)
              return u?.role !== 'admin'
            }).map(pred => {
              const user = users.find(u => u.id === pred.user_id)
              const isMe = pred.user_id === currentUser?.id
              return (
                <div
                  key={pred.id}
                  className={`flex items-center justify-between py-3 border-b border-gray-800 last:border-0 ${isMe ? 'text-emerald-400' : ''}`}
                >
                  <span className={`text-sm font-medium ${isMe ? 'text-emerald-400' : 'text-gray-300'}`}>
                    {user?.nick ?? pred.user_id}
                    {isMe && <span className="text-xs text-gray-600 ml-1">(Ty)</span>}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className={`font-black tabular-nums ${isMe ? 'text-emerald-400' : 'text-white'}`}>
                      {pred.predicted_a}:{pred.predicted_b}
                    </span>
                    <span className="text-gray-600 text-xs">({outcomeLabel(pred.predicted_result)})</span>
                    {pred.points_earned > 0 && (
                      <span className="text-emerald-400 text-xs font-bold bg-emerald-950/50 px-2 py-0.5 rounded">
                        +{pred.points_earned}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
