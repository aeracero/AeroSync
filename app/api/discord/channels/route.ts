// GET /api/discord/channels?guildId=...
// Botトークンでギルドの全チャンネルを取得する
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const guildId = searchParams.get('guildId')
  const botToken = req.headers.get('x-bot-token')

  if (!botToken) return NextResponse.json({ error: 'Bot Tokenが必要です' }, { status: 400 })
  if (!guildId) return NextResponse.json({ error: 'guildIdが必要です' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
    headers: { Authorization: `Bot ${botToken}` },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return NextResponse.json(
      { error: `Discord APIエラー: ${(err as any).message ?? res.status}` },
      { status: 502 }
    )
  }

  const channels = await res.json()
  // type 0 = テキストチャンネル, type 4 = カテゴリ, type 5 = アナウンス, type 15 = フォーラム
  return NextResponse.json({ channels })
}
