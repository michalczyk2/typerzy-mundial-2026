'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { FlagImg } from '@/components/ui/FlagImg'
import { cn, formatMatchDate, formatMatchTime, getMatchStatusLabel, getPhaseLabel } from '@/lib/utils'
import { buildBracket, slotCenterRowUnit, BRACKET_ROUND_LABEL, type BracketData, type BracketSlot, type SlotStatus } from '@/lib/bracket'
import type { Match } from '@/types'

const HALF_BASE = 8

// Single flat set of dimensions for the desktop horizontal bracket. No
// density/responsive config layer — desktop and mobile are two separate,
// independently laid-out views of the same BracketData, sharing the same
// stacked-team MatchCard component.
const CARD_W = 120
const CARD_H = 90
const COL_GAP = 22
const ROW = 84
const PAD_X = 22
const PAD_TOP = 50
const PAD_BOTTOM = 24
const FINAL_GAP = 18
const FINAL_W = CARD_W + 2 * COL_GAP - 2 * FINAL_GAP
const LINE_THICKNESS = 2
const JOINT_SIZE = 5
const ARROW_SIZE = 6
const LINE_COLOR = '#4b5563' // gray-600, flat, no glow

function colW() {
  return CARD_W + COL_GAP
}
function canvasWidth() {
  return PAD_X * 2 + 9 * CARD_W + 8 * COL_GAP
}
function canvasHeight() {
  return PAD_TOP + HALF_BASE * ROW + PAD_BOTTOM
}
function centerYMid() {
  return PAD_TOP + (HALF_BASE * ROW) / 2
}
function leftColX(roundIndex: number) {
  return PAD_X + roundIndex * colW()
}
function rightColX(roundIndex: number) {
  return PAD_X + (8 - roundIndex) * colW()
}
function centerYAt(roundIndex: number, indexInRound: number) {
  return PAD_TOP + slotCenterRowUnit(roundIndex, indexInRound) * ROW
}

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

// Round 28px flag avatar (overflow-hidden circle), per FotMob's card style.
function RoundFlag({ code, name }: { code: string; name: string }) {
  return (
    <span className="inline-flex w-7 h-7 rounded-full overflow-hidden shrink-0 ring-1 ring-white/10">
      <FlagImg code={code} name={name} size="sm" className="w-full h-full object-cover" />
    </span>
  )
}

// Round gray placeholder badge for an unconfirmed team slot.
function RoundPlaceholder() {
  return (
    <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-gray-800 ring-1 ring-white/10 shrink-0">
      <ShieldIcon className="w-3.5 h-3.5 text-gray-600" />
    </span>
  )
}

// Footer strip: match date/time for scheduled games, a live/status label
// once underway, or a colored badge for the final / third-place match.
function MatchFooter({ match }: { match: Match | null }) {
  let content: React.ReactNode = '—'
  let textClass = 'text-gray-500'
  if (match) {
    if (match.phase === 'final') {
      content = (
        <span className="px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/50 text-amber-300 text-[9px] font-bold uppercase tracking-wider">
          {getPhaseLabel('final')}
        </span>
      )
    } else if (match.phase === 'third_place') {
      content = (
        <span className="px-2 py-0.5 rounded-full bg-sky-400/20 border border-sky-400/50 text-sky-300 text-[9px] font-bold uppercase tracking-wider">
          {getPhaseLabel('third_place')}
        </span>
      )
    } else if (match.status === 'live') {
      content = 'NA ŻYWO'
      textClass = 'text-red-400 font-bold'
    } else if (match.status === 'finished') {
      content = 'Zakończony'
    } else if (match.status === 'postponed' || match.status === 'cancelled') {
      content = getMatchStatusLabel(match.status)
    } else {
      content = `${formatMatchDate(match.match_date)} • ${formatMatchTime(match.match_date)}`
    }
  }
  return <div className={cn('flex items-center justify-center text-[11px] py-1.5 px-2.5', textClass)}>{content}</div>
}

