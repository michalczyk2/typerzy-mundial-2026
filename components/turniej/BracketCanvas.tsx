'use client'
import Link from 'next/link'
import { FlagImg } from '@/components/ui/FlagImg'
import { cn } from '@/lib/utils'
import { buildBracket, slotCenterRowUnit, BRACKET_ROUND_LABEL, type BracketSlot } from '@/lib/bracket'
import type { Match } from '@/types'

const HALF_BASE = 8

// Every dimensional/visual constant the canvas needs, so desktop and mobile
// can each get their own proportions without duplicating render logic.
interface LayoutConfig {
  cardW: number
  cardH: number
  colGap: number
  row: number
  padX: number
  padTop: number
  padBottom: number
  finalGap: number
  finalH: number
  finalLabelH: number
  lineThickness: number
  jointSize: number
  arrowSize: number
  teamFontSize: number
  placeholderFontSize: number
  finalFontSize: number
  flagSize: 'sm' | 'md' | 'lg' | 'xl'
  finalFlagSize: 'sm' | 'md' | 'lg' | 'xl'
  trophyEmojiClass: string
  trophyHalo: number
  roundLabelTop: number
  roundLabelSize: number
}

const DESKTOP_CONFIG: LayoutConfig = {
  cardW: 196,
  cardH: 76,
  colGap: 26,
  row: 96,
  padX: 26,
  padTop: 64,
  padBottom: 26,
  finalGap: 20,
  finalH: 96,
  finalLabelH: 32,
  lineThickness: 2,
  jointSize: 5,
  arrowSize: 6,
  teamFontSize: 12,
  placeholderFontSize: 12,
  finalFontSize: 13,
  flagSize: 'md',
  finalFlagSize: 'lg',
  trophyEmojiClass: 'text-7xl',
  trophyHalo: 190,
  roundLabelTop: 34,
  roundLabelSize: 11,
}

// Taller/more vertical proportions than desktop (bigger `row`), larger
// absolute card size for legibility after pinch-zoom, and bolder
// lines/joints/arrows so the tree still reads at "Dopasuj" overview scale.
const MOBILE_CONFIG: LayoutConfig = {
  cardW: 80,
  cardH: 52,
  colGap: 6,
  row: 85,
  padX: 12,
  padTop: 40,
  padBottom: 20,
  finalGap: 10,
  finalH: 72,
  finalLabelH: 24,
  lineThickness: 3,
  jointSize: 6,
  arrowSize: 8,
  teamFontSize: 9,
  placeholderFontSize: 9,
  finalFontSize: 11,
  flagSize: 'lg',
  finalFlagSize: 'xl',
  trophyEmojiClass: 'text-8xl',
  trophyHalo: 140,
  roundLabelTop: 24,
  roundLabelSize: 9,
}

function colW(config: LayoutConfig) {
  return config.cardW + config.colGap
}
function canvasWidth(config: LayoutConfig) {
  return config.padX * 2 + 9 * config.cardW + 8 * config.colGap
}
function canvasHeight(config: LayoutConfig) {
  return config.padTop + HALF_BASE * config.row + config.padBottom
}
function centerYMid(config: LayoutConfig) {
  return config.padTop + (HALF_BASE * config.row) / 2
}
function finalW(config: LayoutConfig) {
  return config.cardW + 2 * config.colGap - 2 * config.finalGap
}
function leftColX(config: LayoutConfig, roundIndex: number) {
  return config.padX + roundIndex * colW(config)
}
function rightColX(config: LayoutConfig, roundIndex: number) {
  return config.padX + (8 - roundIndex) * colW(config)
}
function centerYAt(config: LayoutConfig, roundIndex: number, indexInRound: number) {
  return config.padTop + slotCenterRowUnit(roundIndex, indexInRound) * config.row
}

export const DESKTOP_CANVAS_WIDTH = canvasWidth(DESKTOP_CONFIG)
export const DESKTOP_CANVAS_HEIGHT = canvasHeight(DESKTOP_CONFIG)
export const MOBILE_CANVAS_WIDTH = canvasWidth(MOBILE_CONFIG)
export const MOBILE_CANVAS_HEIGHT = canvasHeight(MOBILE_CONFIG)

