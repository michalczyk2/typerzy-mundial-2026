import { NextResponse } from 'next/server'
export async function GET() {
  return NextResponse.json({
    vapid_public: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ? 'OK' : 'BRAK',
    vapid_private: process.env.VAPID_PRIVATE_KEY ? 'OK' : 'BRAK',
    vapid_email: process.env.VAPID_EMAIL ? 'OK' : 'BRAK',
    node_env: process.env.NODE_ENV,
  })
}