// FotMob-style match card: a compact square — both flags side by side on
// top, the matching 3-letter codes centered beneath each flag, and a
// date/status footer strip. Same component for desktop (fixed width, set
// by the caller) and mobile (w-full) — only the wrapping container width
// differs.
function MatchCard({ match, status, className }: { match: Match | null; status: SlotStatus; className?: string }) {
  const a = teamDisplay(match, 'a')
  const b = teamDisplay(match, 'b')
  const showScore = (match?.status === 'finished' || match?.status === 'live') && match?.score_a != null && match?.score_b != null
  const aWon = showScore && match!.score_a! > match!.score_b!
  const bWon = showScore && match!.score_b! > match!.score_a!

  const card = (
    <div
      className={cn(
        'rounded-lg border bg-[#1a2035] border-[#2a3050] overflow-hidden',
        match && 'hover:border-[#3d4670] transition-colors',
        className
      )}
    >
      <div className="grid grid-cols-2 gap-2 px-2 pt-2 pb-1.5">
        <div className="flex flex-col items-center gap-1 min-w-0">
          {a.code ? <RoundFlag code={a.code} name={a.name} /> : <RoundPlaceholder />}
          <span className={cn('text-[11px] font-bold truncate', a.code ? (aWon ? 'text-white' : 'text-gray-100') : 'text-gray-500')}>
            {a.code ? a.code.toUpperCase() : '—'}
          </span>
        </div>
        <div className="flex flex-col items-center gap-1 min-w-0">
          {b.code ? <RoundFlag code={b.code} name={b.name} /> : <RoundPlaceholder />}
          <span className={cn('text-[11px] font-bold truncate', b.code ? (bWon ? 'text-white' : 'text-gray-100') : 'text-gray-500')}>
            {b.code ? b.code.toUpperCase() : '—'}
          </span>
        </div>
      </div>
      <div className="border-t border-[#2a3050]">
        <MatchFooter match={match} />
      </div>
    </div>
  )
  if (match) return <Link href={`/mecze/${match.id}`} className="block">{card}</Link>
  return card
}

function TrophyMark() {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="leading-none text-5xl">🏆</span>
      <span className="text-amber-400 text-[10px] font-black uppercase tracking-[0.25em]">Zwycięzca</span>
    </div>
  )
}