function teamDisplay(match: Match | null, side: 'a' | 'b') {
  if (!match) return { name: 'Do ustalenia', code: '', isReal: false }
  const name = side === 'a' ? match.team_a : match.team_b
  const code = side === 'a' ? match.team_a_code : match.team_b_code
  if (name) return { name, code, isReal: true }
  const placeholder = side === 'a' ? match.home_placeholder : match.away_placeholder
  return { name: placeholder || 'Do ustalenia', code: '', isReal: false }
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 2.5L4.5 5.3v5.4c0 5 3.1 8.9 7.5 10.8 4.4-1.9 7.5-5.8 7.5-10.8V5.3L12 2.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Each slot row is a horizontal flag+name layout for known teams (flag is
// always real data — never fabricated) or a shield+text placeholder when the
// slot has no confirmed team yet. Never guess team identity from the slot
// position alone.
function TeamCell({
  match,
  side,
  config,
  variant = 'slot',
}: {
  match: Match | null
  side: 'a' | 'b'
  config: LayoutConfig
  variant?: 'slot' | 'final'
}) {
  const t = teamDisplay(match, side)
  const scoreVal = side === 'a' ? match?.score_a : match?.score_b
  const otherScore = side === 'a' ? match?.score_b : match?.score_a
  const showScore = (match?.status === 'finished' || match?.status === 'live') && scoreVal != null
  const won = showScore && otherScore != null && scoreVal! > otherScore
  const isFinal = variant === 'final'
  const fontSize = isFinal ? config.finalFontSize : config.teamFontSize
  const flagSize = isFinal ? config.finalFlagSize : config.flagSize

  if (!t.code) {
    return (
      <div className="h-full flex items-center gap-2 px-3">
        <ShieldIcon className={cn('shrink-0 text-gray-600', isFinal ? 'w-4 h-4' : 'w-3.5 h-3.5')} />
        <span className="font-medium text-gray-500 truncate" style={{ fontSize }}>
          {t.name}
        </span>
        {showScore && (
          <span className="ml-auto font-black tabular-nums text-gray-500 shrink-0" style={{ fontSize }}>
            {scoreVal}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className={cn('h-full flex items-center gap-2.5 px-3', won && 'bg-emerald-950/30')}>
      <FlagImg code={t.code} name={t.name} size={flagSize} className="shrink-0 rounded-[3px] ring-1 ring-white/15 shadow-sm" />
      <span className={cn('font-semibold truncate', won ? 'text-white' : 'text-gray-200')} style={{ fontSize }}>
        {t.name}
      </span>
      {showScore && (
        <span
          className={cn(
            'ml-auto font-black tabular-nums shrink-0',
            match?.status === 'live' ? 'text-red-400' : won ? 'text-emerald-400' : 'text-gray-400'
          )}
          style={{ fontSize }}
        >
          {scoreVal}
        </span>
      )}
    </div>
  )
}

function SlotCard({ slot, x, y, config }: { slot: BracketSlot; x: number; y: number; config: LayoutConfig }) {
  const { match, status } = slot
  const card = (
    <div
      className={cn(
        'absolute rounded-xl border overflow-hidden backdrop-blur-sm transition-all duration-200',
        status === 'confirmed' ? 'border-emerald-700/40 bg-gray-900/75 shadow-md shadow-black/40' : 'border-white/10 bg-gray-950/60 shadow shadow-black/30',
        match && 'group-hover:border-amber-400/60 group-hover:shadow-[0_0_20px_-4px_rgba(251,191,36,0.4)] group-hover:-translate-y-0.5'
      )}
      style={{ left: x, top: y, width: config.cardW, height: config.cardH }}
    >
      <div className="divide-y divide-white/10 h-full">
        <div className="h-1/2"><TeamCell match={match} side="a" config={config} /></div>
        <div className="h-1/2"><TeamCell match={match} side="b" config={config} /></div>
      </div>
    </div>
  )
  if (match) return <Link href={`/mecze/${match.id}`} className="group block">{card}</Link>
  return card
}

function Line({
  x1,
  y1,
  x2,
  y2,
  thickness,
  accent = false,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  thickness: number
  accent?: boolean
}) {
  const base = accent
    ? 'absolute rounded-full bg-gradient-to-r from-amber-500/70 via-amber-300/90 to-amber-500/70 shadow-[0_0_10px_rgba(251,191,36,0.6)]'
    : 'absolute rounded-full bg-slate-300/80 shadow-[0_0_6px_rgba(226,232,240,0.5)]'
  if (y1 === y2) {
    return <div className={base} style={{ left: Math.min(x1, x2), top: y1 - thickness / 2, width: Math.abs(x2 - x1), height: thickness }} />
  }
  return <div className={base} style={{ left: x1 - thickness / 2, top: Math.min(y1, y2), width: thickness, height: Math.abs(y2 - y1) }} />
}

function Joint({ x, y, size, accent = false }: { x: number; y: number; size: number; accent?: boolean }) {
  return (
    <span
      className={cn('absolute rounded-full -translate-x-1/2 -translate-y-1/2', accent ? 'bg-amber-300' : 'bg-slate-300')}
      style={{ left: x, top: y, width: size, height: size }}
    />
  )
}

// Small triangular arrowhead marking where a connector enters the next
// round's card — `side` is the bracket half, which determines which way
// the line (and therefore the arrow) travels.
function Arrow({
  x,
  y,
  side,
  size,
  accent = false,
}: {
  x: number
  y: number
  side: 'left' | 'right'
  size: number
  accent?: boolean
}) {
  const color = accent ? '#fbbf24' : '#cbd5e1'
  const glow = accent ? 'drop-shadow(0 0 4px rgba(251,191,36,0.85))' : 'drop-shadow(0 0 3px rgba(226,232,240,0.6))'
  const wing = Math.round(size * 0.67)
  return (
    <span
      className="absolute -translate-y-1/2"
      style={{
        left: side === 'left' ? x - size : x,
        top: y,
        width: 0,
        height: 0,
        borderTop: `${wing}px solid transparent`,
        borderBottom: `${wing}px solid transparent`,
        borderLeft: side === 'left' ? `${size}px solid ${color}` : undefined,
        borderRight: side === 'right' ? `${size}px solid ${color}` : undefined,
        filter: glow,
      }}
    />
  )
}

function HalfConnectors({ side, config }: { side: 'left' | 'right'; config: LayoutConfig }) {
  const colX = side === 'left' ? leftColX : rightColX
  const cWidth = canvasWidth(config)
  const cMidY = centerYMid(config)
  const nodes: React.ReactNode[] = []
  for (let r = 0; r < 3; r++) {
    const slotsInNextRound = HALF_BASE / Math.pow(2, r + 1)
    for (let m = 0; m < slotsInNextRound; m++) {
      const yA = centerYAt(config, r, 2 * m)
      const yB = centerYAt(config, r, 2 * m + 1)
      const yParent = centerYAt(config, r + 1, m)
      const childEdgeX = side === 'left' ? colX(config, r) + config.cardW : colX(config, r)
      const parentEdgeX = side === 'left' ? colX(config, r + 1) : colX(config, r + 1) + config.cardW
      const xMid = (childEdgeX + parentEdgeX) / 2
      nodes.push(
        <Line key={`${side}-${r}-${m}-a`} x1={childEdgeX} y1={yA} x2={xMid} y2={yA} thickness={config.lineThickness} />,
        <Line key={`${side}-${r}-${m}-b`} x1={childEdgeX} y1={yB} x2={xMid} y2={yB} thickness={config.lineThickness} />,
        <Line key={`${side}-${r}-${m}-v`} x1={xMid} y1={yA} x2={xMid} y2={yB} thickness={config.lineThickness} />,
        <Line key={`${side}-${r}-${m}-p`} x1={xMid} y1={yParent} x2={parentEdgeX} y2={yParent} thickness={config.lineThickness} />,
        <Joint key={`${side}-${r}-${m}-ja`} x={xMid} y={yA} size={config.jointSize} />,
        <Joint key={`${side}-${r}-${m}-jb`} x={xMid} y={yB} size={config.jointSize} />,
        <Arrow key={`${side}-${r}-${m}-arrow`} x={parentEdgeX} y={yParent} side={side} size={config.arrowSize} />
      )
    }
  }
  // Semifinal -> Final
  const sfEdge = side === 'left' ? colX(config, 3) + config.cardW : colX(config, 3)
  const finalWrapperX = leftColX(config, 3) + config.cardW + config.finalGap
  const finalEdge = side === 'left' ? finalWrapperX : cWidth - finalWrapperX
  nodes.push(
    <Line key={`${side}-sf-final`} x1={sfEdge} y1={cMidY} x2={finalEdge} y2={cMidY} thickness={config.lineThickness} accent />,
    <Joint key={`${side}-sf-final-j`} x={sfEdge} y={cMidY} size={config.jointSize} accent />,
    <Arrow key={`${side}-sf-final-arrow`} x={finalEdge} y={cMidY} side={side} size={config.arrowSize} accent />
  )
  return <>{nodes}</>
}

// Pure-CSS ambient layer: dark navy base + diagonal "floodlight beam" streaks
// from the top corners + soft blurred corner glows + a faint green pitch
// horizon band + a warm gold halo behind the trophy/final. No images, no
// external assets, no new dependencies.
function BracketBackground({ config }: { config: LayoutConfig }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f1c] via-[#070b14] to-black" />
      <div
        className="absolute -top-16 -left-24"
        style={{
          width: 520,
          height: 760,
          transformOrigin: 'top left',
          transform: 'rotate(26deg)',
          background: 'linear-gradient(180deg, rgba(180,210,255,0.14) 0%, rgba(180,210,255,0.04) 40%, transparent 72%)',
        }}
      />
      <div
        className="absolute -top-16 -right-24"
        style={{
          width: 520,
          height: 760,
          transformOrigin: 'top right',
          transform: 'rotate(-26deg)',
          background: 'linear-gradient(180deg, rgba(180,210,255,0.14) 0%, rgba(180,210,255,0.04) 40%, transparent 72%)',
        }}
      />
      {[
        { left: '4%', top: '0%' },
        { left: '92%', top: '2%' },
        { left: '2%', top: '88%' },
        { left: '94%', top: '90%' },
      ].map((pos, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            ...pos,
            width: 420,
            height: 420,
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle, rgba(125,170,255,0.10) 0%, rgba(125,170,255,0.03) 45%, transparent 75%)',
          }}
        />
      ))}
      <div
        className="absolute"
        style={{
          left: '50%',
          top: centerYMid(config) - config.finalH,
          width: 680,
          height: 680,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(251,191,36,0.18) 0%, rgba(251,191,36,0.06) 35%, transparent 70%)',
        }}
      />
      <div
        className="absolute left-0 right-0 bottom-0"
        style={{ height: 110, background: 'linear-gradient(180deg, transparent 0%, rgba(16,185,129,0.07) 100%)' }}
      />
      <div className="absolute left-0 right-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  )
}

// Decorative trophy crest above the final. Pointer-events-none so it never
// intercepts clicks meant for the final card link; positioned with enough
// clearance to never overlap the final card or the semifinal columns.
function TrophyCrest({ x, y, config }: { x: number; y: number; config: LayoutConfig }) {
  return (
    <div className="absolute pointer-events-none" style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}>
      <div
        className="absolute rounded-full"
        style={{
          left: '50%',
          top: '50%',
          width: config.trophyHalo,
          height: config.trophyHalo,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(251,191,36,0.5) 0%, rgba(251,191,36,0.14) 45%, transparent 75%)',
        }}
      />
      <span
        className={cn('relative block leading-none', config.trophyEmojiClass)}
        style={{ filter: 'drop-shadow(0 0 20px rgba(251,191,36,0.7)) drop-shadow(0 0 5px rgba(251,191,36,0.95))' }}
      >
        🏆
      </span>
    </div>
  )
}

