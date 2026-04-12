// POST /api/checkin
// Validates a weekly QR token and marks the current user as "available" today.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidToken } from '@/lib/checkin'

export async function POST(req: Request) {
  try {
    const { token } = await req.json()
    if (!token) return NextResponse.json({ error: 'トークンが必要です' }, { status: 400 })

    if (!isValidToken(token)) {
      return NextResponse.json({ error: 'QRコードが無効または期限切れです' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const today = new Date().toISOString().split('T')[0]

    const { error } = await supabase.from('availability').upsert(
      {
        user_id: user.id,
        user_email: user.email,
        date: today,
        status: 'available',
        note: 'QRコード経由',
      },
      { onConflict: 'user_id,date' }
    )

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, date: today })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
