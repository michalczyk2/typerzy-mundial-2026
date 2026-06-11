'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/mecze', label: 'Mecze' },
  { href: '/tabela', label: 'Tabela' },
  { href: '/moje-typy', label: 'Moje typy' },
  { href: '/grupy', label: 'Grupy' },
  { href: '/turniej', label: 'Drabinka' },
  { href: '/bonusy', label: 'Bonusy' },
]

export function Header() {
  const { currentUser, logout } = useAppStore()
  const pathname = usePathname()

  return (
    <header className="bg-gray-950 border-b border-gray-800 sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/mecze" className="flex items-center gap-3 shrink-0 hover:opacity-80 transition-opacity">
          <span className="text-2xl">🌍</span>
          <div>
            <h1 className="text-white font-black text-sm leading-none tracking-wide">TYPERZY 2026</h1>
            <p className="text-gray-500 text-xs">FIFA World Cup</p>
          </div>
        </Link>

        {/* Desktop navigation — hidden on mobile */}
        <nav className="hidden md:flex items-center gap-1 flex-1">
          {navItems.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'px-3 py-2 text-sm font-medium transition-colors',
                pathname.startsWith(href)
                  ? 'text-emerald-400 border-b-2 border-emerald-400'
                  : 'text-gray-400 hover:text-gray-200'
              )}
            >
              {label}
            </Link>
          ))}
          {currentUser?.role === 'admin' && (
            <Link
              href="/admin"
              className={cn(
                'px-3 py-2 text-sm font-medium transition-colors',
                pathname.startsWith('/admin')
                  ? 'text-amber-400 border-b-2 border-amber-400'
                  : 'text-gray-600 hover:text-gray-300'
              )}
            >
              Admin
            </Link>
          )}
        </nav>

        {/* User info */}
        {currentUser && (
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-white text-sm font-semibold">{currentUser.nick}</p>
              <p className="text-emerald-400 text-xs font-bold">{currentUser.total_points} pkt</p>
            </div>
            {currentUser.role === 'admin' && <Badge variant="admin">Admin</Badge>}
            <button
              onClick={logout}
              className="text-gray-500 hover:text-gray-300 text-xs transition-colors px-2 py-1"
            >
              Wyloguj
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
