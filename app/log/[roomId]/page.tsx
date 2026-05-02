'use client';

import { useEffect, useState, useCallback } from 'react';

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
type SessionType = 'checkin' | 'checkout';
type Lang = 'ja' | 'en';

// ──────────────────────────────────────────────
// 翻訳
// ──────────────────────────────────────────────
const T = {
  ja: {
    title: '作業レポート',
    subtitle: (room: string) => `📍 ${room}`,
    who: 'あなたは？',
    selectPlaceholder: '-- 選択してください --',
    dateLabel: '日付',
    sessionLabel: 'セッションタイプ',
    checkin: '🟢 入室',
    checkout: '🔴 退室・進捗報告',
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
    successCheckin: '入室を記録しました！',
    successCheckout: '退室・進捗を送信しました！',
    successMsg: (name: string) => `${name} さん、お疲れ様でした！`,
    successCheckinMsg: (name: string) => `${name} さん、作業頑張ってください！`,
    back: '← 戻る',
    required: '作業内容を入力してください',
    noRoom: '部屋が見つかりませんでした',
    loading: '読み込み中...',
    noTasks: '指定日にタスクはありません',
    openJoin: '誰でも参加可能',
    checkinNote: '入室を記録します。退室時は「退室・進捗報告」を選んで再度スキャンしてください。',
  },
  en: {
    title: 'Work Report',
    subtitle: (room: string) => `📍 ${room}`,
    who: 'Who are you?',
    selectPlaceholder: '-- Select --',
    dateLabel: 'Date',
    sessionLabel: 'Session Type',
    checkin: '🟢 Check In',
    checkout: '🔴 Check Out & Progress',
    todayTasks: "Tasks",
    taskIncomplete: 'Reason / fix needed...',
    workSummary: "Work summary *",
    workPlaceholder: 'What did you work on?',
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
    successCheckin: 'Check-in recorded!',
    successCheckout: 'Check-out & progress submitted!',
    successMsg: (name: string) => `Nice work, ${name}!`,
    successCheckinMsg: (name: string) => `Good luck today, ${name}!`,
    back: '← Back',
    required: 'Please enter your work summary',
    noRoom: 'Room not found',
    loading: 'Loading...',
    noTasks: 'No tasks on this date',
    openJoin: 'Open to all',
    checkinNote: 'This records your check-in. When leaving, select "Check Out & Progress" and scan again.',
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
  const [roomId, setRoomId] = useState<string>('');
  const [lang, setLang] = useState<Lang>('ja');
  const t = T[lang];

  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [sessionType, setSessionType] = useState<SessionType>('checkout');

  // 日付（デフォルト: 今日、変更可能）
  const todayStr = new Date().toLocaleDateString('sv-SE');
  const [date, setDate] = useState(todayStr);

  const [workSummary, setWorkSummary] = useState('');
  const [overallCompleted, setOverallCompleted] = useState(true);
  const [issueNotes, setIssueNotes] = useState('');
  const [discordAvailable, setDiscordAvailable] = useState<DiscordStatus>('available');
  const [taskProgress, setTaskProgress] = useState<Record<string, TaskProgressState>>({});

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [roomLoading, setRoomLoading] = useState(true);
  const [error, setError] = useState('');

  // params を解決
  useEffect(() => {
    params.then((p) => setRoomId(p.roomId));
  }, [params]);

  // 部屋情報・メンバー・タスクをAPIから取得（認証不要）
  useEffect(() => {
    if (!roomId) return;
    setRoomLoading(true);
    fetch(`/api/log/${roomId}?date=${date}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.room) setRoom(data.room);
        if (data.members) setMembers(data.members);
        if (data.tasks) setTasks(data.tasks);
        setRoomLoading(false);
      })
      .catch(() => setRoomLoading(false));
  }, [roomId, date]);

  // メンバー選択時にタスク進捗初期化
  const initTaskProgress = useCallback(
    (member: Member, taskList: Task[]) => {
      const email = member.email ?? member.display_name ?? '';
      const myTasks = taskList.filter(
        (t) =>
          t.open_join ||
          (Array.isArray(t.assignees) &&
            (t.assignees.includes(email) || t.assignees.includes(member.id)))
      );
      const init: Record<string, TaskProgressState> = {};
      myTasks.forEach((t) => {
        init[t.id] = { completed: t.done ?? false, notes: '' };
      });
      setTaskProgress(init);
      return myTasks;
    },
    []
  );

  useEffect(() => {
    if (selectedMember) initTaskProgress(selectedMember, tasks);
    else setTaskProgress({});
  }, [selectedMember, tasks]);

  // フォーム送信
  const handleSubmit = async () => {
    if (sessionType === 'checkout' && !workSummary.trim()) {
      setError(t.required);
      return;
    }
    setError('');
    setLoading(true);

    const email = selectedMember?.email ?? selectedMember?.display_name ?? '';

    const res = await fetch(`/api/log/${roomId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId: selectedMember!.id,
        memberEmail: email,
        date,
        sessionType,
        workSummary: sessionType === 'checkout' ? workSummary : undefined,
        overallCompleted: sessionType === 'checkout' ? overallCompleted : undefined,
        issueNotes: sessionType === 'checkout' && !overallCompleted ? issueNotes : undefined,
        discordAvailable: sessionType === 'checkout' ? discordAvailable : undefined,
        taskProgress: sessionType === 'checkout' ? taskProgress : undefined,
      }),
    });

    setLoading(false);
    if (res.ok) {
      setSubmitted(true);
    } else {
      const data = await res.json();
      setError(data.error ?? '送信エラーが発生しました');
    }
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
    const name = selectedMember?.display_name ?? selectedMember?.email ?? '';
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-10 text-center max-w-sm w-full">
          <div className="text-7xl mb-4">{sessionType === 'checkin' ? '🟢' : '🎉'}</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {sessionType === 'checkin' ? t.successCheckin : t.successCheckout}
          </h2>
          <p className="text-gray-500 text-lg">
            {sessionType === 'checkin' ? t.successCheckinMsg(name) : t.successMsg(name)}
          </p>
          <p className="text-xs text-gray-400 mt-3">{date}</p>
          <button
            onClick={() => {
              setSubmitted(false);
              setSelectedMember(null);
              setWorkSummary('');
              setOverallCompleted(true);
              setIssueNotes('');
              setDiscordAvailable('available');
              setSessionType('checkout');
            }}
            className="mt-6 text-blue-500 underline text-sm"
          >
            {t.back}
          </button>
        </div>
      </div>
    );
  }

  // メンバーに対応するタスクを絞り込む
  const myTasks = selectedMember
    ? tasks.filter(
        (t) =>
          t.open_join ||
          (Array.isArray(t.assignees) &&
            (t.assignees.includes(selectedMember.email ?? '') ||
              t.assignees.includes(selectedMember.id)))
      )
    : [];

  // ──────── メインフォーム ────────
  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 pt-8 pb-6">
        <div className="max-w-md mx-auto flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">📋 {t.title}</h1>
            <p className="text-blue-200 mt-1 text-sm">{t.subtitle(room.name)}</p>
          </div>
          <button
            onClick={() => setLang((l) => (l === 'ja' ? 'en' : 'ja'))}
            className="bg-white/20 hover:bg-white/30 rounded-xl px-3 py-1.5 text-sm font-medium transition"
          >
            {lang === 'ja' ? 'EN' : 'JP'}
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 mt-5 space-y-4">

        {/* 日付選択 */}
        <Card>
          <Label>{t.dateLabel}</Label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-gray-200 rounded-xl p-3 text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </Card>

        {/* セッションタイプ */}
        <Card>
          <Label>{t.sessionLabel}</Label>
          <div className="flex gap-3">
            <ToggleBtn
              active={sessionType === 'checkin'}
              onClick={() => setSessionType('checkin')}
              activeClass="bg-green-500 text-white"
            >
              {t.checkin}
            </ToggleBtn>
            <ToggleBtn
              active={sessionType === 'checkout'}
              onClick={() => setSessionType('checkout')}
              activeClass="bg-red-500 text-white"
            >
              {t.checkout}
            </ToggleBtn>
          </div>
          {sessionType === 'checkin' && (
            <p className="text-xs text-gray-500 mt-2">{t.checkinNote}</p>
          )}
        </Card>

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

        {/* 退室時の詳細フォーム */}
        {selectedMember && sessionType === 'checkout' && (
          <>
            {/* タスク進捗 */}
            {myTasks.length > 0 && (
              <Card>
                <Label>{t.todayTasks}</Label>
                <div className="space-y-3">
                  {myTasks.map((task) => {
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
              </Card>
            )}

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
          </>
        )}

        {/* 送信ボタン */}
        {selectedMember && (
          <button
            onClick={handleSubmit}
            disabled={loading || (sessionType === 'checkout' && !workSummary.trim())}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white py-4 rounded-2xl font-bold text-lg shadow-lg transition active:scale-95"
          >
            {loading ? t.submitting : t.submit}
          </button>
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
