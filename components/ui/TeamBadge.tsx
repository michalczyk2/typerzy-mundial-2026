'use client'
import { FlagImg } from '@/components/ui/FlagImg'

interface Props {
  code: string
  name: string
  size?: 'sm' | 'md' | 'lg'
  direction?: 'row' | 'col'
  reverse?: boolean
  nameClassName?: string
  className?: string
}

const defaultNameClass: Record<'row' | 'col', Record<'sm' | 'md' | 'lg', string>> = {
  row: {
    sm: 'text-white text-xs font-medium truncate',
    md: 'text-white text-sm font-medium',
    lg: 'text-white text-sm font-medium',
  },
  col: {
    sm: 'text-white font-semibold text-xs text-center leading-tight',
    md: 'text-white font-semibold text-sm text-center leading-tight',
    lg: 'text-white font-semibold text-sm text-center leading-tight',
  },
}

export function TeamBadge({
  code,
  name,
  size = 'md',
  direction = 'row',
  reverse = false,
  nameClassName,
  className = '',
}: Props) {
  const nc = nameClassName ?? defaultNameClass[direction][size]

  if (direction === 'col') {
    return (
      <div className={`flex flex-col items-center gap-2 ${className}`}>
        {code && <FlagImg code={code} name={name} size={size} />}
        <span className={nc}>{name}</span>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {reverse ? (
        <>
          <span className={nc}>{name}</span>
          {code && <FlagImg code={code} name={name} size={size} />}
        </>
      ) : (
        <>
          {code && <FlagImg code={code} name={name} size={size} />}
          <span className={nc}>{name}</span>
        </>
      )}
    </div>
  )
}
