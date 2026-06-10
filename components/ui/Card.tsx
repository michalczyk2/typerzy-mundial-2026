import { cn } from '@/lib/utils'
interface CardProps { children: React.ReactNode; className?: string }
export function Card({ children, className }: CardProps) {
  return <div className={cn('bg-gray-900 border border-gray-800 rounded-xl p-4', className)}>{children}</div>
}
