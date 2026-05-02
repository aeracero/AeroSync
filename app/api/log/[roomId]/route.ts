// GET /api/log/[roomId]?date=YYYY-MM-DD
// 認証不要: 部屋情報・メンバー・タスクを返す（一般メンバーのQRスキャン用）
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') ?? new Date().toLocaleDateString('sv-SE')

  const supabase = createServiceClient()

  const [roomRes, membersRes, tasksRes] = await Promise.all([
    supabase.from('work_rooms').select('id, name, description').eq('id', roomId).single(),
    supabase.from('members').select('id, display_name, email').order('display_name'),
    supabase.from('tasks').select('id, title, assignees, open_join, done').eq('date', date),
  ])

  if (!roomRes.data) {
    return NextResponse.json({ error: '部屋が見つかりません' }, { status: 404 })
  }

  return NextResponse.json({
    room: roomRes.data,
    members: membersRes.data ?? [],
    tasks: tasksRes.data ?? [],
  })
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  const body = await req.json()
  const {
    memberId,
    memberEmail,
    date,
    sessionType,   // 'checkin' | 'checkout'
    workSummary,
    overallCompleted,
    issueNotes,
    discordAvailable,
    taskProgress,  // Record<taskId, { completed: boolean; notes: string }>
  } = body

  if (!memberId || !date) {
    return NextResponse.json({ error: 'memberId と date が必要です' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // 1. 作業ログを保存（退室時のみ作業内容あり）
  if (sessionType === 'checkout' && workSummary?.trim()) {
    const { error: logErr } = await supabase.from('work_logs').insert({
      member_id: memberId,
      room_id: roomId,
      date,
      work_summary: workSummary,
      completed: overallCompleted ?? true,
      issue_notes: overallCompleted ? null : issueNotes || null,
      discord_available: discordAvailable ?? 'available',
      session_type: sessionType,
    })
    if (logErr) return NextResponse.json({ error: logErr.message }, { status: 500 })
  }

  // 入室時も最小ログを残す
  if (sessionType === 'checkin') {
    await supabase.from('work_logs').insert({
      member_id: memberId,
      room_id: roomId,
      date,
      work_summary: '入室',
      completed: false,
      session_type: sessionType,
    })
  }

  // 2. タスク進捗を保存（退室時のみ）
  if (sessionType === 'checkout' && taskProgress) {
    for (const [taskId, prog] of Object.entries(taskProgress as Record<string, { completed: boolean; notes: string }>)) {
      await supabase.from('task_progress').upsert(
        {
          task_id: taskId,
          member_email: memberEmail,
          completed: prog.completed,
          work_notes: prog.notes || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'task_id,member_email' }
      )
    }
  }

  // 3. Discord 参加可否を保存（退室時のみ）
  if (sessionType === 'checkout' && discordAvailable) {
    await supabase.from('availability').upsert(
      {
        user_id: memberId,
        user_email: memberEmail,
        date,
        status: discordAvailable,
        note: 'QRコード経由',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,date' }
    )
  }

  return NextResponse.json({ ok: true, sessionType })
}