function Line({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  if (y1 === y2) {
    return (
      <div
        className="absolute"
        style={{ left: Math.min(x1, x2), top: y1 - LINE_THICKNESS / 2, width: Math.abs(x2 - x1), height: LINE_THICKNESS, background: LINE_COLOR }}
      />
    )
  }
  return (
    <div
      className="absolute"
      style={{ left: x1 - LINE_THICKNESS / 2, top: Math.min(y1, y2), width: LINE_THICKNESS, height: Math.abs(y2 - y1), background: LINE_COLOR }}
    />
  )
}

function Joint({ x, y }: { x: number; y: number }) {
  return (
    <span
      className="absolute rounded-full -translate-x-1/2 -translate-y-1/2"
      style={{ left: x, top: y, width: JOINT_SIZE, height: JOINT_SIZE, background: LINE_COLOR }}
    />
  )
}

function Arrow({ x, y, side }: { x: number; y: number; side: 'left' | 'right' }) {
  const wing = Math.round(ARROW_SIZE * 0.67)
  return (
    <span
      className="absolute -translate-y-1/2"
      style={{
        left: side === 'left' ? x - ARROW_SIZE : x,
        top: y,
        width: 0,
        height: 0,
        borderTop: `${wing}px solid transparent`,
        borderBottom: `${wing}px solid transparent`,
        borderLeft: side === 'left' ? `${ARROW_SIZE}px solid ${LINE_COLOR}` : undefined,
        borderRight: side === 'right' ? `${ARROW_SIZE}px solid ${LINE_COLOR}` : undefined,
      }}
    />
  )
}

function HalfConnectors({ side }: { side: 'left' | 'right' }) {
  const colX = side === 'left' ? leftColX : rightColX
  const cMidY = centerYMid()
  const nodes: React.ReactNode[] = []
  for (let r = 0; r < 3; r++) {
    const slotsInNextRound = HALF_BASE / Math.pow(2, r + 1)
    for (let m = 0; m < slotsInNextRound; m++) {
      const yA = centerYAt(r, 2 * m)
      const yB = centerYAt(r, 2 * m + 1)
      const yParent = centerYAt(r + 1, m)
      const childEdgeX = side === 'left' ? colX(r) + CARD_W : colX(r)
      const parentEdgeX = side === 'left' ? colX(r + 1) : colX(r + 1) + CARD_W
      const xMid = (childEdgeX + parentEdgeX) / 2
      nodes.push(
        <Line key={`${side}-${r}-${m}-a`} x1={childEdgeX} y1={yA} x2={xMid} y2={yA} />,
        <Line key={`${side}-${r}-${m}-b`} x1={childEdgeX} y1={yB} x2={xMid} y2={yB} />,
        <Line key={`${side}-${r}-${m}-v`} x1={xMid} y1={yA} x2={xMid} y2={yB} />,
        <Line key={`${side}-${r}-${m}-p`} x1={xMid} y1={yParent} x2={parentEdgeX} y2={yParent} />,
        <Joint key={`${side}-${r}-${m}-ja`} x={xMid} y={yA} />,
        <Joint key={`${side}-${r}-${m}-jb`} x={xMid} y={yB} />,
        <Arrow key={`${side}-${r}-${m}-arrow`} x={parentEdgeX} y={yParent} side={side} />
      )
    }
  }
  const sfEdge = side === 'left' ? colX(3) + CARD_W : colX(3)
  const finalWrapperX = leftColX(3) + CARD_W + FINAL_GAP
  const finalEdge = side === 'left' ? finalWrapperX : canvasWidth() - finalWrapperX
  nodes.push(
    <Line key={`${side}-sf-final`} x1={sfEdge} y1={cMidY} x2={finalEdge} y2={cMidY} />,
    <Joint key={`${side}-sf-final-j`} x={sfEdge} y={cMidY} />,
    <Arrow key={`${side}-sf-final-arrow`} x={finalEdge} y={cMidY} side={side} />
  )
  return <>{nodes}</>
}

function roundLabelKey(r: number) {
  return r === 0 ? 'round_of_32' : r === 1 ? 'round_of_16' : r === 2 ? 'quarterfinal' : 'semifinal'
}

function HalfRounds({ rounds, side }: { rounds: BracketSlot[][]; side: 'left' | 'right' }) {
  const colX = side === 'left' ? leftColX : rightColX
  return (
    <>
      {rounds.map((roundSlots, r) => (
        <div key={r}>
          <div
            className="absolute text-gray-500 font-bold uppercase tracking-wider text-center text-[11px]"
            style={{ left: colX(r), top: PAD_TOP - 30, width: CARD_W }}
          >
            {BRACKET_ROUND_LABEL[roundLabelKey(r)]}
          </div>
          {roundSlots.map(slot => (
            <div
              key={`${side}-${r}-${slot.indexInRound}`}
              className="absolute"
              style={{ left: colX(r), top: centerYAt(r, slot.indexInRound) - CARD_H / 2, width: CARD_W, height: CARD_H }}
            >
              <MatchCard match={slot.match} status={slot.status} className="w-full" />
            </div>
          ))}
        </div>
      ))}
    </>
  )
}

// Desktop: measures available width and scales the fixed-layout bracket canvas
// to fill it exactly — no horizontal scroll, no overflow.
function DesktopView({ bracket }: { bracket: BracketData }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setScale(el.clientWidth / canvasWidth())
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const cMidY = centerYMid()
  const finalWrapperX = leftColX(3) + CARD_W + FINAL_GAP
  const finalWrapperY = cMidY - CARD_H / 2
  const trophyX = finalWrapperX + FINAL_W / 2
  const trophyY = finalWrapperY - 64

  return (
    <div ref={ref} className="hidden md:block w-full" style={{ height: canvasHeight() * scale }}>
      <div
        className="relative rounded-2xl overflow-hidden bg-gradient-to-b from-gray-950 to-black"
        style={{ width: canvasWidth(), height: canvasHeight(), transform: `scale(${scale})`, transformOrigin: 'top left' }}
      >
        <HalfConnectors side="left" />
        <HalfConnectors side="right" />
        <HalfRounds rounds={bracket.left.rounds} side="left" />
        <HalfRounds rounds={bracket.right.rounds} side="right" />
        <div className="absolute" style={{ left: trophyX, top: trophyY, transform: 'translate(-50%, -50%)' }}>
          <TrophyMark />
        </div>
        <div className="absolute" style={{ left: finalWrapperX, top: finalWrapperY, width: FINAL_W, height: CARD_H }}>
          <MatchCard match={bracket.final.match} status={bracket.final.status} className="w-full" />
        </div>
      </div>
    </div>
  )
}

// Vertical arrow head, the mobile-tree analogue of desktop's horizontal Arrow.
function ArrowV({ x, y, pointDown }: { x: number; y: number; pointDown: boolean }) {
  const wing = Math.round(ARROW_SIZE * 0.67)
  return (
    <span
      className="absolute -translate-x-1/2"
      style={{
        left: x,
        top: pointDown ? y - ARROW_SIZE : y,
        width: 0,
        height: 0,
        borderLeft: `${wing}px solid transparent`,
        borderRight: `${wing}px solid transparent`,
        borderTop: pointDown ? `${ARROW_SIZE}px solid ${LINE_COLOR}` : undefined,
        borderBottom: pointDown ? undefined : `${ARROW_SIZE}px solid ${LINE_COLOR}`,
      }}
    />
  )
}

// Connects every sibling pair in round `childR` (the round with more slots)
// down to their single shared slot in round `childR + 1` — the vertical
// analogue of desktop's HalfConnectors, with x/y swapped. `childAbove` says
// whether the child round sits physically above the parent round on the
// page (true on the left/top half, false on the mirrored right/bottom
// half), which picks the card edges to draw from and which way the
// arrowhead points.
function MobileMergeConnectors({
  childR,
  childY,
  parentY,
  unit,
  cardH,
  childAbove,
}: {
  childR: number
  childY: number
  parentY: number
  unit: number
  cardH: number
  childAbove: boolean
}) {
  const parentCount = HALF_BASE / Math.pow(2, childR + 1)
  const childEdgeY = childAbove ? childY + cardH / 2 : childY - cardH / 2
  const parentEdgeY = childAbove ? parentY - cardH / 2 : parentY + cardH / 2
  const midY = (childEdgeY + parentEdgeY) / 2
  const nodes: React.ReactNode[] = []
  for (let m = 0; m < parentCount; m++) {
    const xA = slotCenterRowUnit(childR, 2 * m) * unit
    const xB = slotCenterRowUnit(childR, 2 * m + 1) * unit
    const xP = slotCenterRowUnit(childR + 1, m) * unit
    nodes.push(
      <Line key={`mm-${childR}-${m}-a`} x1={xA} y1={childEdgeY} x2={xA} y2={midY} />,
      <Line key={`mm-${childR}-${m}-b`} x1={xB} y1={childEdgeY} x2={xB} y2={midY} />,
      <Line key={`mm-${childR}-${m}-h`} x1={xA} y1={midY} x2={xB} y2={midY} />,
      <Line key={`mm-${childR}-${m}-p`} x1={xP} y1={midY} x2={xP} y2={parentEdgeY} />,
      <Joint key={`mm-${childR}-${m}-ja`} x={xA} y={midY} />,
      <Joint key={`mm-${childR}-${m}-jb`} x={xB} y={midY} />,
      <ArrowV key={`mm-${childR}-${m}-arrow`} x={xP} y={parentEdgeY} pointDown={childAbove} />
    )
  }
  return <>{nodes}</>
}

// Single-slot link with no merging needed (left/right semifinal slot ↔ final).
function MobileDirectConnector({ x, fromY, toY, pointDown }: { x: number; fromY: number; toY: number; pointDown: boolean }) {
  return (
    <>
      <Line x1={x} y1={fromY} x2={x} y2={toY} />
      <ArrowV x={x} y={toY} pointDown={pointDown} />
    </>
  )
}

type MobileLevel =
  | { kind: 'round'; r: number; slots: BracketSlot[] }
  | { kind: 'final' }

// The exact same horizontal-row bracket tree as the desktop view, rotated
// 90°: round of 32 → round of 16 → quarterfinal → semifinal stack top to
// bottom on the left half, converge on the centered final + trophy, then
// the mirrored right half expands back out below it, ending in third
// place. Cards are the same MatchCard used on desktop, rendered at full
// size and visually shrunk with a CSS transform (not redesigned) so a full
// row of 8 fits the screen width.
function MobileBracket({ bracket }: { bracket: BracketData }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (!width) return <div ref={containerRef} className="w-full" />

  const unit = width / HALF_BASE
  const mCardW = Math.max(unit - 3, 1)
  const mScale = mCardW / CARD_W
  const mCardH = CARD_H * mScale
  const labelH = 11
  const connectorGap = 30
  const TROPHY_SCALE = 0.55
  const TROPHY_H = 76

  const leftRounds: MobileLevel[] = bracket.left.rounds.map((slots, r): MobileLevel => ({ kind: 'round', r, slots }))
  const rightRounds: MobileLevel[] = bracket.right.rounds.map((slots, r): MobileLevel => ({ kind: 'round', r, slots })).reverse()
  const levels: MobileLevel[] = [...leftRounds, { kind: 'final' }, ...rightRounds]

  let cursor = 16
  const ys = levels.map(() => {
    const centerY = cursor + labelH + mCardH / 2
    cursor = cursor + labelH + mCardH + connectorGap
    return centerY
  })
  const canvasHeight = cursor - connectorGap + 16
  const finalIdx = levels.findIndex(l => l.kind === 'final')
  const semifinalX = slotCenterRowUnit(3, 0) * unit

  const cardStyle = (x: number, y: number): React.CSSProperties => ({
    left: x - mCardW / 2,
    top: y - mCardH / 2,
    width: CARD_W,
    height: CARD_H,
    transform: `scale(${mScale})`,
    transformOrigin: 'top left',
  })

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: canvasHeight }}>
      {leftRounds.slice(0, -1).map((level, i) => {
        if (level.kind !== 'round') return null
        return (
          <MobileMergeConnectors
            key={`left-merge-${level.r}`}
            childR={level.r}
            childY={ys[i]}
            parentY={ys[i + 1]}
            unit={unit}
            cardH={mCardH}
            childAbove
          />
        )
      })}
      <MobileDirectConnector x={semifinalX} fromY={ys[3] + mCardH / 2} toY={ys[finalIdx] - mCardH / 2} pointDown />
      <MobileDirectConnector x={semifinalX} fromY={ys[finalIdx + 1] - mCardH / 2} toY={ys[finalIdx] + mCardH / 2} pointDown={false} />
      {rightRounds.slice(1).map((level, i) => {
        if (level.kind !== 'round') return null
        const childIdx = finalIdx + 2 + i
        return (
          <MobileMergeConnectors
            key={`right-merge-${level.r}`}
            childR={level.r}
            childY={ys[childIdx]}
            parentY={ys[childIdx - 1]}
            unit={unit}
            cardH={mCardH}
            childAbove={false}
          />
        )
      })}

      {levels.map((level, idx) => {
        const y = ys[idx]
        if (level.kind === 'final') {
          const trophyX = width / 2 + mCardW / 2 + 8
          const trophyY = y - (TROPHY_H * TROPHY_SCALE) / 2
          return (
            <div key="final">
              <div
                className="absolute"
                style={{ left: trophyX, top: trophyY, transform: `scale(${TROPHY_SCALE})`, transformOrigin: 'top left' }}
              >
                <TrophyMark />
              </div>
              <div className="absolute" style={cardStyle(width / 2, y)}>
                <MatchCard match={bracket.final.match} status={bracket.final.status} className="w-full" />
              </div>
            </div>
          )
        }
        return (
          <div key={idx}>
            <div
              className="absolute text-center text-gray-500 font-bold uppercase tracking-wider text-[9px]"
              style={{ left: 0, width, top: y - mCardH / 2 - labelH }}
            >
              {BRACKET_ROUND_LABEL[roundLabelKey(level.r)]}
            </div>
            {level.slots.map(slot => {
              const x = slotCenterRowUnit(level.r, slot.indexInRound) * unit
              return (
                <div key={`${idx}-${slot.indexInRound}`} className="absolute" style={cardStyle(x, y)}>
                  <MatchCard match={slot.match} status={slot.status} className="w-full" />
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

export function BracketCanvas({ matches }: { matches: Match[] }) {
  const bracket = buildBracket(matches)
  return (
    <>
      <DesktopView bracket={bracket} />
      <div className="md:hidden">
        <MobileBracket bracket={bracket} />
      </div>
    </>
  )
}
