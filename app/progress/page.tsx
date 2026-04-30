'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

// ──────────────────────────────────────────────
// 型定義
// ──────────────────────────────────────────────
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
  priority: string | null;
}

interface TaskProgress {
  task_id: string;
  member_email: string;
  completed: boolean;
  work_notes: string | null;
}

interface WorkLog {
  id: string;
  member_id: string;
  work_summary: string;
  completed: boolean;
  issue_notes: string | null;
  discord_available: string;
  created_at: string;
}

interface Availability {
  user_id: string;
  user_email: string | null;
  status: string;
}

type Lang = 'ja' | 'en';

const T = {
  ja: {
    title: '進捗ダッシュボード',
    subtitle: (date: string) => `📅 ${date} の作業状況`,
    overall: '全体進捗',
    byMember: 'メンバー別進捗',
    discord: 'Discord 参加状況',
    workLogs: '今日の作業ログ',
    tasks: '担当タスク',
    completed: '完了',
    incomplete: '未完了',
    noLogs: '作業ログがまだありません',
    noTasks: 'タスクなし',
    loading: '読み込み中...',
    avail: '参加できる',
    maybe: '未定',
    unavail: '参加できない',
    issues: '修正点',
    totalTasks: 'タスク',
    completedTasks: '完了済み',
    taskProgress: 'タスク進捗',
    refresh: '🔄 更新',
    openJoin: '（全員）',
    noMembers: 'メンバーデータがありません',
    percent: (n: number) => `${n}%`,
  },
  en: {
    title: 'Progress Dashboard',
    subtitle: (date: string) => `📅 ${date} Work Status`,
    overall: 'Overall Progress',
    byMember: 'Progress by Member',
    discord: 'Discord Availability',
    workLogs: "Today's Work Logs",
    tasks: 'Assigned Tasks',
    completed: 'Done',
    incomplete: 'Not done',
    noLogs: 'No work logs yet',
    noTasks: 'No tasks',
    loading: 'Loading...',
    avail: 'Available',
    maybe: 'Maybe',
    unavail: 'Unavailable',
    issues: 'Issues / Fixes needed',
    totalTasks: 'tasks',
    completedTasks: 'completed',
    taskProgress: 'Task Progress',
    refresh: '🔄 Refresh',
    openJoin: '(open)',
    noMembers: 'No member data',
    percent: (n: number) => `${n}%`,
  },
};

const PRIORITY_COLOR: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};

const DISCORD_META = {
  available: { emoji: '✅', color: 'text-green-600', bg: 'bg-green-100' },
  maybe: { emoji: '🤔', color: 'text-yellow-600', bg: 'bg-yellow-100' },
  unavailable: { emoji: '❌', color: 'text-red-600', bg: 'bg-red-100' },
  unknown: { emoji: '❓', color: 'text-gray-400', bg: 'bg-gray-100' },
};

