// GET /api/checkin/qr
// Returns weekly QR code data URL. Auth required.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWeeklyToken, getWeekLabel, getWeekExpiry } from '@/lib/checkin'
import QRCode from 'qrcode'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const token = getWeeklyToken()
  const qrContent = `AEROSYNC:${token}`
  const dataUrl = await QRCode.toDataURL(qrContent, {
    width: 480,
    margin: 2,
    color: { dark: '#1e293b', light: '#ffffff' },
  })

  const expiry = getWeekExpiry()

  return NextResponse.json({
    dataUrl,
    token,
    weekLabel: getWeekLabel(),
    validUntil: expiry.toISOString().split('T')[0],
  })
}
