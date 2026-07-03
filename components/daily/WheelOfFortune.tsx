'use client'

import { useEffect, useRef, useState } from 'react'
import {
  type DailyMultiplier,
  getMultiplierForDay,
  hasSpunToday,
  saveMultiplierForDay,
  spinWheel,
} from '@/lib/daily-multiplier'

// 10 segments on the wheel; order determines which slice lands at top after rotation
const SEGMENTS: DailyMultiplier[] = [1, 1.5, 1, 2, 1, 3, 1, 1.5, 2, 1.5]
const SEG_DEG = 36 // 360 / 10

// Colour per multiplier value
const SEG_BG: Record<number, string> = {
  1: '#1f2937',
  1.5: '#172554',
  2: '#052e16',
  3: '#2e1065',
}
const SEG_COLOR: Record<number, string> = {
  1: '#9ca3af',
  1.5: '#93c5fd',
  2: '#86efac',
  3: '#c4b5fd',
}

// Build conic-gradient string from SEGMENTS array
function buildGradient(): string {
  const stops = SEGMENTS.map((val, i) => {
    const from = i * SEG_DEG
    const to = (i + 1) * SEG_DEG
    return `${SEG_BG[val]} ${from}deg ${to}deg`
  })
  return `conic-gradient(from 0deg, ${stops.join(', ')})`
}

// For a given multiplier value, pick the first matching segment index and compute
// the rotation needed to bring that segment to the top (pointer at 270° = top in CSS)
function restRotationFor(multiplier: DailyMultiplier, fullSpins: number): number {
  const idx = SEGMENTS.findIndex(s => s === multiplier)
  // CSS conic-gradient(from 0deg) starts at top (12 o'clock); 0° = top, clockwise.
  // After rotation R (clockwise), a point at segCentre° appears at (segCentre+R)%360.
  // For it to reach the top (0°): R = (360 - segCentre) % 360
  const segCentre = idx * SEG_DEG + SEG_DEG / 2
  const jitter = Math.random() * 20 - 10 // ±10° natural variation, safe within ±18° half-segment
  const rest = (360 - segCentre) % 360 + jitter
  return fullSpins * 360 + rest
}

export function WheelOfFortune({ dayKey }: { dayKey: string }) {
  const wheelRef = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<'idle' | 'spinning' | 'done'>(() =>
    hasSpunToday(dayKey) ? 'done' : 'idle'
  )
  const [result, setResult] = useState<DailyMultiplier | null>(() =>
    hasSpunToday(dayKey) ? (getMultiplierForDay(dayKey) as DailyMultiplier) : null
  )

  // Keep in sync if dayKey changes (e.g., midnight rollover)
  useEffect(() => {
    if (hasSpunToday(dayKey)) {
      setPhase('done')
      setResult(getMultiplierForDay(dayKey) as DailyMultiplier)
    } else {
      setPhase('idle')
      setResult(null)
    }
  }, [dayKey])

  function handleSpin() {
    if (phase !== 'idle') return
    const picked = spinWheel()
    setPhase('spinning')

    const totalDeg = restRotationFor(picked, 5)
    const wheel = wheelRef.current
    if (wheel) {
      wheel.style.transition = 'transform 2.8s cubic-bezier(0.17, 0.67, 0.12, 0.99)'
      wheel.style.transform = `rotate(${totalDeg}deg)`
    }

    setTimeout(() => {
      saveMultiplierForDay(dayKey, picked)
      setResult(picked)
      setPhase('done')
    }, 2900)
  }

  const labelColor = result ? SEG_COLOR[result] : '#86efac'
  const gradient = buildGradient()

  return (
    <section className="mt-8 rounded-3xl border border-gray-800 bg-gray-900 p-5 sm:p-7">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-500">
        Koło Fortuny
      </p>
      <h2 className="mt-1 text-xl font-black text-white">Dzisiejszy mnożnik punktów</h2>
      <p className="mt-1 text-sm text-gray-400">
        Zakręć raz dziennie — mnożnik stosuje się do wszystkich dzisiejszych wyników Daily Challenge.
      </p>

      <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-10">
        {/* Wheel */}
        <div className="relative flex-shrink-0">
          {/* Pointer triangle at top */}
          <div
            className="absolute left-1/2 z-10 -translate-x-1/2"
            style={{
              top: '-10px',
              width: 0,
              height: 0,
              borderLeft: '10px solid transparent',
              borderRight: '10px solid transparent',
              borderTop: '20px solid #10b981',
            }}
          />
          {/* Wheel disc */}
          <div
            ref={wheelRef}
            style={{
              width: 220,
              height: 220,
              borderRadius: '50%',
              background: gradient,
              willChange: 'transform',
            }}
          />
          {/* Centre cap */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-gray-700 bg-gray-900"
            style={{ width: 44, height: 44 }}
          />
          {/* Segment labels rendered on top */}
          <svg
            className="pointer-events-none absolute inset-0"
            width={220}
            height={220}
            viewBox="0 0 220 220"
          >
            {SEGMENTS.map((val, i) => {
              const angleDeg = i * SEG_DEG + SEG_DEG / 2
              const angleRad = ((angleDeg - 90) * Math.PI) / 180
              const r = 78
              const x = 110 + r * Math.cos(angleRad)
              const y = 110 + r * Math.sin(angleRad)
              return (
                <text
                  key={i}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={val >= 2 ? 13 : 11}
                  fontWeight="900"
                  fill={SEG_COLOR[val]}
                  style={{ userSelect: 'none' }}
                >
                  x{val}
                </text>
              )
            })}
          </svg>
        </div>

        {/* Right panel */}
        <div className="flex flex-1 flex-col gap-4">
          {phase === 'done' && result ? (
            <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5 text-center sm:text-left">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-gray-500">
                Twój dzisiejszy mnożnik
              </p>
              <p className="mt-2 text-5xl font-black tabular-nums" style={{ color: labelColor }}>
                x{result}
              </p>
              <p className="mt-2 text-sm text-gray-400">
                {result === 1 && 'Standardowe punkty. Jutro może być więcej!'}
                {result === 1.5 && 'Niezły wynik — 50% więcej punktów dziś!'}
                {result === 2 && 'Świetnie! Dziś zgarniasz podwójne punkty!'}
                {result === 3 && 'JACKPOT! Potrójne punkty przez całą dobę!'}
              </p>
            </div>
          ) : phase === 'spinning' ? (
            <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5 text-center">
              <p className="text-lg font-black text-gray-300">Losowanie...</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5">
              <p className="text-sm text-gray-400">
                Możliwe mnożniki:{' '}
                <span className="font-bold text-gray-300">x1</span> (40%),{' '}
                <span className="font-bold text-blue-300">x1.5</span> (30%),{' '}
                <span className="font-bold text-emerald-300">x2</span> (20%),{' '}
                <span className="font-bold text-violet-300">x3</span> (10%)
              </p>
              <p className="mt-2 text-xs text-gray-600">
                Mnożnik stosuje się do punktów zdobytych po zakręceniu kołem.
              </p>
            </div>
          )}

          {phase === 'idle' && (
            <button
              type="button"
              onClick={handleSpin}
              className="rounded-full bg-emerald-500 px-6 py-3 text-base font-black text-gray-950 transition hover:bg-emerald-400 active:scale-95"
            >
              Zakręć kołem!
            </button>
          )}

          {phase === 'done' && (
            <p className="text-xs text-gray-600">
              Zakręciłeś już dziś. Koło odblokuje się o północy (czas warszawski).
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
