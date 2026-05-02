'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ProgressRow } from '@/lib/excel-template';

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

interface ExcelSummary {
  total: number;
  done: number;
  inProgress: number;
  todo: number;
  avgProgress: number;
  issues: { task: string; assignee: string; note: string }[];
  highPriority: ProgressRow[];
}

type Lang = 'ja' | 'en';
type Tab = 'live' | 'excel';

const T = {
  ja: {
    title: '進捗ダッシュボード',
    subtitle: (date: string) => `📅 ${date} の作業状況`,
    tabLive: '📊 リアルタイム',
    tabExcel: '📂 Excelインポート',
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
    // Excel
    excelTitle: 'Excel進捗インポート',
    excelSubtitle: 'Excelファイルを読み込んで進捗・課題を一覧表示します',
    downloadTemplate: '📥 テンプレートをダウンロード',
    uploadExcel: 'Excelファイルを選択',
    uploadHint: '.xlsx / .xls / .csv 対応',
    analyzing: '解析中...',
    excelSummary: '進捗サマリー',
    taskList: 'タスク一覧',
    issueList: '課題・メモ一覧',
    noIssues: '課題・メモはありません',
    highPriorityAlert: '⚠️ 優先度「高」の未完了タスク',
    warningLabel: '⚠️ 形式の注意',
    status: { done: '完了', in_progress: '進行中', todo: '未着手', '': '不明' },
    priority: { high: '高', medium: '中', low: '低', '': '-' },
  },
  en: {
    title: 'Progress Dashboard',
    subtitle: (date: string) => `📅 ${date} Work Status`,
    tabLive: '📊 Live',
    tabExcel: '📂 Excel Import',
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
    // Excel
    excelTitle: 'Excel Progress Import',
    excelSubtitle: 'Upload an Excel file to view progress & issues at a glance',
    downloadTemplate: '📥 Download Template',
    uploadExcel: 'Select Excel File',
    uploadHint: '.xlsx / .xls / .csv supported',
    analyzing: 'Analyzing...',
    excelSummary: 'Progress Summary',
    taskList: 'Task List',
    issueList: 'Issues & Notes',
    noIssues: 'No issues noted',
    highPriorityAlert: '⚠️ High Priority Incomplete Tasks',
    warningLabel: '⚠️ Format Notes',
    status: { done: 'Done', in_progress: 'In Progress', todo: 'To Do', '': 'Unknown' },
    priority: { high: 'High', medium: 'Medium', low: 'Low', '': '-' },
  },
};

const PRIORITY_COLOR: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700',
};

