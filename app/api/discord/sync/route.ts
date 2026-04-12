// POST /api/discord/sync
// Reads ✅🟡❌ reactions from a Discord poll message and upserts into Supabase availability
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const EMOJI_STATUS: Record<string, 'available' | 'maybe' | 'unavailable'> = {
  '✅': 'available',
  '🟡': 'maybe',
  '❌': 'unavailable',
}

export async function POST(req: Request) {
  try {
    const { channelId, messageId, date, botToken } = await req.json()

    if (!botToken)   return NextResponse.json({ error: 'Bot Tokenが設定されていません' }, { status: 400 })
    if (!channelId)  return NextResponse.json({ error: 'Channel IDが必要です' }, { status: 400 })
    if (!messageId)  return NextResponse.json({ error: 'Message IDが必要です — 先に投票を送信してください' }, { status: 400 })
    if (!date)       return NextResponse.json({ error: '日付が必要です' }, { status: 400 })

    const supabase = await createClient()
    const authHeader = { Authorization: `Bot ${botToken}` }

    // Fetch all members who have a discord_id linked
    const { data: members, error: membersErr } = await supabase
      .from('members')
      .select('id, email, display_name, discord_id')
      .not('discord_id', 'is', null)

    if (membersErr || !members) {
      return NextResponse.json({ error: 'メンバー取得失敗' }, { status: 500 })
    }

    // Build lookup: Discord user ID → member record
    const byDiscordId: Record<string, typeof members[0]> = {}
    for (const m of members) {
      if (m.discord_id) byDiscordId[m.discord_id] = m
    }

    // For each emoji, fetch the list of users who reacted
    const results: { name: string; status: string; discordId: string }[] = []
    // Track which member got which status (last emoji wins if a member reacted multiple)
    const memberStatus: Record<string, { status: 'available' | 'maybe' | 'unavailable'; member: typeof members[0] }> = {}

    for (const [emoji, status] of Object.entries(EMOJI_STATUS)) {
      const res = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}?limit=100`,
        { headers: authHeader }
      )

      if (!res.ok) {
        console.warn(`Failed to fetch reactions for ${emoji}:`, res.status)
        continue
      }

      const reactors: { id: string; username: string; bot?: boolean }[] = await res.json()

      for (const reactor of reactors) {
        if (reactor.bot) continue // skip bot itself
        const member = byDiscordId[reactor.id]
        if (!member) continue // not an AeroSync member
        // Use the last (lowest priority) status — but since we iterate available→maybe→unavailable,
        // if a member reacted to multiple emojis the LAST one in our loop wins.
        // In practice Discord prevents reacting twice to the same message but multiple emoji is possible.
        memberStatus[member.id] = { status, member }
      }
    }

    // Upsert availability for each synced member
    const synced: string[] = []
    for (const { status, member } of Object.values(memberStatus)) {
      const { error } = await supabase.from('availability').upsert(
        {
          user_id: member.id,
          user_email: member.email,
          date,
          status,
          note: 'Discord経由',
        },
        { onConflict: 'user_id,date' }
      )
      if (!error) {
        synced.push(member.display_name)
        results.push({ name: member.display_name, status, discordId: member.discord_id! })
      } else {
        console.warn('upsert error for', member.display_name, error.message)
      }
    }

    return NextResponse.json({ synced, results, count: synced.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
