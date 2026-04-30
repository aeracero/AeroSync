'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ──────────────────────────────────────────────
// 型定義
// ──────────────────────────────────────────────
interface Room {
  id: string;
  name: string;
  description: string | null;
}

interface Member {
  id: string;
  display_name: string | null;
  email: string | null;
}

interface Task {
  id: string;
  title: string;
  assignees: string[];
  open_join: boolean;
  done: boolean;
}

interface TaskProgressState {
  completed: boolean;
  notes: string;
}

type DiscordStatus = 'available' | 'unavailable' | 'maybe';
type Lang = 'ja' | 'en';

// ──────────────────────────────────────────────
// 翻訳
// ──────────────────────────────────────────────
const T = {
  ja: {
    title: '作業レポート',
    subtitle: (room: string, date: string) => `📍 ${room} · ${date}`,
    who: 'あなたは？',
    selectPlaceholder: '-- 選択してください --',
    todayTasks: '今日のタスク',
    taskIncomplete: '未完了の理由・修正点...',
    workSummary: '今日の作業内容 *',
    workPlaceholder: '今日何をしましたか？',
    completed: '完了しましたか？',
    yes: '✅ 完了',
    no: '⚠️ 未完了',
    issueNotesPlaceholder: '未完了の理由・次回の修正点は？',
    discord: 'Discordのミーティングに参加できますか？',
    avail: '参加できる',
    maybe: '未定',
    unavail: '参加できない',
    submit: '📤 送信する',
    submitting: '送信中...',
    successTitle: '送信完了！',
    successMsg: (name: string) => `${name} さん、お疲れ様でした！`,
    back: '← 戻る',
    required: '作業内容を入力してください',
    noRoom: '部屋が見つかりませんでした',
    loading: '読み込み中...',
    noTasks: '今日あなたに割り当てられたタスクはありません',
    openJoin: '誰でも参加可能',
  },
  en: {
    title: 'Work Report',
    subtitle: (room: string, date: string) => `📍 ${room} · ${date}`,
    who: 'Who are you?',
    selectPlaceholder: '-- Select --',
    todayTasks: "Today's Tasks",
    taskIncomplete: 'Reason / fix needed...',
    workSummary: "Today's work summary *",
    workPlaceholder: 'What did you work on today?',
    completed: 'Did you complete your work?',
    yes: '✅ Done',
    no: '⚠️ Not done',
    issueNotesPlaceholder: 'Reason / what corrections are needed next time?',
    discord: 'Can you join the Discord meeting?',
    avail: 'Available',
    maybe: 'Maybe',
    unavail: 'Unavailable',
    submit: '📤 Submit',
    submitting: 'Submitting...',
    successTitle: 'Submitted!',
    successMsg: (name: string) => `Nice work, ${name}!`,
    back: '← Back',
    required: 'Please enter your work summary',
    noRoom: 'Room not found',
    loading: 'Loading...',
    noTasks: 'No tasks assigned to you today',
    openJoin: 'Open to all',
  },
};

