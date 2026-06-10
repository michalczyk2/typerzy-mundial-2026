import { cn } from '@/lib/utils'
interface BadgeProps { children: React.ReactNode; variant?: 'live'|'finished'|'scheduled'|'postponed'|'admin'|'pending'|'default'; className?: string }
const v = { live:'bg-red-600 text-white animate-pulse', finished:'bg-gray-700 text-gray-200', scheduled:'bg-blue-900 text-blue-200', postponed:'bg-yellow-800 text-yellow-200', admin:'bg-amber-600 text-white', pending:'bg-orange-800 text-orange-200', default:'bg-gray-800 text-gray-300' }
export function Badge({ children, variant='default', className }: BadgeProps) {
  return <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide', v[variant], className)}>{children}</span>
}
