// POST /api/discord/poll
// Creates an attendance poll message in a Discord channel with ✅🟡❌ reactions
import { NextResponse } from 'next/server'

const POLL_EMOJIS = ['✅', '🟡', '❌']

export async function POST(req: Request) {
  try {
    const { channelId, date, botToken, existingMessageId } = await req.json()

    if (!botToken)    return NextResponse.json({ error: 'Bot Tokenが設定されていません' }, { status: 400 })
    if (!channelId)   return NextResponse.json({ error: 'Channel IDが設定されていません' }, { status: 400 })
    if (!date)        return NextResponse.json({ error: '日付が必要です' }, { status: 400 })

    const d = new Date(date)
    const weekDay = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]
    const headers = { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' }

    const content = [
      `📅 **${date}（${weekDay}）** の参加確認`,
      '─────────────────────',
      '✅　参加可能',
      '🟡　未定',
      '❌　不参加',
      '',
      '> 上のリアクションを押して回答してください。',
      '> 変更する場合は一度外してから押し直してください。',
    ].join('\n')

    // If a message already exists for this date, edit it
    if (existingMessageId) {
      const editRes = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages/${existingMessageId}`,
        { method: 'PATCH', headers, body: JSON.stringify({ content }) }
      )
      if (!editRes.ok) {
        const err = await editRes.json().catch(() => ({}))
        // Message may have been deleted — fall through to create new
        if ((err as any).code !== 10008) {
          return NextResponse.json({ error: `Discord編集エラー: ${JSON.stringify(err)}` }, { status: editRes.status })
        }
      } else {
        return NextResponse.json({ messageId: existingMessageId, updated: true })
      }
    }

    // Create new poll message
    const postRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content }),
    })

    if (!postRes.ok) {
      const err = await postRes.json().catch(() => ({}))
      return NextResponse.json({ error: `Discordメッセージ送信失敗: ${JSON.stringify(err)}` }, { status: postRes.status })
    }

    const msg = await postRes.json()
    const messageId: string = msg.id

    // Add reactions one by one (rate limit: 1 per 0.25s)
    for (const emoji of POLL_EMOJIS) {
      const reactionRes = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`,
        { method: 'PUT', headers: { Authorization: `Bot ${botToken}` } }
      )
      if (!reactionRes.ok && reactionRes.status !== 204) {
        console.warn(`Failed to add reaction ${emoji}:`, reactionRes.status)
      }
      // Discord rate limit: max 1 reaction/250ms
      await new Promise(r => setTimeout(r, 300))
    }

    return NextResponse.json({ messageId, success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
