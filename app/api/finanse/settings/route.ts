import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { IS_PRODUCTION_MODE } from '@/lib/tournament-config'

async function getUserId(req: NextRequest): Promise<string | null> {
  const sessionId = req.cookies.get('typerzy_session')?.value
  if (!sessionId) return null
  const db = createAdminClient()
  const { data } = await db.from('profiles').select('id').eq('id', sessionId).single()
  return data?.id ?? null
}

export async function GET(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!IS_PRODUCTION_MODE) {
    return NextResponse.json({ settings: null, transactions: [] })
  }

  const db = createAdminClient()
  const [settingsRes, txRes] = await Promise.all([
    db.from('betting_settings').select('*').eq('user_id', userId).single(),
    db.from('betting_transactions').select('*').eq('user_id', userId).order('date', { ascending: false }),
  ])

  return NextResponse.json({
    settings: settingsRes.data ?? null,
    transactions: txRes.data ?? [],
  })
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!IS_PRODUCTION_MODE) {
    return NextResponse.json({ message: 'Tryb lokalny — brak efektu' })
  }

  const body = await req.json().catch(() => ({}))
  const { starting_balance, manual_current_balance, monthly_loss_limit, transaction } = body

  const db = createAdminClient()

  if (starting_balance != null) {
    const { error } = await db.from('betting_settings').upsert(
      {
        user_id: userId,
        starting_balance: parseFloat(starting_balance) || 0,
        manual_current_balance: manual_current_balance != null ? parseFloat(manual_current_balance) : null,
        monthly_loss_limit: monthly_loss_limit != null ? parseFloat(monthly_loss_limit) : null,
      },
      { onConflict: 'user_id' },
    )
    if (error) return NextResponse.json({ error: 'Błąd zapisu ustawień' }, { status: 500 })
  }

  if (transaction) {
    const { type, amount, date, note } = transaction
    if (!type || !date) {
      return NextResponse.json({ error: 'Brakuje danych transakcji' }, { status: 400 })
    }
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: 'Kwota musi być > 0' }, { status: 400 })
    }
    const { data: txData, error } = await db
      .from('betting_transactions')
      .insert({ user_id: userId, type, amount: amountNum, date, note: note ?? null })
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: 'Błąd zapisu transakcji' }, { status: 500 })
    return NextResponse.json({ id: txData.id })
  }

  return NextResponse.json({ message: 'Zapisano' })
}

export async function DELETE(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!IS_PRODUCTION_MODE) {
    return NextResponse.json({ message: 'Tryb lokalny — brak efektu' })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Brakuje id' }, { status: 400 })

  const db = createAdminClient()
  const { error } = await db
    .from('betting_transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: 'Błąd usunięcia' }, { status: 500 })
  return NextResponse.json({ message: 'Usunięto' })
}
