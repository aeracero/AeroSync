// GET /api/discord/messages?channelId=...&after=...&limit=50
// 指定チャンネルのメッセージを取得（ポーリング用）
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const channelId = searchParams.get('channelId')
  const after = searchParams.get('after') ?? ''
  const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '50', 10))
  const botToken = req.headers.get('x-bot-token')

  if (!botToken) return NextResponse.json({ error: 'Bot Tokenが必要です' }, { status: 400 })
  if (!channelId) return NextResponse.json({ error: 'channelIdが必要です' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  let url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=${limit}`
  if (after) url += `&after=${after}`

  const res = await fetch(url, {
    headers: { Authorization: `Bot ${botToken}` },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return NextResponse.json(
      { error: `Discord APIエラー: ${(err as any).message ?? res.status}` },
      { status: 502 }
    )
  }

  const messages = await res.json()
  // Discord は新しい順で返すので、古い順に並び替え
  const sorted = Array.isArray(messages) ? [...messages].reverse() : []
  return NextResponse.json({ messages: sorted })
}
