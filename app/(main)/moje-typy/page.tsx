'use client'
import { useMemo, useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { calculatePoints, formatMatchDate, formatMatchTime } from '@/lib/utils'
import { FlagImg } from '@/components/ui/FlagImg'
import { Badge } from '@/components/ui/Badge'
import { ChampionPicker } from '@/components/matches/ChampionPicker'

interface ChampionState {
  pick: { team_code: string; team_name: string } | null
  enabled: boolean
}

export default function MojeTyPage() {
  const { currentUser, predictions, matches } = useAppStore()
  const [champion, setChampion] = useState<ChampionState | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    if (!currentUser) return
    fetch('/api/champion-prediction')
      .then(r => r.json())
      .then((data: ChampionState) => setChampion(data))
      .catch(() => {})
  }, [currentUser])

  const myPredictions = useMemo(() => {
    if (!currentUser) return []
    return predictions
      .filter(p => p.user_id === currentUser.id)
      .map(pred => {
        const match = matches.find(m => m.id === pred.match_id)
        return { pred, match }
      })
      .filter(({ match }) => !!match)
      .sort((a, b) => new Date(b.match!.match_date).getTime() - new Date(a.match!.match_date).getTime())
  }, [currentUser, predictions, matches])

  const totalPoints = myPredictions.reduce((s,{pred}) => s+(pred.points_earned||0), 0)
  const correct = myPredictions.filter(({pred}) => pred.is_correct_outcome).length
  const exact = myPredictions.filter(({pred}) => pred.is_correct_score).length

  return (
    <div>
      <h1 className="text-2xl font-black text-white mb-6">Moje typy</h1>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-3xl font-black text-emerald-400">{totalPoints}</p>
          <p className="text-gray-500 text-xs mt-1">Punkty</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-3xl font-black text-white">{correct}</p>
          <p className="text-gray-500 text-xs mt-1">Trafne</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-3xl font-black text-amber-400">{exact}</p>
          <p className="text-gray-500 text-xs mt-1">Dokładne</p>
        </div>
      </div>

      {champion !== null && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-lg">🏆</span>
              <div>
                <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Mój typ na mistrza turnieju</p>
                {champion.pick ? (
                  <div className="flex items-center gap-2 mt-1">
                    <FlagImg code={champion.pick.team_code} name={champion.pick.team_name} size="sm" />
                    <span className="text-white font-semibold text-sm">{champion.pick.team_name}</span>
                  </div>
                ) : (
                  <p className="text-gray-600 text-sm mt-1">Brak typu</p>
                )}
              </div>
            </div>
            {champion.enabled ? (
              <button
                onClick={() => setPickerOpen(true)}
                className="text-emerald-400 text-xs font-medium hover:text-emerald-300 transition-colors shrink-0"
              >
                {champion.pick ? 'Zmień typ' : 'Wybierz'}
              </button>
            ) : (
              <span className="text-gray-600 text-xs shrink-0">Typowanie zablokowane</span>
            )}
          </div>
        </div>
      )}

      {myPredictions.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Nie masz jeszcze żadnych typów. Idź do meczów i zacznij typować!</div>
      ) : (
        <div className="space-y-3">
          {myPredictions.map(({ pred, match }) => {
            if (!match) return null
            const isFinished = match.status === 'finished'
            const pts = isFinished && match.score_a !== null && match.score_b !== null
              ? calculatePoints(pred.predicted_a, pred.predicted_b, match.score_a, match.score_b).points
              : null
            return (
              <div key={pred.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-gray-500 text-xs">{formatMatchDate(match.match_date)} {formatMatchTime(match.match_date)}</div>
                  {isFinished ? <Badge variant="finished">Zakończony</Badge> : <Badge variant="scheduled">Nadchodzący</Badge>}
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    <span className="text-white text-sm font-medium text-right">{match.team_a}</span>
                    <FlagImg code={match.team_a_code} name={match.team_a} size="sm" />
                  </div>
                  <div className="text-center min-w-[90px]">
                    {isFinished && match.score_a !== null ? (
                      <div className="text-lg font-black text-white">{match.score_a}:{match.score_b}</div>
                    ) : (
                      <div className="text-gray-500 text-xs">vs</div>
                    )}
                    <div className="text-xs mt-1">
                      <span className="text-gray-400">Typ: </span>
                      <span className="text-white font-bold">{pred.predicted_a}:{pred.predicted_b}</span>
                    </div>
                    {pts !== null && (
                      <div className={`text-sm font-black mt-1 ${pts > 0 ? 'text-emerald-400' : 'text-gray-600'}`}>
                        {pts > 0 ? `+${pts} pkt` : '0 pkt'}
                        {pred.is_correct_score && <span className="ml-1 text-amber-400">⭐</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <FlagImg code={match.team_b_code} name={match.team_b} size="sm" />
                    <span className="text-white text-sm font-medium">{match.team_b}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {pickerOpen && (
        <ChampionPicker
          currentPick={champion?.pick ?? null}
          onClose={() => setPickerOpen(false)}
          onSaved={(code, name) => {
            setChampion(s => s ? { ...s, pick: { team_code: code, team_name: name } } : s)
            setPickerOpen(false)
          }}
        />
      )}
    </div>
  )
}
