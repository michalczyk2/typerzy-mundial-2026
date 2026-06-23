'use client'
import Link from 'next/link'
import { useAppStore } from '@/lib/store'
import { ZoomPanView } from '@/components/ui/ZoomPanView'
import {
  BracketCanvasDesktop,
  BracketCanvasMobile,
  DESKTOP_CANVAS_WIDTH,
  DESKTOP_CANVAS_HEIGHT,
  MOBILE_CANVAS_WIDTH,
  MOBILE_CANVAS_HEIGHT,
} from '@/components/turniej/BracketCanvas'
import { buildBracket } from '@/lib/bracket'

export default function TurniejPage() {
  const { matches } = useAppStore()
  const bracket = buildBracket(matches)

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-1">
        <h1 className="text-2xl font-black text-white">Drabinka</h1>
        <Link
          href="/grupy"
          className="shrink-0 flex items-center gap-1.5 rounded-full bg-gray-800 border border-emerald-700/50 px-3.5 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-gray-700 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 shrink-0" aria-hidden>
            <path
              d="M16 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20c0-3.3 2.7-6 6-6s6 2.7 6 6M14 14.3c2.9.4 5 2.9 5 5.7"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Zobacz grupy →
        </Link>
      </div>

      <div className="flex items-center gap-2 mb-1">
        <span className="text-gray-400 text-sm font-medium">Obsadzone:</span>
        <span className="text-sm font-bold tabular-nums">
          <span className="text-emerald-400">{bracket.confirmedRoundOf32}</span>
          <span className="text-white"> / 32</span>
        </span>
      </div>
      <p className="text-gray-600 text-xs mb-5">
        Drabinka będzie uzupełniana automatycznie wraz z rozstrzygnięciami fazy grupowej.
      </p>

      <div className="hidden md:block">
        <ZoomPanView contentWidth={DESKTOP_CANVAS_WIDTH} contentHeight={DESKTOP_CANVAS_HEIGHT}>
          <BracketCanvasDesktop matches={matches} />
        </ZoomPanView>
      </div>
      <div className="md:hidden">
        <ZoomPanView contentWidth={MOBILE_CANVAS_WIDTH} contentHeight={MOBILE_CANVAS_HEIGHT}>
          <BracketCanvasMobile matches={matches} />
        </ZoomPanView>
      </div>
    </div>
  )
}
