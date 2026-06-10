import { cn } from '@/lib/utils'
import { ButtonHTMLAttributes } from 'react'
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'primary'|'secondary'|'danger'|'ghost'; size?: 'sm'|'md'|'lg' }
const vs = { primary:'bg-emerald-600 hover:bg-emerald-500 text-white', secondary:'bg-gray-700 hover:bg-gray-600 text-gray-100', danger:'bg-red-700 hover:bg-red-600 text-white', ghost:'bg-transparent hover:bg-gray-800 text-gray-400 hover:text-white' }
const ss = { sm:'px-3 py-1.5 text-xs', md:'px-4 py-2 text-sm', lg:'px-6 py-3 text-base' }
export function Button({ variant='primary', size='md', className, children, ...props }: ButtonProps) {
  return <button className={cn('rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed', vs[variant], ss[size], className)} {...props}>{children}</button>
}