// ──────────────────────────────────────────────
// メインコンポーネント
// ──────────────────────────────────────────────
export default function WorkLogPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const supabase = createClient();

  const [roomId, setRoomId] = useState<string>('');
  const [lang, setLang] = useState<Lang>('ja');
  const t = T[lang];

  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const [workSummary, setWorkSummary] = useState('');
  const [overallCompleted, setOverallCompleted] = useState(true);
  const [issueNotes, setIssueNotes] = useState('');
  const [discordAvailable, setDiscordAvailable] = useState<DiscordStatus>('available');
  const [taskProgress, setTaskProgress] = useState<Record<string, TaskProgressState>>({});

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [roomLoading, setRoomLoading] = useState(true);
  const [error, setError] = useState('');

  const today = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD

  // params を解決 (Next.js 15 の async params)
  useEffect(() => {
    params.then((p) => setRoomId(p.roomId));
  }, [params]);

  // 部屋情報・メンバー読み込み
  useEffect(() => {
    if (!roomId) return;
    setRoomLoading(true);
    Promise.all([
      supabase.from('work_rooms').select('*').eq('id', roomId).single(),
      supabase.from('members').select('id, display_name, email').order('display_name'),
    ]).then(([roomRes, membersRes]) => {
      if (roomRes.data) setRoom(roomRes.data);
      if (membersRes.data) setMembers(membersRes.data);
      setRoomLoading(false);
    });
  }, [roomId]);

  // メンバー選択時にそのメンバーのタスクを読み込む
  const loadTasks = useCallback(
    async (member: Member) => {
      const memberEmail = member.email ?? member.display_name ?? '';
      const { data } = await supabase
        .from('tasks')
        .select('id, title, assignees, open_join, done')
        .eq('date', today);

      if (!data) return;
      const myTasks = data.filter(
        (t) =>
          t.open_join ||
          (Array.isArray(t.assignees) &&
            (t.assignees.includes(memberEmail) ||
              t.assignees.includes(member.id)))
      );
      setTasks(myTasks);

      // 既存の task_progress を読み込んで初期値を設定
      const { data: existing } = await supabase
        .from('task_progress')
        .select('task_id, completed, work_notes')
        .eq('member_email', memberEmail)
        .in(
          'task_id',
          myTasks.map((t) => t.id)
        );

      const init: Record<string, TaskProgressState> = {};
      myTasks.forEach((t) => {
        const prev = existing?.find((e) => e.task_id === t.id);
        init[t.id] = {
          completed: prev?.completed ?? t.done ?? false,
          notes: prev?.work_notes ?? '',
        };
      });
      setTaskProgress(init);
    },
    [today]
  );

  useEffect(() => {
    if (selectedMember) loadTasks(selectedMember);
    else { setTasks([]); setTaskProgress({}); }
  }, [selectedMember]);

  // フォーム送信
  const handleSubmit = async () => {
    if (!selectedMember || !workSummary.trim()) {
      setError(t.required);
      return;
    }
    setError('');
    setLoading(true);

    const memberEmail = selectedMember.email ?? selectedMember.display_name ?? '';

    // 1. 作業ログを保存
    await supabase.from('work_logs').insert({
      member_id: selectedMember.id,
      room_id: roomId,
      date: today,
      work_summary: workSummary,
      completed: overallCompleted,
      issue_notes: overallCompleted ? null : issueNotes || null,
      discord_available: discordAvailable,
    });

    // 2. タスク個人別進捗を保存
    for (const [taskId, progress] of Object.entries(taskProgress)) {
      await supabase.from('task_progress').upsert(
        {
          task_id: taskId,
          member_email: memberEmail,
          completed: progress.completed,
          work_notes: progress.notes || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'task_id,member_email' }
      );
    }

    // 3. Discord 参加可否を availability テーブルに保存
    await supabase.from('availability').upsert(
      {
        user_id: selectedMember.id,
        user_email: memberEmail,
        date: today,
        status: discordAvailable,
        note: 'QRコード経由',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,date' }
    );

    setLoading(false);
    setSubmitted(true);
  };

  // ──────── ローディング ────────
  if (roomLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-lg">{t.loading}</p>
      </div>
    );
  }

  // ──────── 部屋が見つからない ────────
  if (!room) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow p-8 text-center">
          <p className="text-4xl mb-3">🚫</p>
          <p className="text-gray-600">{t.noRoom}</p>
        </div>
      </div>
    );
  }

  // ──────── 送信完了 ────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-10 text-center max-w-sm w-full">
          <div className="text-7xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">{t.successTitle}</h2>
          <p className="text-gray-500 text-lg">
            {t.successMsg(selectedMember?.display_name ?? selectedMember?.email ?? '')}
          </p>
          <button
            onClick={() => {
              setSubmitted(false);
              setSelectedMember(null);
              setWorkSummary('');
              setOverallCompleted(true);
              setIssueNotes('');
              setDiscordAvailable('available');
            }}
            className="mt-6 text-blue-500 underline text-sm"
          >
            {t.back}
          </button>
        </div>
      </div>
    );
  }

  // ──────── メインフォーム ────────
  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 pt-8 pb-6">
        <div className="max-w-md mx-auto flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">📋 {t.title}</h1>
            <p className="text-blue-200 mt-1 text-sm">{t.subtitle(room.name, today)}</p>
          </div>
          {/* 言語切替 */}
          <button
            onClick={() => setLang((l) => (l === 'ja' ? 'en' : 'ja'))}
            className="bg-white/20 hover:bg-white/30 rounded-xl px-3 py-1.5 text-sm font-medium transition"
          >
            {lang === 'ja' ? 'EN' : 'JP'}
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 mt-5 space-y-4">
        {/* メンバー選択 */}
        <Card>
          <Label>{t.who}</Label>
          <select
            className="w-full border border-gray-200 rounded-xl p-3 text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={selectedMember?.id ?? ''}
            onChange={(e) => {
              const m = members.find((m) => m.id === e.target.value) ?? null;
              setSelectedMember(m);
            }}
          >
            <option value="">{t.selectPlaceholder}</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name ?? m.email}
              </option>
            ))}
          </select>
        </Card>

        {selectedMember && (
          <>
            {/* 今日のタスク */}
            <Card>
              <Label>{t.todayTasks}</Label>
              {tasks.length === 0 ? (
                <p className="text-gray-400 text-sm py-2">{t.noTasks}</p>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => {
                    const prog = taskProgress[task.id] ?? { completed: false, notes: '' };
                    return (
                      <div key={task.id} className="border border-gray-100 rounded-xl p-3">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-0.5 w-5 h-5 rounded accent-blue-600 cursor-pointer"
                            checked={prog.completed}
                            onChange={(e) =>
                              setTaskProgress((prev) => ({
                                ...prev,
                                [task.id]: { ...prev[task.id], completed: e.target.checked },
                              }))
                            }
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-800 text-sm">{task.title}</p>
                            {task.open_join && (
                              <span className="text-xs text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                                {t.openJoin}
                              </span>
                            )}
                            {!prog.completed && (
                              <textarea
                                placeholder={t.taskIncomplete}
                                className="w-full mt-2 border border-gray-200 rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-orange-400"
                                rows={2}
                                value={prog.notes}
                                onChange={(e) =>
                                  setTaskProgress((prev) => ({
                                    ...prev,
                                    [task.id]: { ...prev[task.id], notes: e.target.value },
                                  }))
                                }
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* 作業内容 */}
            <Card>
              <Label>{t.workSummary}</Label>
              <textarea
                className="w-full border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                rows={4}
                placeholder={t.workPlaceholder}
                value={workSummary}
                onChange={(e) => setWorkSummary(e.target.value)}
              />
              {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
            </Card>

            {/* 完了 / 未完了 */}
            <Card>
              <Label>{t.completed}</Label>
              <div className="flex gap-3">
                <ToggleBtn
                  active={overallCompleted}
                  onClick={() => setOverallCompleted(true)}
                  activeClass="bg-green-500 text-white"
                >
                  {t.yes}
                </ToggleBtn>
                <ToggleBtn
                  active={!overallCompleted}
                  onClick={() => setOverallCompleted(false)}
                  activeClass="bg-orange-500 text-white"
                >
                  {t.no}
                </ToggleBtn>
              </div>
              {!overallCompleted && (
                <textarea
                  className="w-full mt-3 border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
                  rows={3}
                  placeholder={t.issueNotesPlaceholder}
                  value={issueNotes}
                  onChange={(e) => setIssueNotes(e.target.value)}
                />
              )}
            </Card>

            {/* Discord 参加可否 */}
            <Card>
              <Label>{t.discord}</Label>
              <div className="flex gap-2">
                {(
                  [
                    { value: 'available' as DiscordStatus, label: t.avail, emoji: '✅', activeClass: 'bg-green-500 text-white' },
                    { value: 'maybe' as DiscordStatus, label: t.maybe, emoji: '🤔', activeClass: 'bg-yellow-500 text-white' },
                    { value: 'unavailable' as DiscordStatus, label: t.unavail, emoji: '❌', activeClass: 'bg-red-500 text-white' },
                  ] as const
                ).map((opt) => (
                  <ToggleBtn
                    key={opt.value}
                    active={discordAvailable === opt.value}
                    onClick={() => setDiscordAvailable(opt.value)}
                    activeClass={opt.activeClass}
                    className="flex-1 flex-col py-3 text-sm"
                  >
                    <span className="text-xl">{opt.emoji}</span>
                    <span>{opt.label}</span>
                  </ToggleBtn>
                ))}
              </div>
            </Card>

            {/* 送信ボタン */}
            <button
              onClick={handleSubmit}
              disabled={loading || !workSummary.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white py-4 rounded-2xl font-bold text-lg shadow-lg transition active:scale-95"
            >
              {loading ? t.submitting : t.submit}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// 小コンポーネント
// ──────────────────────────────────────────────
function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">{children}</div>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="font-semibold text-gray-700 mb-3 text-sm">{children}</p>;
}

function ToggleBtn({
  children,
  active,
  onClick,
  activeClass,
  className = '',
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  activeClass: string;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1 py-3 rounded-xl font-medium transition text-sm
        ${active ? activeClass : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} ${className}`}
    >
      {children}
    </button>
  );
}
