import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const sessionId = req.cookies.get('typerzy_session')?.value
  if (!sessionId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const { match_id, predicted_a, predicted_b, predicted_result: rawResult, predicted_winner } = await req.json()
    if (!match_id || predicted_a == null || predicted_b == null) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const VALID_RESULTS = ['home', 'draw', 'away', 'home_or_draw', 'away_or_draw'] as const
    type ValidResult = (typeof VALID_RESULTS)[number]
    const predicted_result: ValidResult = VALID_RESULTS.includes(rawResult as ValidResult)
      ? (rawResult as ValidResult)
      : predicted_a > predicted_b ? 'home' : predicted_a < predicted_b ? 'away' : 'draw'

    // The typed score must fall within the selected double-chance range — otherwise
    // predicted_result and predicted_a/predicted_b contradict each other.
    const scoreSide = predicted_a > predicted_b ? 'home' : predicted_a < predicted_b ? 'away' : 'draw'
    if (predicted_result === 'home_or_draw' && scoreSide === 'away') {
      return NextResponse.json({ error: 'Wynik nie zgadza się z wybranym typem (drużyna gospodarzy lub remis)' }, { status: 400 })
    }
    if (predicted_result === 'away_or_draw' && scoreSide === 'home') {
      return NextResponse.json({ error: 'Wynik nie zgadza się z wybranym typem (drużyna gości lub remis)' }, { status: 400 })
    }

    const db = createAdminClient()

    // Verify user is active
    const { data: profile } = await db.from('profiles').select('id, status').eq('id', sessionId).single()
    if (!profile || profile.status !== 'active') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Check match hasn't started
    const { data: match } = await db.from('matches').select('match_date, status').eq('id', match_id).single()
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    if (match.status !== 'scheduled' || new Date(match.match_date) <= new Date()) {
      return NextResponse.json({ error: 'Prediction locked' }, { status: 409 })
    }

    const { data, error } = await db
      .from('predictions')
      .upsert(
        {
          user_id: sessionId,
          match_id,
          predicted_a,
          predicted_b,
          predicted_result,
          predicted_winner: predicted_winner ?? null,
          is_locked: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,match_id' }
      )
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, id: data.id })
  } catch (err) {
    console.error('[predictions POST]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
