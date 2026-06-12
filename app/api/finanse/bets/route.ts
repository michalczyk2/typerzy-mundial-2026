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

function computePayoutAndProfit(
  stake: number,
  odds: number,
  status: string,
  cashOutAmount?: number | null,
): { payout: number; profit: number } {
  let payout = 0
  let profit = 0
  switch (status) {
    case 'won':
      payout = stake * odds
      profit = payout - stake
      break
    case 'lost':
      payout = 0
      profit = -stake
      break
    case 'cashout':
      payout = cashOutAmount ?? 0
      profit = payout - stake
      break
    case 'void':
      payout = stake
      profit = 0
      break
    default: // pending
      payout = 0
      profit = 0
  }
  return {
    payout: Math.round(payout * 100) / 100,
    profit: Math.round(profit * 100) / 100,
  }
}

export async function GET(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!IS_PRODUCTION_MODE) {
    return NextResponse.json({ bets: [] })
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('betting_bets')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Błąd bazy danych' }, { status: 500 })
  return NextResponse.json({ bets: data ?? [] })
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!IS_PRODUCTION_MODE) {
    return NextResponse.json({ message: 'Tryb lokalny — brak efektu' })
  }

  const body = await req.json().catch(() => ({}))
  const { date, sport, league, event_name, bet_type, bookmaker, stake, odds, status, cash_out_amount, note } = body

  if (!date || stake == null || odds == null || !status) {
    return NextResponse.json({ error: 'Brakuje wymaganych pól' }, { status: 400 })
  }

  const stakeNum = parseFloat(stake)
  const oddsNum = parseFloat(odds)
  if (isNaN(stakeNum) || stakeNum <= 0) {
    return NextResponse.json({ error: 'Nieprawidłowa stawka' }, { status: 400 })
  }
  if (isNaN(oddsNum) || oddsNum < 1) {
    return NextResponse.json({ error: 'Nieprawidłowy kurs (min. 1.00)' }, { status: 400 })
  }

  const cashOut = cash_out_amount != null ? parseFloat(cash_out_amount) : null
  const { payout, profit } = computePayoutAndProfit(stakeNum, oddsNum, status, cashOut)

  const db = createAdminClient()
  const { data, error } = await db
    .from('betting_bets')
    .insert({
      user_id: userId,
      date,
      sport: sport ?? '',
      league: league ?? '',
      event_name: event_name ?? '',
      bet_type: bet_type ?? '',
      bookmaker: bookmaker ?? '',
      stake: stakeNum,
      odds: oddsNum,
      status,
      cash_out_amount: cashOut,
      payout,
      profit,
      note: note ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Błąd zapisu' }, { status: 500 })
  return NextResponse.json({ bet: data })
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!IS_PRODUCTION_MODE) {
    return NextResponse.json({ message: 'Tryb lokalny — brak efektu' })
  }

  const body = await req.json().catch(() => ({}))
  const { id, date, sport, league, event_name, bet_type, bookmaker, stake, odds, status, cash_out_amount, note } = body

  if (!id) return NextResponse.json({ error: 'Brakuje id' }, { status: 400 })

  const db = createAdminClient()
  const { data: existing } = await db
    .from('betting_bets')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Nie znaleziono zakładu' }, { status: 404 })

  const stakeNum = parseFloat(stake)
  const oddsNum = parseFloat(odds)
  const cashOut = cash_out_amount != null ? parseFloat(cash_out_amount) : null
  const { payout, profit } = computePayoutAndProfit(stakeNum, oddsNum, status, cashOut)

  const { data, error } = await db
    .from('betting_bets')
    .update({
      date,
      sport: sport ?? '',
      league: league ?? '',
      event_name: event_name ?? '',
      bet_type: bet_type ?? '',
      bookmaker: bookmaker ?? '',
      stake: stakeNum,
      odds: oddsNum,
      status,
      cash_out_amount: cashOut,
      payout,
      profit,
      note: note ?? null,
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Błąd aktualizacji' }, { status: 500 })
  return NextResponse.json({ bet: data })
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
    .from('betting_bets')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: 'Błąd usunięcia' }, { status: 500 })
  return NextResponse.json({ message: 'Usunięto' })
}
