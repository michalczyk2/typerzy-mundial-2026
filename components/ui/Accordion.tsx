'use client'
import { useState, type ReactNode } from 'react'

interface Props {
  title: ReactNode
  defaultOpen?: boolean
  children: ReactNode
  className?: string
}

export function Accordion({ title, defaultOpen = false, children, className = '' }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-xl overflow-hidden ${className}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="text-base font-bold text-white">{title}</span>
        <span className="text-gray-500 text-sm shrink-0">{open ? '▲ Zwiń' : '▼ Rozwiń'}</span>
      </button>
      {open && <div className="border-t border-gray-800 px-4 py-4">{children}</div>}
    </div>
  )
}
