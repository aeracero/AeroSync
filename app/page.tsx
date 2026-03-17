"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Calendar, Package, BookOpen, Settings, LogOut, Plus, ShieldAlert,
  ChevronRight, Trash2, Loader2, Mail, Lock, Eye, EyeOff, User,
  Search, X, Bell, BellOff, ChevronLeft, ChevronDown, Edit2, Save,
  UserPlus, Check, Image as ImageIcon, Hash, Menu, ArrowLeft,
  Smartphone, Info, RefreshCw, Users
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "schedule" | "inventory" | "wiki" | "settings";
type AuthMode = "login" | "signup" | "check_email";

type Task = {
  id: string; title: string; date: string; description: string;
  assignees: string[]; openJoin: boolean; color: string; done: boolean;
};
type InventoryItem = {
  id: string; name: string; stock: number; total: number; image: string; isEmoji: boolean;
};
type WikiPage = {
  id: string; title: string; content: string; category: string; updatedAt: string; author: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TASK_COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#84cc16"];
const WIKI_CATEGORIES = ["一般","機材","手順","ルール","メモ"];

function loadLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
}
function saveLS(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ─── PWA helpers ─────────────────────────────────────────────────────────────

function registerSW() {
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
}

async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  const p = await Notification.requestPermission();
  return p === "granted";
}

// ─── Small UI atoms ───────────────────────────────────────────────────────────

function DiscordIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.031.053a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
    </svg>
  );
}

function Pill({ color, children }: { color?: string; children: React.ReactNode }) {
  return (
    <span style={{ background: color ? color + "22" : undefined, color: color, border: `1px solid ${color}44` }}
      className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
      {children}
    </span>
  );
}

// ─── Calendar Component ───────────────────────────────────────────────────────

