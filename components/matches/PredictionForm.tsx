'use client'
import { useState } from 'react'
import type { Match, Prediction } from '@/types'
import { Button } from '@/components/ui/Button'
import { calculatePoints } from '@/lib/utils'

interface Props { match: Match; prediction?: Prediction; locked: boolean; onSubmit: (a: number, b: number) => void }

export function PredictionForm({ match, prediction, locked, onSubmit }: Props) {
  const [scoreA, setScoreA] = useState<string>(prediction?.predicted_a !== undefined ? String(prediction.predicted_a) : '')
  const [scoreB, setScoreB] = useState<string>(prediction?.predicted_b !== undefined ? String(prediction.predicted_b) : '')
  const [saved, setSaved] = useState(false)

  const isFinished = match.status === 'finished'

  const handleSubmit = () => {
    if (scoreA === '' || scoreB === '') return
    onSubmit(Number(scoreA), Number(scoreB))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (locked && !prediction) {
    return <p className="text-gray-600 text-xs text-center py-1">Typ zablokowany — mecz się rozpoczął</p>
  }

  if (locked && prediction) {
    const pts = isFinished && match.score_a !== null && match.score_b !== null
      ? calculatePoints(prediction.predicted_a, prediction.predicted_b, match.score_a, match.score_b).points
      : null
    return (
      <div className="flex items-center justify-between">
        <span className="text-gray-500 text-xs">Twój typ</span>
        <div className="flex items-center gap-3">
          <span className="text-white font-black text-xl">{prediction.predicted_a} : {prediction.predicted_b}</span>
          {pts !== null && (
            <span className={`text-sm font-bold ${pts > 0 ? 'text-emerald-400' : 'text-gray-600'}`}>
              {pts > 0 ? `+${pts} pkt` : '0 pkt'}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-gray-500 text-xs flex-1">Twój typ</span>
      <div className="flex items-center gap-2">
        <input type="number" min="0" max="20" value={scoreA} onChange={e=>setScoreA(e.target.value)}
          className="w-12 h-10 text-center bg-gray-800 border border-gray-700 rounded-lg text-white font-black text-lg focus:border-emerald-500 focus:outline-none" />
        <span className="text-gray-600 font-bold text-lg">:</span>
        <input type="number" min="0" max="20" value={scoreB} onChange={e=>setScoreB(e.target.value)}
          className="w-12 h-10 text-center bg-gray-800 border border-gray-700 rounded-lg text-white font-black text-lg focus:border-emerald-500 focus:outline-none" />
      </div>
      <Button size="sm" onClick={handleSubmit} disabled={scoreA===''||scoreB===''}>
        {saved ? '✓ OK' : prediction ? 'Zmień' : 'Typuj'}
      </Button>
    </div>
  )
}
