'use client'
import { useState } from 'react'
interface Props { code: string; name: string; size?: 'sm'|'md'|'lg'; className?: string }
const sizes = { sm:20, md:28, lg:40 }
export function FlagImg({ code, name, size='md', className }: Props) {
  const [err, setErr] = useState(false)
  const px = sizes[size]
  if (err) return <span className="inline-flex items-center justify-center bg-gray-700 rounded text-xs font-bold text-gray-400" style={{width:px,height:px*0.67}}>{code.toUpperCase().slice(0,2)}</span>
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`}
      alt={name}
      width={px}
      height={Math.round(px*0.67)}
      className={`rounded-sm object-cover ${className||''}`}
      onError={() => setErr(true)}
    />
  )
}
