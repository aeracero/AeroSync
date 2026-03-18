// app/api/notify/route.ts
// Sends Discord DM or mention notification via Discord Bot API
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const { type, targetUserId, targetDiscordId, message, channelId } = await req.json()
    const botToken = process.env.DISCORD_BOT_TOKEN

    // Save notification to Supabase regardless of Discord
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Insert notification record
    await supabase.from('notifications').insert({
      user_id: targetUserId,
      type,
      title: message.title,
      body: message.body,
      data: message.data ?? {},
    })

    // Send Discord DM if bot token and discord ID exist
    if (botToken && targetDiscordId) {
      // 1. Open DM channel
      const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
        method: 'POST',
        headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: targetDiscordId }),
      })
      if (dmRes.ok) {
        const dm = await dmRes.json()
        // 2. Send message to DM channel
        await fetch(`https://discord.com/api/v10/channels/${dm.id}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `**${message.title}**\n${message.body}`,
            embeds: [{
              color: 0x3b82f6,
              title: message.title,
              description: message.body,
              footer: { text: 'AeroSync' },
              timestamp: new Date().toISOString(),
            }]
          }),
        })
      }
    }

    // Send to Discord channel (for group mentions) if channelId provided
    if (botToken && channelId && type === 'mention') {
      await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: targetDiscordId ? `<@${targetDiscordId}> ${message.body}` : message.body,
        }),
      })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
