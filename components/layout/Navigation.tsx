'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const navItems = [
  { href:'/mecze', label:'Mecze', icon:'⚽' },
  { href:'/daily-challenge', label:'Daily', icon:'DC' },
  { href:'/tabela', label:'Tabela', icon:'🏆' },
  { href:'/moje-typy', label:'Moje typy', icon:'📋' },
  { href:'/grupy', label:'Grupy', icon:'📊' },
  { href:'/turniej', label:'Drabinka', icon:'🏟️' },
  { href:'/finanse', label:'Finanse', icon:'💰' },
]

export function Navigation() {
  const pathname = usePathname()
  const { currentUser } = useAppStore()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-950 border-t border-gray-800 z-50 safe-bottom md:hidden">
      <div className="flex items-center justify-around px-2">
        {navItems.map(({ href, label, icon }) => (
          <Link key={href} href={href}
            className={cn('flex flex-col items-center gap-0.5 px-2 py-3 text-xs font-medium transition-colors min-w-[52px]',
              pathname.startsWith(href) ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-gray-500 hover:text-gray-200'
            )}>
            <span className="text-base">{icon}</span>
            <span>{label}</span>
          </Link>
        ))}
        {currentUser?.role === 'admin' && (
          <Link href="/admin"
            className={cn('flex flex-col items-center gap-0.5 px-2 py-3 text-xs font-medium transition-colors min-w-[52px]',
              pathname.startsWith('/admin') ? 'text-amber-400 border-b-2 border-amber-400' : 'text-gray-600 hover:text-gray-300'
            )}>
            <span className="text-base">🔧</span>
            <span>Admin</span>
          </Link>
        )}
      </div>
    </nav>
  )
}