const STATUS_COLOR: Record<string, string> = {
  done: 'bg-green-100 text-green-700',
  in_progress: 'bg-blue-100 text-blue-700',
  todo: 'bg-gray-100 text-gray-500',
  '': 'bg-gray-100 text-gray-400',
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
  const [activeTab, setActiveTab] = useState<Tab>('live');

  const today = new Date().toLocaleDateString('sv-SE');

  // ── Live タブ ──
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskProgress, setTaskProgress] = useState<TaskProgress[]>([]);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);

  // ── Excel タブ ──
  const fileRef = useRef<HTMLInputElement>(null);
  const [excelRows, setExcelRows] = useState<ProgressRow[]>([]);
  const [excelSummary, setExcelSummary] = useState<ExcelSummary | null>(null);
  const [excelWarnings, setExcelWarnings] = useState<string[]>([]);
  const [excelLoading, setExcelLoading] = useState(false);
  const [fileName, setFileName] = useState('');

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

  // ── 計算ロジック ──
  const overallCompletedCount = tasks.filter((task) => {
    if (task.done) return true;
    return taskProgress.some((p) => p.task_id === task.id && p.completed);
  }).length;
  const overallTotal = tasks.length;
  const overallPct = overallTotal === 0 ? 0 : Math.round((overallCompletedCount / overallTotal) * 100);

  const memberProgress = members
    .map((member) => {
      const email = member.email ?? member.display_name ?? '';
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
      const log = workLogs.find((l) => l.member_id === member.id);
      const avail = availability.find(
        (a) => a.user_id === member.id || a.user_email === email
      );
      return { member, myTasks, completedCount, pct, log, avail: avail?.status ?? 'unknown' };
    })
    .filter(Boolean) as { member: Member; myTasks: Task[]; completedCount: number; pct: number; log: WorkLog | undefined; avail: string }[];

  const discordCounts = {
    available: availability.filter((a) => a.status === 'available').length,
    maybe: availability.filter((a) => a.status === 'maybe').length,
    unavailable: availability.filter((a) => a.status === 'unavailable').length,
  };

  // ── Excel アップロード ──
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setExcelLoading(true);
    setExcelWarnings([]);
    setExcelRows([]);
    setExcelSummary(null);

    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/progress/excel', { method: 'POST', body: form });
    const data = await res.json();
    if (res.ok) {
      setExcelRows(data.rows ?? []);
      setExcelSummary(data.summary ?? null);
      setExcelWarnings(data.warnings ?? []);
    } else {
      setExcelWarnings([data.error ?? '解析エラー']);
    }
    setExcelLoading(false);
    // ファイル選択をリセット（同一ファイルの再読込を許可）
    if (fileRef.current) fileRef.current.value = '';
  };

  if (loading && activeTab === 'live') {
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

      {/* タブ切替 */}
      <div className="max-w-4xl mx-auto px-4 mt-4">
        <div className="flex bg-white rounded-2xl shadow-sm border border-gray-100 p-1 gap-1">
          {(['live', 'excel'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition ${
                activeTab === tab
                  ? 'bg-green-600 text-white shadow'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab === 'live' ? t.tabLive : t.tabExcel}
            </button>
          ))}
        </div>
      </div>

      {/* ── Live タブ ── */}
      {activeTab === 'live' && (
        <div className="max-w-4xl mx-auto px-4 mt-6 space-y-6">
          {/* 全体進捗 */}
          <Section title={`📈 ${t.overall}`}>
            <div className="flex items-center gap-4">
              <div className="relative w-28 h-28 shrink-0">
                <svg viewBox="0 0 36 36" className="w-28 h-28 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.9" fill="none" stroke="#10b981" strokeWidth="3"
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
                <div className="mt-3 space-y-1">
                  {tasks.map((task) => {
                    const isDone = task.done || taskProgress.some((p) => p.task_id === task.id && p.completed);
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

          {/* Discord 参加状況 */}
          <Section title={`💬 ${t.discord}`}>
            <div className="grid grid-cols-3 gap-3">
              {(['available', 'maybe', 'unavailable'] as const).map((key) => {
                const meta = DISCORD_META[key];
                const label = key === 'available' ? t.avail : key === 'maybe' ? t.maybe : t.unavail;
                return (
                  <div key={key} className={`${meta.bg} rounded-2xl p-4 text-center`}>
                    <p className="text-3xl">{meta.emoji}</p>
                    <p className={`text-2xl font-bold mt-1 ${meta.color}`}>{discordCounts[key]}</p>
                    <p className={`text-xs mt-0.5 ${meta.color}`}>{label}</p>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* メンバー別進捗 */}
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
                      <div className="flex items-center gap-3 mb-3">
                        <ProgressBar pct={pct} color={pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-400' : 'bg-red-400'} />
                        <span className="text-sm font-bold text-gray-700 w-12 text-right">{pct}%</span>
                      </div>
                      <p className="text-xs text-gray-400 mb-3">
                        {completedCount} / {myTasks.length} {t.totalTasks}
                      </p>
                      <div className="space-y-1 mb-3">
                        {myTasks.map((task: Task) => {
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
                              {!isDone && prog?.work_notes && (
                                <div className="ml-6 mt-1 text-xs bg-orange-50 text-orange-700 rounded-lg px-3 py-1.5">
                                  ⚠️ {prog.work_notes}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
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
      )}

      {/* ── Excel タブ ── */}
      {activeTab === 'excel' && (
        <div className="max-w-4xl mx-auto px-4 mt-6 space-y-6">
          <Section title={`📂 ${t.excelTitle}`}>
            <p className="text-sm text-gray-500 mb-4">{t.excelSubtitle}</p>

            <div className="flex flex-col sm:flex-row gap-3">
              {/* テンプレートダウンロード */}
              <a
                href="/api/progress/excel"
                download="aerosync_progress_template.xlsx"
                className="flex items-center justify-center gap-2 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-xl px-4 py-3 text-sm font-medium transition"
              >
                {t.downloadTemplate}
              </a>

              {/* ファイル選択 */}
              <label className="flex-1 flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 border-dashed rounded-xl px-4 py-3 text-sm font-medium transition cursor-pointer">
                <span>📎 {fileName || t.uploadExcel}</span>
                <span className="text-xs text-blue-400">({t.uploadHint})</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            </div>

            {/* 注意メッセージ */}
            {excelWarnings.length > 0 && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-amber-700 mb-1">{t.warningLabel}</p>
                <ul className="list-disc list-inside text-xs text-amber-600 space-y-0.5">
                  {excelWarnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            {excelLoading && (
              <p className="text-center text-gray-400 text-sm mt-4 animate-pulse">{t.analyzing}</p>
            )}
          </Section>

          {/* サマリー */}
          {excelSummary && (
            <>
              <Section title={`📈 ${t.excelSummary}`}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <StatCard label="合計" value={excelSummary.total} color="text-gray-700" />
                  <StatCard label="完了" value={excelSummary.done} color="text-green-600" />
                  <StatCard label="進行中" value={excelSummary.inProgress} color="text-blue-600" />
                  <StatCard label="未着手" value={excelSummary.todo} color="text-gray-400" />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>平均進捗</span>
                    <span className="font-bold">{excelSummary.avgProgress}%</span>
                  </div>
                  <ProgressBar pct={excelSummary.avgProgress} color="bg-green-500" />
                </div>

                {/* 優先度高の未完了 */}
                {excelSummary.highPriority.length > 0 && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3">
                    <p className="text-sm font-semibold text-red-700 mb-2">{t.highPriorityAlert}</p>
                    <ul className="space-y-1">
                      {excelSummary.highPriority.map((r, i) => (
                        <li key={i} className="text-sm text-red-600 flex justify-between">
                          <span>{r.taskName}</span>
                          <span className="text-xs text-red-400">{r.assignee} · {r.progressPct}%</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Section>

              {/* 課題一覧 */}
              <Section title={`⚠️ ${t.issueList}`}>
                {excelSummary.issues.length === 0 ? (
                  <p className="text-gray-400 text-sm">{t.noIssues}</p>
                ) : (
                  <div className="space-y-2">
                    {excelSummary.issues.map((issue, i) => (
                      <div key={i} className="bg-orange-50 border border-orange-100 rounded-xl p-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium text-gray-800 text-sm">{issue.task}</span>
                          <span className="text-xs text-gray-500">{issue.assignee}</span>
                        </div>
                        <p className="text-sm text-orange-700">⚠️ {issue.note}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* タスク一覧テーブル */}
              <Section title={`📋 ${t.taskList}`}>
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs text-gray-400">
                        <th className="text-left py-2 px-2 font-medium">タスク名</th>
                        <th className="text-left py-2 px-2 font-medium">担当者</th>
                        <th className="text-left py-2 px-2 font-medium">優先度</th>
                        <th className="text-left py-2 px-2 font-medium">状態</th>
                        <th className="text-right py-2 px-2 font-medium">進捗</th>
                        <th className="text-left py-2 px-2 font-medium">期日</th>
                      </tr>
                    </thead>
                    <tbody>
                      {excelRows.map((row, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 px-2 text-gray-800">{row.taskName}</td>
                          <td className="py-2 px-2 text-gray-600">{row.assignee || '—'}</td>
                          <td className="py-2 px-2">
                            {row.priority && (
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${PRIORITY_COLOR[row.priority] ?? 'bg-gray-100 text-gray-500'}`}>
                                {t.priority[row.priority]}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2">
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_COLOR[row.status]}`}>
                              {t.status[row.status]}
                            </span>
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-1 justify-end">
                              <div className="w-16 bg-gray-100 rounded-full h-1.5">
                                <div
                                  className={`h-full rounded-full ${row.progressPct >= 100 ? 'bg-green-500' : row.progressPct >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                                  style={{ width: `${row.progressPct}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 w-8 text-right">{row.progressPct}%</span>
                            </div>
                          </td>
                          <td className="py-2 px-2 text-gray-500 text-xs">{row.dueDate || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            </>
          )}
        </div>
      )}
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

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
