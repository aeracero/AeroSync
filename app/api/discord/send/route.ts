// POST /api/discord/send
// AeroSync から Discord チャンネルにメッセージを送信する
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const { channelId, content, userName } = await req.json()
    const botToken = req.headers.get('x-bot-token')

    if (!botToken) return NextResponse.json({ error: 'Bot Tokenが必要です' }, { status: 400 })
    if (!channelId || !content) return NextResponse.json({ error: 'channelId と content が必要です' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    // AeroSync ユーザー名を先頭に付けて Discord に投稿
    const body = userName
      ? { content: `**[AeroSync] ${userName}:** ${content}` }
      : { content }

    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json(
        { error: `Discord APIエラー: ${(err as any).message ?? res.status}` },
        { status: 502 }
      )
    }

    const message = await res.json()
    return NextResponse.json({ success: true, messageId: message.id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
