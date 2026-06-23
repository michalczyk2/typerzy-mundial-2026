'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

interface Props {
  contentWidth: number
  contentHeight: number
  children: React.ReactNode
  className?: string
  minScale?: number
  maxScale?: number
}

interface Transform {
  scale: number
  x: number
  y: number
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

export function ZoomPanView({ contentWidth, contentHeight, children, className = '', minScale = 0.35, maxScale = 2.5 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState<Transform>({ scale: 1, x: 0, y: 0 })
  const fitScaleRef = useRef(1)
  // "Fit" must always show the whole bracket, even on narrow phones where the
  // true fit ratio is smaller than the default minScale floor.
  const effectiveMinScaleRef = useRef(minScale)

  const computeFit = useCallback((): Transform => {
    const el = containerRef.current
    if (!el) return { scale: 1, x: 0, y: 0 }
    const { width, height } = el.getBoundingClientRect()
    const rawFit = Math.min(width / contentWidth, height / contentHeight)
    const effectiveMin = Math.min(minScale, rawFit)
    effectiveMinScaleRef.current = effectiveMin
    const scale = clamp(rawFit, effectiveMin, 1)
    fitScaleRef.current = scale
    return {
      scale,
      x: (width - contentWidth * scale) / 2,
      y: (height - contentHeight * scale) / 2,
    }
  }, [contentWidth, contentHeight, minScale])

  useEffect(() => {
    setTransform(computeFit())
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setTransform(computeFit()))
    ro.observe(el)
    return () => ro.disconnect()
  }, [computeFit])

  const zoomBy = useCallback((factor: number, centerX?: number, centerY?: number) => {
    setTransform(prev => {
      const el = containerRef.current
      const cx = centerX ?? (el ? el.getBoundingClientRect().width / 2 : 0)
      const cy = centerY ?? (el ? el.getBoundingClientRect().height / 2 : 0)
      const nextScale = clamp(prev.scale * factor, effectiveMinScaleRef.current, maxScale)
      const ratio = nextScale / prev.scale
      return {
        scale: nextScale,
        x: cx - (cx - prev.x) * ratio,
        y: cy - (cy - prev.y) * ratio,
      }
    })
  }, [maxScale])

  const resetFit = useCallback(() => setTransform(computeFit()), [computeFit])

  // --- Pointer-based pan (mouse + single touch) ---
  const dragState = useRef<{ id: number; startX: number; startY: number; origX: number; origY: number } | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' && pinchState.current) return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    dragState.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, origX: transform.x, origY: transform.y }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragState.current
    if (!d || d.id !== e.pointerId) return
    setTransform(prev => ({ ...prev, x: d.origX + (e.clientX - d.startX), y: d.origY + (e.clientY - d.startY) }))
  }
  const endDrag = (e: React.PointerEvent) => {
    if (dragState.current?.id === e.pointerId) dragState.current = null
  }

  // --- Two-finger pinch zoom (native touch events for multi-touch) ---
  const pinchState = useRef<{ dist: number; scale: number } | null>(null)

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      dragState.current = null
      const [a, b] = [e.touches[0], e.touches[1]]
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      pinchState.current = { dist, scale: transform.scale }
    }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchState.current) {
      e.preventDefault()
      const [a, b] = [e.touches[0], e.touches[1]]
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      const factor = dist / pinchState.current.dist
      const el = containerRef.current
      const rect = el?.getBoundingClientRect()
      const cx = rect ? (a.clientX + b.clientX) / 2 - rect.left : undefined
      const cy = rect ? (a.clientY + b.clientY) / 2 - rect.top : undefined
      setTransform(prev => {
        const nextScale = clamp(pinchState.current!.scale * factor, effectiveMinScaleRef.current, maxScale)
        const ratio = nextScale / prev.scale
        const ccx = cx ?? prev.x
        const ccy = cy ?? prev.y
        return { scale: nextScale, x: ccx - (ccx - prev.x) * ratio, y: ccy - (ccy - prev.y) * ratio }
      })
    }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchState.current = null
  }

  // --- Trackpad pinch / ctrl+wheel zoom (desktop). Plain wheel is left alone
  // so the page keeps scrolling normally when the cursor is over the canvas. ---
  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    const cx = rect ? e.clientX - rect.left : undefined
    const cy = rect ? e.clientY - rect.top : undefined
    zoomBy(e.deltaY < 0 ? 1.08 : 0.93, cx, cy)
  }

  return (
    <div className={className}>
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-xl border border-gray-800 bg-gradient-to-b from-gray-950 to-black touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onWheel={onWheel}
        style={{
          // Match the canvas's own proportions so "fit" fills the box instead
          // of leaving large empty bands on narrow (mobile) containers.
          aspectRatio: `${contentWidth} / ${contentHeight}`,
          minHeight: 140,
          maxHeight: 760,
          cursor: dragState.current ? 'grabbing' : 'grab',
        }}
      >
        <div
          style={{
            width: contentWidth,
            height: contentHeight,
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: '0 0',
          }}
        >
          {children}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2.5 mt-4">
        <button
          onClick={() => zoomBy(0.85)}
          className="w-11 h-11 rounded-xl bg-gray-800/90 border border-gray-700 text-white text-lg font-bold hover:bg-gray-700 active:scale-95 transition-all"
          aria-label="Oddal"
        >
          −
        </button>
        <button
          onClick={resetFit}
          className="flex items-center gap-2 px-5 h-11 rounded-xl bg-gray-800/90 border border-gray-700 text-gray-200 text-sm font-semibold hover:bg-gray-700 active:scale-95 transition-all"
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 shrink-0" aria-hidden>
            <path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Dopasuj
        </button>
        <button
          onClick={() => zoomBy(1.18)}
          className="w-11 h-11 rounded-xl bg-gray-800/90 border border-gray-700 text-white text-lg font-bold hover:bg-gray-700 active:scale-95 transition-all"
          aria-label="Przybliż"
        >
          +
        </button>
      </div>
    </div>
  )
}
