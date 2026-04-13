// POST /api/checkin
// Validates a weekly QR token.
// 1回目のスキャン → attendance_logs に入室記録を作成
// 2回目のスキャン → 同日の未退室レコードを退室処理（退室時刻・滞在時間を記録）
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

    const now = new Date()
    const today = now.toISOString().split('T')[0]

    // 今日の未退室レコードを検索
    const { data: openSession } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('checked_in_at', `${today}T00:00:00+00:00`)
      .lte('checked_in_at', `${today}T23:59:59+00:00`)
      .is('checked_out_at', null)
      .order('checked_in_at', { ascending: false })
      .limit(1)
      .single()

    if (openSession) {
      // 2回目スキャン → 退室処理
      const checkinTime = new Date(openSession.checked_in_at)
      const durationMinutes = Math.round((now.getTime() - checkinTime.getTime()) / 60000)

      const { error } = await supabase
        .from('attendance_logs')
        .update({
          checked_out_at: now.toISOString(),
          duration_minutes: durationMinutes,
        })
        .eq('id', openSession.id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      return NextResponse.json({
        action: 'checkout',
        checkedInAt: openSession.checked_in_at,
        checkedOutAt: now.toISOString(),
        durationMinutes,
      })
    } else {
      // 1回目スキャン → 入室処理
      const userName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email ||
        user.id

      const { error } = await supabase
        .from('attendance_logs')
        .insert({
          user_id: user.id,
          user_email: user.email,
          user_name: userName,
          checked_in_at: now.toISOString(),
        })

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      return NextResponse.json({
        action: 'checkin',
        checkedInAt: now.toISOString(),
      })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
