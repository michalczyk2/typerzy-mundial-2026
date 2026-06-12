import { redirect } from 'next/navigation'

// Bonus content has moved to the Tabela tab
export default function BonusyPage() {
  redirect('/tabela')
}