function CalendarView({ tasks, onDayClick, selectedDate }: {
  tasks: Task[]; onDayClick: (d: string) => void; selectedDate: string;
}) {
  const [viewDate, setViewDate] = useState(new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split("T")[0];
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay });

  function dateStr(d: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <button onClick={() => setViewDate(new Date(year, month - 1))} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft size={16} className="text-gray-500" />
        </button>
        <span className="font-bold text-sm text-gray-800">{year}年 {month + 1}月</span>
        <button onClick={() => setViewDate(new Date(year, month + 1))} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronRight size={16} className="text-gray-500" />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center">
        {["日","月","火","水","木","金","土"].map((d, i) => (
          <div key={d} className={`py-2 text-[10px] font-bold ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-400"}`}>{d}</div>
        ))}
        {blanks.map((_, i) => <div key={`b${i}`} />)}
        {days.map(d => {
          const ds = dateStr(d);
          const dayTasks = tasks.filter(t => t.date === ds);
          const isToday = ds === today;
          const isSelected = ds === selectedDate;
          return (
            <button key={d} onClick={() => onDayClick(ds)}
              className={`relative py-1.5 mx-0.5 my-0.5 rounded-xl text-xs font-medium transition-all
                ${isSelected ? "bg-blue-600 text-white shadow-md shadow-blue-200" :
                  isToday ? "bg-blue-50 text-blue-600 font-bold" : "text-gray-700 hover:bg-gray-50"}`}>
              {d}
              {dayTasks.length > 0 && (
                <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                  {dayTasks.slice(0, 3).map(t => (
                    <div key={t.id} style={{ background: isSelected ? "white" : t.color }}
                      className="w-1 h-1 rounded-full opacity-80" />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ task, isAdmin, currentUser, onDelete, onToggleDone, onJoin }: {
  task: Task; isAdmin: boolean; currentUser: string;
  onDelete: () => void; onToggleDone: () => void; onJoin: () => void;
}) {
  const isAssigned = task.assignees.includes(currentUser);
  const canJoin = task.openJoin && !isAssigned;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${task.done ? "opacity-60" : ""}`}
      style={{ borderColor: task.color + "44", borderLeftWidth: 3, borderLeftColor: task.color }}>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-sm font-bold truncate ${task.done ? "line-through text-gray-400" : "text-gray-900"}`}>{task.title}</span>
              {isAssigned && <Pill color={task.color}>担当</Pill>}
            </div>
            {task.description && <p className="text-xs text-gray-500 line-clamp-2">{task.description}</p>}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {task.assignees.length > 0 && (
                <div className="flex items-center gap-1">
                  <Users size={11} className="text-gray-400" />
                  <span className="text-[10px] text-gray-500">{task.assignees.length}人</span>
                </div>
              )}
              {task.openJoin && <Pill color="#10b981">参加可能</Pill>}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onToggleDone}
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
                ${task.done ? "bg-green-500 border-green-500" : "border-gray-300 hover:border-green-400"}`}>
              {task.done && <Check size={12} className="text-white" />}
            </button>
            {isAdmin && (
              <button onClick={onDelete} className="p-1 text-gray-300 hover:text-red-400 transition-colors">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
        {canJoin && (
          <button onClick={onJoin} className="mt-2 w-full py-1.5 rounded-xl text-xs font-bold text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 transition-colors flex items-center justify-center gap-1">
            <UserPlus size={12} /> タスクに参加
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Wiki Page View ───────────────────────────────────────────────────────────

function WikiPageView({ page, isAdmin, onSave, onBack }: {
  page: WikiPage; isAdmin: boolean; onSave: (p: WikiPage) => void; onBack: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(page.title);
  const [content, setContent] = useState(page.content);
  const [category, setCategory] = useState(page.category);

  function save() {
    onSave({ ...page, title, content, category, updatedAt: new Date().toISOString().split("T")[0] });
    setEditing(false);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          {editing ? (
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full text-base font-bold border-b border-blue-300 focus:outline-none bg-transparent" />
          ) : (
            <h2 className="text-base font-bold text-gray-900 truncate">{page.title}</h2>
          )}
        </div>
        {isAdmin && (
          editing ? (
            <button onClick={save} className="flex items-center gap-1 text-xs font-bold text-white bg-blue-600 px-3 py-1.5 rounded-lg">
              <Save size={13} /> 保存
            </button>
          ) : (
            <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">
              <Edit2 size={13} /> 編集
            </button>
          )
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center gap-2 mb-4">
          {editing ? (
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300">
              {WIKI_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          ) : (
            <Pill color="#3b82f6">{page.category}</Pill>
          )}
          <span className="text-[10px] text-gray-400">更新: {page.updatedAt} · {page.author}</span>
        </div>
        {editing ? (
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={20}
            className="w-full text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none font-mono" />
        ) : (
          <div className="prose prose-sm max-w-none">
            {content.split("\n").map((line, i) => {
              if (line.startsWith("# ")) return <h1 key={i} className="text-xl font-black text-gray-900 mt-4 mb-2">{line.slice(2)}</h1>;
              if (line.startsWith("## ")) return <h2 key={i} className="text-lg font-bold text-gray-800 mt-3 mb-1 border-b border-gray-100 pb-1">{line.slice(3)}</h2>;
              if (line.startsWith("### ")) return <h3 key={i} className="text-base font-bold text-gray-700 mt-2 mb-1">{line.slice(4)}</h3>;
              if (line.startsWith("- ")) return <li key={i} className="text-sm text-gray-600 ml-4 my-0.5 list-disc">{line.slice(2)}</li>;
              if (line.startsWith("> ")) return <blockquote key={i} className="border-l-2 border-blue-300 pl-3 text-sm text-gray-500 italic my-1">{line.slice(2)}</blockquote>;
              if (line === "") return <div key={i} className="h-3" />;
              return <p key={i} className="text-sm text-gray-700 leading-relaxed my-1">{line}</p>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function AppShell() {
  const [isMounted,    setIsMounted]    = useState(false);
  const [session,      setSession]      = useState<any>(undefined);
  const [isAdmin,      setIsAdmin]      = useState(false);
  const [activeTab,    setActiveTab]    = useState<Tab>("schedule");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [authMode,     setAuthMode]     = useState<AuthMode>("login");
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [showPw,       setShowPw]       = useState(false);
  const [authLoading,  setAuthLoading]  = useState(false);
  const [authError,    setAuthError]    = useState<string | null>(null);

  // Search
  const [searchOpen,   setSearchOpen]   = useState(false);
  const [searchQuery,  setSearchQuery]  = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Notifications
  const [notifEnabled, setNotifEnabled] = useState(false);

  // Schedule
  const [tasks,         setTasks]         = useState<Task[]>([]);
  const [selectedDate,  setSelectedDate]  = useState(new Date().toISOString().split("T")[0]);
  const [showTaskForm,  setShowTaskForm]  = useState(false);
  const [newTaskTitle,  setNewTaskTitle]  = useState("");
  const [newTaskDesc,   setNewTaskDesc]   = useState("");
  const [newTaskColor,  setNewTaskColor]  = useState(TASK_COLORS[0]);
  const [newTaskOpen,   setNewTaskOpen]   = useState(true);
  const [newTaskAssignees, setNewTaskAssignees] = useState<string[]>([]);
  const [newAssigneeInput, setNewAssigneeInput] = useState("");

  // Inventory
  const [inventory,    setInventory]    = useState<InventoryItem[]>([]);
  const [showInvForm,  setShowInvForm]  = useState(false);
  const [newInvName,   setNewInvName]   = useState("");
  const [newInvTotal,  setNewInvTotal]  = useState("");
  const [newInvEmoji,  setNewInvEmoji]  = useState("📦");
  const [newInvImage,  setNewInvImage]  = useState<string | null>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  // Wiki
  const [wikis,        setWikis]        = useState<WikiPage[]>([]);
  const [activeWiki,   setActiveWiki]   = useState<WikiPage | null>(null);
  const [showWikiForm, setShowWikiForm] = useState(false);
  const [newWikiTitle, setNewWikiTitle] = useState("");
  const [newWikiCat,   setNewWikiCat]   = useState(WIKI_CATEGORIES[0]);
  const [wikiFilter,   setWikiFilter]   = useState("すべて");

  useEffect(() => {
    setIsMounted(true);
    registerSW();

    const supabase = createClient();
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get("error_description") || urlParams.get("error");
    const customError = urlParams.get("auth_error");
    if (error || customError) {
      setErrorMessage(`【認証失敗】 ${error ?? ""} — 詳細: ${customError ?? "なし"}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Handle tab from URL shortcut
    const tab = urlParams.get("tab") as Tab | null;
    if (tab) setActiveTab(tab);

    supabase.auth.getUser().then(({ data: { user }, error: userError }) => {
      if (userError) { setSession(null); return; }
      if (user) { supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s)); }
      else setSession(null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));

    setTasks(loadLS("as_tasks", []));
    setInventory(loadLS("as_inventory", [
      { id: "1", name: "一眼レフカメラ", stock: 1, total: 1, image: "📷", isEmoji: true }
    ]));
    setWikis(loadLS("as_wikis", [
      { id: "1", title: "AeroSync使い方ガイド", content: "# AeroSync使い方ガイド\n\n## はじめに\nこのWikiはAeroSyncの使い方をまとめたものです。\n\n## スケジュール\nカレンダーから日付を選んでタスクを追加できます。\n\n## 在庫管理\n機材の在庫を管理できます。\n\n## Wiki\nここに情報をまとめることができます。", category: "一般", updatedAt: new Date().toISOString().split("T")[0], author: "Admin" }
    ]));
    setNotifEnabled(Notification?.permission === "granted");

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    saveLS("as_tasks", tasks);
    saveLS("as_inventory", inventory);
    saveLS("as_wikis", wikis);
  }, [tasks, inventory, wikis, isMounted]);

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 100);
  }, [searchOpen]);

  // ── Auth ──────────────────────────────────────────────────────────────────

  const handleDiscordLogin = async () => {
    setAuthError(null); setAuthLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (e: any) { setAuthError(e.message); setAuthLoading(false); }
  };

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) { setAuthError("メールとパスワードを入力してください"); return; }
    setAuthError(null); setAuthLoading(true);
    try {
      const supabase = createClient();
      if (authMode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        setAuthMode("check_email");
      }
    } catch (e: any) { setAuthError(e.message); }
    finally { setAuthLoading(false); }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
  };

  // ── Tasks ─────────────────────────────────────────────────────────────────

  const addTask = useCallback(() => {
    if (!newTaskTitle.trim()) return;
    const t: Task = {
      id: Date.now().toString(), title: newTaskTitle.trim(),
      date: selectedDate, description: newTaskDesc.trim(),
      assignees: newTaskAssignees, openJoin: newTaskOpen,
      color: newTaskColor, done: false,
    };
    setTasks(prev => [...prev, t]);
    setNewTaskTitle(""); setNewTaskDesc(""); setNewTaskAssignees([]); setShowTaskForm(false);
  }, [newTaskTitle, newTaskDesc, selectedDate, newTaskAssignees, newTaskOpen, newTaskColor]);

  const currentUserEmail = session?.user?.email ?? session?.user?.user_metadata?.full_name ?? "me";

  const joinTask = useCallback((id: string) => {
    setTasks(prev => prev.map(t => t.id === id
      ? { ...t, assignees: [...t.assignees, currentUserEmail] } : t));
  }, [currentUserEmail]);

  // ── Inventory ─────────────────────────────────────────────────────────────

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setNewInvImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const addInventory = useCallback(() => {
    if (!newInvName.trim() || !newInvTotal) return;
    const n = parseInt(newInvTotal, 10);
    if (isNaN(n) || n < 1) return;
    const item: InventoryItem = {
      id: Date.now().toString(), name: newInvName.trim(),
      stock: n, total: n,
      image: newInvImage ?? newInvEmoji,
      isEmoji: !newInvImage,
    };
    setInventory(prev => [...prev, item]);
    setNewInvName(""); setNewInvTotal(""); setNewInvImage(null); setShowInvForm(false);
  }, [newInvName, newInvTotal, newInvEmoji, newInvImage]);

  // ── Wiki ──────────────────────────────────────────────────────────────────

  const addWiki = useCallback(() => {
    if (!newWikiTitle.trim()) return;
    const page: WikiPage = {
      id: Date.now().toString(), title: newWikiTitle.trim(),
      content: `# ${newWikiTitle.trim()}\n\nここに内容を書いてください。`,
      category: newWikiCat,
      updatedAt: new Date().toISOString().split("T")[0],
      author: currentUserEmail,
    };
    setWikis(prev => [...prev, page]);
    setNewWikiTitle(""); setShowWikiForm(false);
    setActiveWiki(page);
  }, [newWikiTitle, newWikiCat, currentUserEmail]);

  // ── Notifications ─────────────────────────────────────────────────────────

  const toggleNotifications = async () => {
    if (notifEnabled) { setNotifEnabled(false); return; }
    const granted = await requestNotificationPermission();
    setNotifEnabled(granted);
    if (granted) new Notification("AeroSync", { body: "通知が有効になりました！", icon: "/icons/icon-192.png" });
  };

  // ── Search ────────────────────────────────────────────────────────────────

  const searchResults = searchQuery.trim().length < 1 ? [] : [
    ...tasks.filter(t => t.title.includes(searchQuery) || t.description.includes(searchQuery))
      .map(t => ({ type: "task", label: t.title, sub: t.date, tab: "schedule" as Tab, color: t.color })),
    ...inventory.filter(i => i.name.includes(searchQuery))
      .map(i => ({ type: "inventory", label: i.name, sub: `残: ${i.stock}/${i.total}`, tab: "inventory" as Tab, color: "#3b82f6" })),
    ...wikis.filter(w => w.title.includes(searchQuery) || w.content.includes(searchQuery))
      .map(w => ({ type: "wiki", label: w.title, sub: w.category, tab: "wiki" as Tab, color: "#8b5cf6" })),
  ];

  // ── Loading ────────────────────────────────────────────────────────────────

  if (!isMounted || session === undefined) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f0f4ff]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
            <span className="text-white font-black text-lg">AS</span>
          </div>
          <Loader2 size={20} className="animate-spin text-blue-400" />
        </div>
      </div>
    );
  }

  // ── Auth screen ────────────────────────────────────────────────────────────

  if (!session) {
    return (
      <div className="min-h-screen bg-[#f0f4ff] flex items-center justify-center p-4">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle, #3b5bdb 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="relative w-full max-w-sm">
          <div className="bg-white rounded-3xl shadow-2xl shadow-blue-100/60 border border-white overflow-hidden">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-8 pt-10 pb-8 text-center">
              <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4 ring-2 ring-white/30">
                <span className="text-white text-xl font-black">AS</span>
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight mb-1">AeroSync</h1>
              <p className="text-blue-200 text-sm">課外活動をスマートに同期</p>
            </div>
            <div className="px-8 py-7">
              {errorMessage && (
                <div className="mb-5 bg-red-50 text-red-600 p-3 rounded-xl text-xs font-medium flex items-start gap-2 border border-red-100">
                  <ShieldAlert size={14} className="shrink-0 mt-0.5" /><span className="break-all">{errorMessage}</span>
                </div>
              )}
              {authMode === "check_email" ? (
                <div className="text-center py-4">
                  <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><Mail size={24} className="text-blue-500" /></div>
                  <h2 className="font-bold text-gray-900 mb-2">メールを確認してください</h2>
                  <p className="text-sm text-gray-500 mb-5">確認メールを <span className="font-medium text-gray-700">{email}</span> に送信しました。</p>
                  <button onClick={() => { setAuthMode("login"); setEmail(""); setPassword(""); }} className="text-sm text-blue-600 font-medium hover:underline">ログイン画面に戻る</button>
                </div>
              ) : (
                <>
                  <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
                    {(["login","signup"] as const).map(mode => (
                      <button key={mode} onClick={() => { setAuthMode(mode); setAuthError(null); }}
                        className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-all ${authMode === mode ? "bg-white text-gray-900 shadow-sm" : "text-gray-400"}`}>
                        {mode === "login" ? "ログイン" : "新規登録"}
                      </button>
                    ))}
                  </div>
                  {authError && <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-xl text-xs font-medium border border-red-100">{authError}</div>}
                  <div className="space-y-3 mb-4">
                    <div className="relative">
                      <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input type="email" placeholder="メールアドレス" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleEmailAuth()}
                        className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-gray-50 focus:bg-white transition" />
                    </div>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input type={showPw ? "text" : "password"} placeholder="パスワード" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleEmailAuth()}
                        className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-gray-50 focus:bg-white transition" />
                      <button onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                        {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                  <button onClick={handleEmailAuth} disabled={authLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md shadow-blue-200 mb-4">
                    {authLoading ? <Loader2 size={16} className="animate-spin" /> : <User size={16} />}
                    {authMode === "login" ? "メールでログイン" : "アカウント作成"}
                  </button>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-px bg-gray-200" /><span className="text-xs text-gray-400 font-medium">または</span><div className="flex-1 h-px bg-gray-200" />
                  </div>
                  <button onClick={handleDiscordLogin} disabled={authLoading}
                    className="w-full bg-[#5865F2] hover:bg-[#4752C4] disabled:opacity-60 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] shadow-md shadow-indigo-200">
                    {authLoading ? <Loader2 size={16} className="animate-spin" /> : <DiscordIcon />}
                    Discordでログイン
                  </button>
                </>
              )}
            </div>
          </div>
          <p className="text-center text-xs text-gray-400 mt-5">AeroSync · 課外活動管理</p>
        </div>
      </div>
    );
  }

  // ── Authenticated app ──────────────────────────────────────────────────────

  const userProfile = session.user?.user_metadata ?? {};
  const displayName = userProfile?.full_name ?? session.user?.email ?? "ユーザー";

  const selectedTasks = tasks.filter(t => t.date === selectedDate);

  const renderContent = () => {
    // ── Schedule ──────────────────────────────────────────────────────────────
    if (activeTab === "schedule") return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-gray-900">スケジュール</h2>
          {isAdmin && (
            <button onClick={() => setShowTaskForm(true)}
              className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm shadow-blue-200 hover:bg-blue-700 transition-colors">
              <Plus size={14} /> タスク追加
            </button>
          )}
        </div>

        <CalendarView tasks={tasks} onDayClick={setSelectedDate} selectedDate={selectedDate} />

        <div>
          <h3 className="text-sm font-bold text-gray-500 mb-2">{selectedDate} のタスク</h3>
          {selectedTasks.length === 0
            ? <div className="text-center py-8 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">この日はタスクがありません</div>
            : <div className="space-y-2">
                {selectedTasks.map(task => (
                  <TaskCard key={task.id} task={task} isAdmin={isAdmin} currentUser={currentUserEmail}
                    onDelete={() => setTasks(p => p.filter(t => t.id !== task.id))}
                    onToggleDone={() => setTasks(p => p.map(t => t.id === task.id ? { ...t, done: !t.done } : t))}
                    onJoin={() => joinTask(task.id)} />
                ))}
              </div>
          }
        </div>

        {/* Task form modal */}
        {showTaskForm && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-end" onClick={() => setShowTaskForm(false)}>
            <div className="bg-white w-full rounded-t-3xl p-6 space-y-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-2" />
              <h3 className="font-black text-gray-900 text-base">タスクを追加 — {selectedDate}</h3>
              <input placeholder="タスク名" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <textarea placeholder="説明（任意）" value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} rows={3}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" />
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2">カラー</p>
                <div className="flex gap-2 flex-wrap">
                  {TASK_COLORS.map(c => (
                    <button key={c} onClick={() => setNewTaskColor(c)}
                      style={{ background: c }}
                      className={`w-7 h-7 rounded-full transition-transform ${newTaskColor === c ? "scale-125 ring-2 ring-offset-1 ring-gray-400" : ""}`} />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">誰でも参加可能</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={newTaskOpen} onChange={e => setNewTaskOpen(e.target.checked)} className="sr-only peer" />
                  <div className="w-10 h-6 bg-gray-200 peer-checked:bg-blue-500 rounded-full transition-colors" />
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
                </label>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2">担当者を追加（任意）</p>
                <div className="flex gap-2">
                  <input placeholder="メールアドレス or 名前" value={newAssigneeInput} onChange={e => setNewAssigneeInput(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  <button onClick={() => { if (newAssigneeInput.trim()) { setNewTaskAssignees(p => [...p, newAssigneeInput.trim()]); setNewAssigneeInput(""); }}}
                    className="bg-blue-100 text-blue-700 font-bold text-xs px-3 rounded-xl">追加</button>
                </div>
                {newTaskAssignees.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {newTaskAssignees.map(a => (
                      <span key={a} className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2 py-1 rounded-full">
                        {a} <button onClick={() => setNewTaskAssignees(p => p.filter(x => x !== a))}><X size={10} /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={addTask} className="w-full bg-blue-600 text-white font-bold py-3 rounded-2xl text-sm hover:bg-blue-700 transition-colors">
                タスクを追加
              </button>
            </div>
          </div>
        )}
      </div>
    );

    // ── Inventory ─────────────────────────────────────────────────────────────
    if (activeTab === "inventory") return (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-gray-900">在庫・設備</h2>
          {isAdmin && (
            <button onClick={() => setShowInvForm(true)}
              className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm shadow-blue-200 hover:bg-blue-700 transition-colors">
              <Plus size={14} /> 追加
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {inventory.map(item => (
            <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="relative">
                {item.isEmoji
                  ? <div className="h-24 bg-gray-50 flex items-center justify-center text-5xl">{item.image}</div>
                  : <img src={item.image} alt={item.name} className="w-full h-24 object-cover" />
                }
                {isAdmin && (
                  <button onClick={() => setInventory(p => p.filter(x => x.id !== item.id))}
                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-white/80 rounded-full flex items-center justify-center text-gray-400 hover:text-red-400">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
              <div className="p-2.5">
                <p className="text-xs font-bold text-gray-800 truncate mb-1.5">{item.name}</p>
                <div className="flex items-center justify-between gap-1">
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${(item.stock / item.total) * 100}%`, background: item.stock === 0 ? "#ef4444" : item.stock < item.total / 2 ? "#f59e0b" : "#3b82f6" }} />
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 shrink-0">{item.stock}/{item.total}</span>
                </div>
                {isAdmin && (
                  <div className="flex gap-1 mt-2">
                    <button onClick={() => setInventory(p => p.map(x => x.id === item.id && x.stock > 0 ? { ...x, stock: x.stock - 1 } : x))}
                      className="flex-1 py-1 bg-red-50 text-red-500 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors">−</button>
                    <button onClick={() => setInventory(p => p.map(x => x.id === item.id && x.stock < x.total ? { ...x, stock: x.stock + 1 } : x))}
                      className="flex-1 py-1 bg-green-50 text-green-600 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors">＋</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Inventory form modal */}
        {showInvForm && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-end" onClick={() => setShowInvForm(false)}>
            <div className="bg-white w-full rounded-t-3xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-2" />
              <h3 className="font-black text-gray-900 text-base">機材を追加</h3>
              <div className="flex flex-col items-center gap-3">
                <button onClick={() => imgInputRef.current?.click()}
                  className="w-full h-32 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-blue-300 hover:bg-blue-50 transition-colors">
                  {newInvImage
                    ? <img src={newInvImage} className="w-full h-full object-cover rounded-2xl" alt="preview" />
                    : <><ImageIcon size={28} className="text-gray-300" /><span className="text-xs text-gray-400">写真をアップロード</span></>
                  }
                </button>
                <input ref={imgInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                {!newInvImage && (
                  <div className="flex items-center gap-2 w-full">
                    <div className="flex-1 h-px bg-gray-200" /><span className="text-xs text-gray-400">または絵文字</span><div className="flex-1 h-px bg-gray-200" />
                  </div>
                )}
                {!newInvImage && (
                  <input placeholder="📷" value={newInvEmoji} onChange={e => setNewInvEmoji(e.target.value)} className="w-20 text-center border border-gray-200 rounded-xl py-2 text-2xl focus:outline-none focus:ring-2 focus:ring-blue-300" />
                )}
              </div>
              {newInvImage && <button onClick={() => setNewInvImage(null)} className="text-xs text-red-500 font-medium">画像を削除</button>}
              <input placeholder="機材名" value={newInvName} onChange={e => setNewInvName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <input type="number" placeholder="総数" min={1} value={newInvTotal} onChange={e => setNewInvTotal(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <button onClick={addInventory} className="w-full bg-blue-600 text-white font-bold py-3 rounded-2xl text-sm hover:bg-blue-700 transition-colors">
                追加
              </button>
            </div>
          </div>
        )}
      </div>
    );

    // ── Wiki ──────────────────────────────────────────────────────────────────
    if (activeTab === "wiki") {
      if (activeWiki) return (
        <WikiPageView page={activeWiki} isAdmin={isAdmin}
          onSave={updated => { setWikis(p => p.map(w => w.id === updated.id ? updated : w)); setActiveWiki(updated); }}
          onBack={() => setActiveWiki(null)} />
      );
      const filteredWikis = wikiFilter === "すべて" ? wikis : wikis.filter(w => w.category === wikiFilter);
      return (
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-gray-900">Wiki</h2>
            {isAdmin && (
              <button onClick={() => setShowWikiForm(true)}
                className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm shadow-blue-200 hover:bg-blue-700 transition-colors">
                <Plus size={14} /> 新規ページ
              </button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {["すべて", ...WIKI_CATEGORIES].map(cat => (
              <button key={cat} onClick={() => setWikiFilter(cat)}
                className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border transition-all
                  ${wikiFilter === cat ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-500 border-gray-200 hover:border-blue-300"}`}>
                {cat}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {filteredWikis.length === 0
              ? <div className="text-center py-8 text-sm text-gray-400 bg-white rounded-2xl border border-gray-100">ページがありません</div>
              : filteredWikis.map(w => (
                <button key={w.id} onClick={() => setActiveWiki(w)}
                  className="w-full bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-left hover:border-blue-200 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Hash size={13} className="text-blue-400 shrink-0" />
                        <span className="font-bold text-sm text-gray-900 truncate">{w.title}</span>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-1 ml-5">{w.content.replace(/#+ /g, "").split("\n").find(l => l.trim() && !l.startsWith("#")) ?? ""}</p>
                      <div className="flex items-center gap-2 mt-1.5 ml-5">
                        <Pill color="#3b82f6">{w.category}</Pill>
                        <span className="text-[10px] text-gray-400">{w.updatedAt}</span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 shrink-0 mt-1" />
                  </div>
                </button>
              ))
            }
          </div>
          {showWikiForm && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-end" onClick={() => setShowWikiForm(false)}>
              <div className="bg-white w-full rounded-t-3xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
                <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-2" />
                <h3 className="font-black text-gray-900 text-base">新規Wikiページ</h3>
                <input placeholder="ページタイトル" value={newWikiTitle} onChange={e => setNewWikiTitle(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <select value={newWikiCat} onChange={e => setNewWikiCat(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">
                  {WIKI_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
                <button onClick={addWiki} className="w-full bg-blue-600 text-white font-bold py-3 rounded-2xl text-sm hover:bg-blue-700 transition-colors">
                  作成して編集
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    // ── Settings ──────────────────────────────────────────────────────────────
    if (activeTab === "settings") return (
      <div className="p-4 space-y-4 pb-8">
        <h2 className="text-xl font-black text-gray-900">設定</h2>

        {/* Profile card */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-4 flex items-center gap-3">
          {userProfile?.avatar_url
            ? <img src={userProfile.avatar_url} alt="Avatar" className="w-14 h-14 rounded-2xl ring-2 ring-white/30" />
            : <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center font-black text-white text-xl">
                {displayName.charAt(0).toUpperCase()}
              </div>
          }
          <div>
            <p className="font-bold text-white text-base">{displayName}</p>
            <p className="text-blue-200 text-xs mt-0.5">{userProfile?.full_name ? "Discord連携済み" : session.user?.email}</p>
            {isAdmin && <span className="text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full mt-1 inline-block">Admin</span>}
          </div>
        </div>

        {/* Settings sections */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100 overflow-hidden">
          <div className="px-4 py-2.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">権限</p>
          </div>
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center">
                <ShieldAlert size={15} className="text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">管理者モード</p>
                <p className="text-xs text-gray-500">タスクや機材の追加・削除が可能</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-checked:bg-amber-500 rounded-full transition-colors" />
              <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
            </label>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100 overflow-hidden">
          <div className="px-4 py-2.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">通知 & PWA</p>
          </div>
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${notifEnabled ? "bg-blue-100" : "bg-gray-100"}`}>
                {notifEnabled ? <Bell size={15} className="text-blue-600" /> : <BellOff size={15} className="text-gray-400" />}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">プッシュ通知</p>
                <p className="text-xs text-gray-500">{notifEnabled ? "通知が有効です" : "タップして通知を有効化"}</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={notifEnabled} onChange={toggleNotifications} className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-checked:bg-blue-500 rounded-full transition-colors" />
              <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
            </label>
          </div>
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center">
              <Smartphone size={15} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">アプリをインストール</p>
              <p className="text-xs text-gray-500">ブラウザの「ホーム画面に追加」からインストール</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100 overflow-hidden">
          <div className="px-4 py-2.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">データ</p>
          </div>
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-purple-100 rounded-xl flex items-center justify-center">
                <Info size={15} className="text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">データ概要</p>
                <p className="text-xs text-gray-500">タスク {tasks.length} · 機材 {inventory.length} · Wiki {wikis.length} ページ</p>
              </div>
            </div>
          </div>
          <button onClick={() => { if (confirm("全データをリセットしますか？")) { setTasks([]); setInventory([]); setWikis([]); }}}
            className="w-full px-4 py-3 flex items-center gap-3 text-red-500 hover:bg-red-50 transition-colors">
            <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center">
              <Trash2 size={15} className="text-red-500" />
            </div>
            <p className="text-sm font-bold">データをリセット</p>
          </button>
        </div>

        <button onClick={handleLogout}
          className="w-full bg-white border border-gray-200 rounded-2xl py-3.5 flex items-center justify-center gap-2 text-red-500 font-bold text-sm hover:bg-red-50 transition-colors shadow-sm">
          <LogOut size={16} /> ログアウト
        </button>

        <p className="text-center text-xs text-gray-400 mt-2">AeroSync v1.0 · 課外活動管理</p>
      </div>
    );

    return null;
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 select-none">

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <h1 className="text-lg font-black tracking-tight"><span className="text-blue-600">Aero</span>Sync</h1>
        <div className="flex items-center gap-2">
          {isAdmin && <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-100">Admin</span>}
          <button onClick={() => setSearchOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
            <Search size={18} className="text-gray-500" />
          </button>
        </div>
      </header>

      {/* Error banner */}
      {errorMessage && (
        <div className="bg-red-50 text-red-700 px-4 py-2.5 text-xs font-medium flex items-start gap-2 border-b border-red-100">
          <ShieldAlert size={14} className="shrink-0 mt-0.5" />
          <span className="flex-1 break-all">{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)}><X size={14} /></button>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 overflow-y-auto pb-24 overscroll-none">
        {renderContent()}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 w-full bg-white/80 backdrop-blur-md border-t border-gray-100 z-30" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
          {([
            { id: "schedule",  Icon: Calendar, label: "予定"  },
            { id: "inventory", Icon: Package,  label: "在庫"  },
            { id: "wiki",      Icon: BookOpen, label: "Wiki"  },
            { id: "settings",  Icon: Settings, label: "設定"  },
          ] as const).map(({ id, Icon, label }) => (
            <button key={id} onClick={() => { setActiveTab(id); setActiveWiki(null); }}
              className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all
                ${activeTab === id ? "text-blue-600 scale-105" : "text-gray-400 hover:text-gray-600"}`}>
              <Icon size={22} strokeWidth={activeTab === id ? 2.5 : 1.8} />
              <span className="text-[10px] font-bold">{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Search overlay */}
      {searchOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex flex-col" onClick={() => setSearchOpen(false)}>
          <div className="bg-white w-full p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 bg-gray-100 rounded-2xl px-4 py-2.5">
              <Search size={18} className="text-gray-400 shrink-0" />
              <input ref={searchRef} value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="タスク、機材、Wikiを検索..."
                className="flex-1 bg-transparent text-sm focus:outline-none text-gray-800 placeholder-gray-400" />
              <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }}>
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-3 space-y-1 max-h-72 overflow-y-auto">
                {searchResults.map((r, i) => (
                  <button key={i} onClick={() => { setActiveTab(r.tab); setSearchOpen(false); setSearchQuery(""); if (r.type === "wiki") { const w = wikis.find(x => x.title === r.label); if (w) setActiveWiki(w); }}}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: r.color + "22" }}>
                      {r.type === "task" ? <Calendar size={14} style={{ color: r.color }} /> :
                       r.type === "inventory" ? <Package size={14} style={{ color: r.color }} /> :
                       <BookOpen size={14} style={{ color: r.color }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{r.label}</p>
                      <p className="text-xs text-gray-400">{r.sub}</p>
                    </div>
                    <ChevronRight size={14} className="text-gray-300 shrink-0" />
                  </button>
                ))}
              </div>
            )}
            {searchQuery.trim().length > 0 && searchResults.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-6">「{searchQuery}」の結果が見つかりません</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
