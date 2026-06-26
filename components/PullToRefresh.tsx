'use client'

import { useEffect, useRef, useState } from 'react'

const THRESHOLD = 72   // px to pull before releasing triggers reload
const MAX_PULL = 96    // max visual travel in px
const RESISTANCE = 0.4 // how much drag is dampened

export function PullToRefresh() {
  const [pullY, setPullY] = useState(0)
  const [releasing, setReleasing] = useState(false)
  const [triggered, setTriggered] = useState(false)
  const startY = useRef<number | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0) return
      startY.current = e.touches[0].clientY
      setReleasing(false)
      setTriggered(false)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (startY.current === null) return
      const delta = (e.touches[0].clientY - startY.current) * RESISTANCE
      if (delta <= 0) { startY.current = null; return }
      // Prevent native scroll bounce while pulling
      if (window.scrollY === 0 && delta > 0) e.preventDefault()
      setPullY(Math.min(delta, MAX_PULL))
    }

    const onTouchEnd = () => {
      if (startY.current === null) return
      startY.current = null
      setReleasing(true)
      if (pullY >= THRESHOLD * RESISTANCE) {
        setTriggered(true)
        setPullY(0)
        setTimeout(() => window.location.reload(), 300)
      } else {
        setPullY(0)
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [pullY])

  if (pullY === 0 && !triggered) return null

  const progress = Math.min(pullY / (THRESHOLD * RESISTANCE), 1)
  const ready = progress >= 1

  return (
    <div
      className="pointer-events-none fixed left-0 right-0 top-0 z-[9999] flex justify-center"
      style={{
        transform: `translateY(${pullY - 48}px)`,
        transition: releasing ? 'transform 0.25s ease' : undefined,
      }}
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-full border shadow-lg transition-colors ${
          ready
            ? 'border-emerald-500 bg-emerald-950 text-emerald-400'
            : 'border-gray-700 bg-gray-900 text-gray-500'
        }`}
        style={{ opacity: Math.max(0.3, progress) }}
      >
        {triggered ? (
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a10 10 0 100 20v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
          </svg>
        ) : (
          <svg
            className="h-5 w-5 transition-transform duration-150"
            style={{ transform: `rotate(${ready ? 180 : progress * 160}deg)` }}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          >
            <path d="M12 5v14M5 12l7 7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </div>
  )
}
