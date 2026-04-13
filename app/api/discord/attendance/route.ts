// POST /api/discord/attendance
// Sends today's attendance_logs to a Discord channel as an embed.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const { botToken, channelId, date } = await req.json()
    if (!botToken || !channelId) {
      return NextResponse.json({ error: 'botToken と channelId が必要です' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const target = date ?? new Date().toISOString().split('T')[0]

    const { data: logs, error } = await supabase
      .from('attendance_logs')
      .select('*')
      .gte('checked_in_at', `${target}T00:00:00+00:00`)
      .lte('checked_in_at', `${target}T23:59:59+00:00`)
      .order('checked_in_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!logs || logs.length === 0) {
      return NextResponse.json({ error: 'この日の出席記録がありません' }, { status: 404 })
    }

    const fmt = (ts: string) => {
      const d = new Date(ts)
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    }
    const dur = (min: number) =>
      min >= 60 ? `${Math.floor(min / 60)}h${min % 60}m` : `${min}m`

    const checkedOut = logs.filter((l: any) => l.checked_out_at)
    const stillIn = logs.filter((l: any) => !l.checked_out_at)

    let description = ''
    if (checkedOut.length > 0) {
      description += '**✅ 退室済み**\n'
      description += checkedOut.map((l: any) => {
        const name = l.user_name || l.user_email || l.user_id
        const d = dur(l.duration_minutes ?? 0)
        return `> **${name}**　${fmt(l.checked_in_at)} → ${fmt(l.checked_out_at!)}　(${d})`
      }).join('\n')
      description += '\n\n'
    }
    if (stillIn.length > 0) {
      description += '**🟢 入室中**\n'
      description += stillIn.map((l: any) => {
        const name = l.user_name || l.user_email || l.user_id
        return `> **${name}**　${fmt(l.checked_in_at)} 〜`
      }).join('\n')
    }

    const embed = {
      title: `📋 出席確認ログ — ${target}`,
      description,
      color: 0x3b82f6,
      footer: { text: `AeroSync · 合計 ${logs.length} 名` },
      timestamp: new Date().toISOString(),
    }

    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ embeds: [embed] }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json({ error: `Discord APIエラー: ${(err as any).message ?? res.status}` }, { status: 502 })
    }

    return NextResponse.json({ success: true, count: logs.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
