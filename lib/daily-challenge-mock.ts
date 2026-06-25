export type DailyChallengeCategory = {
  id: string
  title: string
  icon: string
  description: string
  status: string
  maxPoints: number
  href: string
  enabled: boolean
  accentClass: string
}

export const dailyChallengePreview = {
  title: 'Daily Challenge',
  subtitle: 'Codzienne mini-gry pilkarskie inspirowane Wordle i LoLdle, bez wplywu na obecny ranking typerow.',
  todayLabel: 'Dzisiaj',
  status: 'Etap 4: FootWordle + Piłkarzdle + Quotedle + Clubdle',
  rules: [
    'Jedno wyzwanie dziennie',
    'Punkty Daily pozostaja osobnym modulem',
    'Na tym etapie zapis tylko w localStorage',
  ],
}

export const dailyChallengeCategories: DailyChallengeCategory[] = [
  {
    id: 'footwordle',
    title: 'FootWordle',
    icon: '🔤',
    description: 'Zgadnij pilkarza, klub, stadion lub reprezentacje jak w Wordle.',
    status: 'Nie rozpoczęto',
    maxPoints: 100,
    href: '/daily-challenge/footwordle',
    enabled: true,
    accentClass: 'from-emerald-500/20 to-emerald-900/10 border-emerald-800/60',
  },
  {
    id: 'pilkarzdle',
    title: 'Piłkarzdle',
    icon: '👤',
    description: 'Odgadnij zawodnika po pilkarskich wskazowkach i porownaniach.',
    status: 'Nie rozpoczęto',
    maxPoints: 100,
    href: '/daily-challenge/pilkarzdle',
    enabled: true,
    accentClass: 'from-amber-500/20 to-amber-900/10 border-amber-800/60',
  },
  {
    id: 'logodle',
    title: 'Logodle',
    icon: '🛡️',
    description: 'Rozpoznaj klub, federacje lub turniej po fragmencie herbu.',
    status: 'Placeholder',
    maxPoints: 100,
    href: '/daily-challenge',
    enabled: false,
    accentClass: 'from-blue-500/20 to-blue-900/10 border-blue-800/60',
  },
  {
    id: 'transferdle',
    title: 'Transferdle',
    icon: '🔁',
    description: 'Uloz sciezke transferowa i zgadnij pilkarza po karierze.',
    status: 'Placeholder',
    maxPoints: 100,
    href: '/daily-challenge',
    enabled: false,
    accentClass: 'from-rose-500/20 to-rose-900/10 border-rose-800/60',
  },
  {
    id: 'clubdle',
    title: 'Clubdle',
    icon: '🏟️',
    description: 'Zgadnij klub po stadionie, kraju, lidze i pilkarskich tropach.',
    status: 'Nie rozpoczęto',
    maxPoints: 100,
    href: '/daily-challenge/clubdle',
    enabled: true,
    accentClass: 'from-cyan-500/20 to-cyan-900/10 border-cyan-800/60',
  },
  {
    id: 'quotedle',
    title: 'Quotedle',
    icon: '💬',
    description: 'Rozpoznaj autora kultowego pilkarskiego cytatu.',
    status: 'Nie rozpoczęto',
    maxPoints: 100,
    href: '/daily-challenge/quotedle',
    enabled: true,
    accentClass: 'from-fuchsia-500/20 to-fuchsia-900/10 border-fuchsia-800/60',
  },
]