function roundLabelKey(r: number) {
  return r === 0 ? 'round_of_32' : r === 1 ? 'round_of_16' : r === 2 ? 'quarterfinal' : 'semifinal'
}

function HalfRounds({ rounds, side, config }: { rounds: BracketSlot[][]; side: 'left' | 'right'; config: LayoutConfig }) {
  const colX = side === 'left' ? leftColX : rightColX
  return (
    <>
      {rounds.map((roundSlots, r) => (
        <div key={r}>
          <div
            className="absolute text-gray-400 font-bold uppercase tracking-wider text-center"
            style={{ left: colX(config, r), top: config.padTop - config.roundLabelTop, width: config.cardW, fontSize: config.roundLabelSize }}
          >
            {BRACKET_ROUND_LABEL[roundLabelKey(r)]}
          </div>
          {roundSlots.map(slot => (
            <SlotCard
              key={`${side}-${r}-${slot.indexInRound}`}
              slot={slot}
              x={colX(config, r)}
              y={centerYAt(config, r, slot.indexInRound) - config.cardH / 2}
              config={config}
            />
          ))}
        </div>
      ))}
    </>
  )
}

function BracketCanvasBase({ matches, config }: { matches: Match[]; config: LayoutConfig }) {
  const bracket = buildBracket(matches)
  const finalMatch = bracket.final.match

  const fW = finalW(config)
  const cMidY = centerYMid(config)
  const finalWrapperX = leftColX(config, 3) + config.cardW + config.finalGap
  const finalWrapperY = cMidY - (config.finalLabelH + config.finalH) / 2
  const trophyX = finalWrapperX + fW / 2
  const trophyY = finalWrapperY - 36 - 95

  const finalCard = (
    <div className="absolute" style={{ left: finalWrapperX, top: finalWrapperY, width: fW }}>
      <div className="flex items-center justify-center gap-2.5 mb-2">
        <span className="h-px w-7 bg-gradient-to-r from-transparent to-amber-400/70" />
        <span className="text-amber-300 text-[11px] font-black uppercase tracking-[0.3em]">Finał</span>
        <span className="h-px w-7 bg-gradient-to-l from-transparent to-amber-400/70" />
      </div>
      <div
        className="relative rounded-2xl border-2 border-amber-400/80 bg-gray-950/85 backdrop-blur-sm overflow-hidden shadow-[0_0_46px_-6px_rgba(251,191,36,0.55)] transition-all duration-200 group-hover:border-amber-300 group-hover:shadow-[0_0_64px_-4px_rgba(251,191,36,0.8)]"
        style={{ height: config.finalH }}
      >
        <div className="h-1/2"><TeamCell match={finalMatch} side="a" config={config} variant="final" /></div>
        <div className="h-1/2"><TeamCell match={finalMatch} side="b" config={config} variant="final" /></div>
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-400/60 bg-gray-950 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
          vs
        </span>
      </div>
    </div>
  )

  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ width: canvasWidth(config), height: canvasHeight(config) }}>
      <BracketBackground config={config} />
      <HalfConnectors side="left" config={config} />
      <HalfConnectors side="right" config={config} />
      <HalfRounds rounds={bracket.left.rounds} side="left" config={config} />
      <HalfRounds rounds={bracket.right.rounds} side="right" config={config} />
      <TrophyCrest x={trophyX} y={trophyY} config={config} />
      {finalMatch ? <Link href={`/mecze/${finalMatch.id}`} className="group block">{finalCard}</Link> : finalCard}
    </div>
  )
}

export function BracketCanvasDesktop({ matches }: { matches: Match[] }) {
  return <BracketCanvasBase matches={matches} config={DESKTOP_CONFIG} />
}

export function BracketCanvasMobile({ matches }: { matches: Match[] }) {
  return <BracketCanvasBase matches={matches} config={MOBILE_CONFIG} />
}