// ──────────────────────────────────────────────
// メインコンポーネント
// ──────────────────────────────────────────────
export default function ProgressPage() {
  const supabase = createClient();
  const [lang, setLang] = useState<Lang>('ja');
  const t = T[lang];

  const today = new Date().toLocaleDateString('sv-SE');

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskProgress, setTaskProgress] = useState<TaskProgress[]>([]);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [membersRes, tasksRes, progressRes, logsRes, availRes] = await Promise.all([
      supabase.from('members').select('id, display_name, email').order('display_name'),
      supabase.from('tasks').select('id, title, assignees, open_join, done, priority').eq('date', today),
      supabase.from('task_progress').select('task_id, member_email, completed, work_notes'),
      supabase
        .from('work_logs')
        .select('id, member_id, work_summary, completed, issue_notes, discord_available, created_at')
        .eq('date', today)
        .order('created_at', { ascending: false }),
      supabase
        .from('availability')
        .select('user_id, user_email, status')
        .eq('date', today),
    ]);

    if (membersRes.data) setMembers(membersRes.data);
    if (tasksRes.data) setTasks(tasksRes.data);
    if (progressRes.data) setTaskProgress(progressRes.data);
    if (logsRes.data) setWorkLogs(logsRes.data);
    if (availRes.data) setAvailability(availRes.data);
    setLoading(false);
  }, [today]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ──────────────────────────────────────────────
  // 計算ロジック
  // ──────────────────────────────────────────────

  // 全タスクのうち done=true OR task_progress で 1件でも completed=true があるもの
  const overallCompletedCount = tasks.filter((task) => {
    if (task.done) return true;
    return taskProgress.some((p) => p.task_id === task.id && p.completed);
  }).length;
  const overallTotal = tasks.length;
  const overallPct = overallTotal === 0 ? 0 : Math.round((overallCompletedCount / overallTotal) * 100);

  // メンバー別進捗計算
  const memberProgress = members
    .map((member) => {
      const email = member.email ?? member.display_name ?? '';
      // そのメンバーに割り当てられたタスク (assignees含む or open_join)
      const myTasks = tasks.filter(
        (t) =>
          t.open_join ||
          (Array.isArray(t.assignees) &&
            (t.assignees.includes(email) || t.assignees.includes(member.id)))
      );
      if (myTasks.length === 0) return null;

      const completedCount = myTasks.filter((task) => {
        if (task.done) return true;
        const prog = taskProgress.find((p) => p.task_id === task.id && p.member_email === email);
        return prog?.completed ?? false;
      }).length;
      const pct = Math.round((completedCount / myTasks.length) * 100);

      // 今日の作業ログ
      const log = workLogs.find((l) => l.member_id === member.id);
      // Discord 参加可否
      const avail = availability.find(
        (a) => a.user_id === member.id || a.user_email === email
      );

      return {
        member,
        myTasks,
        completedCount,
        pct,
        log,
        avail: avail?.status ?? 'unknown',
      };
    })
    .filter(Boolean) as NonNullable<ReturnType<typeof members['map'][0]>>[];

  // Discord 集計
  const discordCounts = {
    available: availability.filter((a) => a.status === 'available').length,
    maybe: availability.filter((a) => a.status === 'maybe').length,
    unavailable: availability.filter((a) => a.status === 'unavailable').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-lg animate-pulse">{t.loading}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-green-600 to-teal-600 text-white px-4 pt-8 pb-6">
        <div className="max-w-4xl mx-auto flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">📊 {t.title}</h1>
            <p className="text-green-200 text-sm mt-1">{t.subtitle(today)}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadAll}
              className="bg-white/20 hover:bg-white/30 rounded-xl px-3 py-1.5 text-sm font-medium transition"
            >
              {t.refresh}
            </button>
            <button
              onClick={() => setLang((l) => (l === 'ja' ? 'en' : 'ja'))}
              className="bg-white/20 hover:bg-white/30 rounded-xl px-3 py-1.5 text-sm font-medium transition"
            >
              {lang === 'ja' ? 'EN' : 'JP'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-6 space-y-6">

        {/* ── 全体進捗 ── */}
        <Section title={`📈 ${t.overall}`}>
          <div className="flex items-center gap-4">
            {/* 大きな円グラフ風 */}
            <div className="relative w-28 h-28 shrink-0">
              <svg viewBox="0 0 36 36" className="w-28 h-28 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                <circle
                  cx="18"
                  cy="18"
                  r="15.9"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                  strokeDasharray={`${overallPct} ${100 - overallPct}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-gray-800">{overallPct}%</span>
              </div>
            </div>
            <div className="flex-1">
              <ProgressBar pct={overallPct} color="bg-green-500" />
              <p className="text-sm text-gray-500 mt-2">
                {overallCompletedCount} / {overallTotal} {t.totalTasks} {t.completedTasks}
              </p>
              {/* タスク一覧 */}
              <div className="mt-3 space-y-1">
                {tasks.map((task) => {
                  const isDone =
                    task.done || taskProgress.some((p) => p.task_id === task.id && p.completed);
                  return (
                    <div key={task.id} className="flex items-center gap-2 text-sm">
                      <span>{isDone ? '✅' : '⬜'}</span>
                      <span className={isDone ? 'line-through text-gray-400' : 'text-gray-700'}>
                        {task.title}
                      </span>
                      {task.priority && (
                        <span className={`text-xs px-1.5 rounded-full ${PRIORITY_COLOR[task.priority] ?? 'bg-gray-100 text-gray-500'}`}>
                          {task.priority}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Section>

        {/* ── Discord 参加状況 ── */}
        <Section title={`💬 ${t.discord}`}>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                { key: 'available', label: t.avail },
                { key: 'maybe', label: t.maybe },
                { key: 'unavailable', label: t.unavail },
              ] as const
            ).map(({ key, label }) => {
              const meta = DISCORD_META[key];
              const count = discordCounts[key];
              return (
                <div key={key} className={`${meta.bg} rounded-2xl p-4 text-center`}>
                  <p className="text-3xl">{meta.emoji}</p>
                  <p className={`text-2xl font-bold mt-1 ${meta.color}`}>{count}</p>
                  <p className={`text-xs mt-0.5 ${meta.color}`}>{label}</p>
                </div>
              );
            })}
          </div>
        </Section>

        {/* ── メンバー別進捗 ── */}
        <Section title={`👥 ${t.byMember}`}>
          {memberProgress.length === 0 ? (
            <p className="text-gray-400 text-sm">{t.noMembers}</p>
          ) : (
            <div className="space-y-4">
              {memberProgress.map(({ member, myTasks, completedCount, pct, log, avail }) => {
                const discMeta = DISCORD_META[avail as keyof typeof DISCORD_META] ?? DISCORD_META.unknown;
                const email = member.email ?? member.display_name ?? '';
                return (
                  <div key={member.id} className="border border-gray-100 rounded-2xl p-4 bg-white">
                    {/* 名前 + Discord */}
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                          {(member.display_name ?? email ?? '?')[0]?.toUpperCase()}
                        </div>
                        <span className="font-semibold text-gray-800">
                          {member.display_name ?? email}
                        </span>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${discMeta.bg} ${discMeta.color}`}>
                        {discMeta.emoji} Discord
                      </span>
                    </div>

                    {/* プログレスバー */}
                    <div className="flex items-center gap-3 mb-3">
                      <ProgressBar pct={pct} color={pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-400' : 'bg-red-400'} />
                      <span className="text-sm font-bold text-gray-700 w-12 text-right">{pct}%</span>
                    </div>
                    <p className="text-xs text-gray-400 mb-3">
                      {completedCount} / {myTasks.length} {t.totalTasks}
                    </p>

                    {/* タスク一覧 */}
                    <div className="space-y-1 mb-3">
                      {myTasks.map((task) => {
                        const prog = taskProgress.find(
                          (p) => p.task_id === task.id && p.member_email === email
                        );
                        const isDone = task.done || prog?.completed;
                        return (
                          <div key={task.id}>
                            <div className="flex items-center gap-2 text-sm">
                              <span>{isDone ? '✅' : '⬜'}</span>
                              <span className={isDone ? 'line-through text-gray-400' : 'text-gray-700'}>
                                {task.title}
                                {task.open_join && <span className="text-indigo-400 ml-1">{t.openJoin}</span>}
                              </span>
                            </div>
                            {/* 修正点 */}
                            {!isDone && prog?.work_notes && (
                              <div className="ml-6 mt-1 text-xs bg-orange-50 text-orange-700 rounded-lg px-3 py-1.5">
                                ⚠️ {prog.work_notes}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* 今日の作業ログ */}
                    {log && (
                      <div className="bg-gray-50 rounded-xl p-3 text-sm">
                        <p className="font-medium text-gray-700 mb-1">📝 {t.workLogs}</p>
                        <p className="text-gray-600">{log.work_summary}</p>
                        {!log.completed && log.issue_notes && (
                          <div className="mt-2 bg-orange-50 text-orange-700 rounded-lg px-3 py-1.5 text-xs">
                            ⚠️ <strong>{t.issues}：</strong>{log.issue_notes}
                          </div>
                        )}
                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                          <span>{log.completed ? '✅ ' + t.completed : '⚠️ ' + t.incomplete}</span>
                          <span>·</span>
                          <span>{new Date(log.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Section>

      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// 小コンポーネント
// ──────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <h2 className="font-bold text-gray-800 mb-4 text-base">{title}</h2>
      {children}
    </div>
  );
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
