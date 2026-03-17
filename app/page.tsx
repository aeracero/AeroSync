"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import {
  Calendar, Package, BookOpen, Settings,
  LogOut, Plus, ShieldAlert, ChevronRight, Trash2, Loader2
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Schedule      = { id: number; title: string; date: string };
type InventoryItem = { id: number; name: string; stock: number; total: number; image: string };
type Wiki          = { id: number; title: string; date: string; type: string };
type Tab           = "schedule" | "inventory" | "wiki" | "settings";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const DEFAULT_INVENTORY: InventoryItem[] = [
  { id: 1, name: "一眼レフカメラ", stock: 1, total: 1, image: "📷" },
];

// ─── Small reusable UI components ────────────────────────────────────────────

function AdminForm({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex flex-col gap-2.5">
      <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wide">{label}</p>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 transition ${props.className ?? ""}`}
    />
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl py-2 text-sm font-bold flex justify-center items-center gap-1.5 transition-all"
    >
      <Plus size={15} /> {label}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-gray-400 text-center py-8">{text}</p>;
}

function DiscordIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.031.053a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AppShell() {
  const [isMounted,    setIsMounted]    = useState(false);
  const [session,      setSession]      = useState<any>(undefined); // undefined = loading, null = logged out
  const [isAdmin,      setIsAdmin]      = useState(false);
  const [activeTab,    setActiveTab]    = useState<Tab>("schedule");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [authLoading,  setAuthLoading]  = useState(false);

  const [schedules,        setSchedules]        = useState<Schedule[]>([]);
  const [newScheduleTitle, setNewScheduleTitle] = useState("");
  const [newScheduleDate,  setNewScheduleDate]  = useState("");

  const [inventory,   setInventory]   = useState<InventoryItem[]>([]);
  const [newInvName,  setNewInvName]  = useState("");
  const [newInvTotal, setNewInvTotal] = useState("");
  const [newInvEmoji, setNewInvEmoji] = useState("📦");

  const [wikis,        setWikis]        = useState<Wiki[]>([]);
  const [newWikiTitle, setNewWikiTitle] = useState("");
  const [newWikiType,  setNewWikiType]  = useState("Slide");

  // ── Mount + auth + URL error detection ───────────────────────────────────

  useEffect(() => {
    setIsMounted(true);

    const urlParams   = new URLSearchParams(window.location.search);
    const error       = urlParams.get("error_description") || urlParams.get("error");
    const customError = urlParams.get("auth_error");
    if (error || customError) {
      setErrorMessage(`【認証失敗】 ${error ?? ""} — 詳細: ${customError ?? "なし"}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // FIX: getUser() validates JWT server-side; getSession() can return stale localStorage data
    supabase.auth.getUser().then(({ data: { user }, error: userError }) => {
      if (userError) { setSession(null); return; }
      if (user) {
        supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
      } else {
        setSession(null);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    setSchedules(loadFromStorage<Schedule[]>("club_schedules", []));
    setInventory(loadFromStorage<InventoryItem[]>("club_inventory", DEFAULT_INVENTORY));
    setWikis(loadFromStorage<Wiki[]>("club_wikis", []));

    return () => subscription.unsubscribe();
  }, []);

  // ── Persist to localStorage ───────────────────────────────────────────────

  useEffect(() => {
    if (!isMounted) return;
    localStorage.setItem("club_schedules", JSON.stringify(schedules));
    localStorage.setItem("club_inventory", JSON.stringify(inventory));
    localStorage.setItem("club_wikis",     JSON.stringify(wikis));
  }, [schedules, inventory, wikis, isMounted]);

  // ── Auth ──────────────────────────────────────────────────────────────────

  const handleLogin = async () => {
    setErrorMessage(null);
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (e: any) {
      setErrorMessage(`ログイン開始エラー: ${e.message}`);
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) setErrorMessage(`ログアウトエラー: ${error.message}`);
  };

  // ── Data mutations (all use state setters directly in scope) ─────────────

  const handleAddSchedule = useCallback(() => {
    if (!newScheduleTitle.trim() || !newScheduleDate) return;
    setSchedules(prev => [...prev, { id: Date.now(), title: newScheduleTitle.trim(), date: newScheduleDate }]);
    setNewScheduleTitle(""); setNewScheduleDate("");
  }, [newScheduleTitle, newScheduleDate]);

  const handleAddInventory = useCallback(() => {
    if (!newInvName.trim() || !newInvTotal) return;
    const n = parseInt(newInvTotal, 10);
    if (isNaN(n) || n < 1) return;
    setInventory(prev => [...prev, { id: Date.now(), name: newInvName.trim(), stock: n, total: n, image: newInvEmoji }]);
    setNewInvName(""); setNewInvTotal("");
  }, [newInvName, newInvTotal, newInvEmoji]);

  const handleAddWiki = useCallback(() => {
    if (!newWikiTitle.trim()) return;
    const today = new Date().toISOString().split("T")[0];
    setWikis(prev => [...prev, { id: Date.now(), title: newWikiTitle.trim(), date: today, type: newWikiType }]);
    setNewWikiTitle("");
  }, [newWikiTitle, newWikiType]);

  // FIX: setters called directly — no need to pass them as args
  const deleteSchedule  = useCallback((id: number) => setSchedules(p  => p.filter(x => x.id !== id)), []);
  const deleteInventory = useCallback((id: number) => setInventory(p  => p.filter(x => x.id !== id)), []);
  const deleteWiki      = useCallback((id: number) => setWikis(p      => p.filter(x => x.id !== id)), []);

  // ── Guards ────────────────────────────────────────────────────────────────

  if (!isMounted || session === undefined) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Loader2 size={28} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6 font-sans">
        <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-sm text-center border border-gray-100">
          {errorMessage && (
            <div className="mb-5 bg-red-50 text-red-700 p-3 rounded-xl text-xs font-medium flex items-start gap-2 text-left border border-red-100">
              <ShieldAlert size={15} className="shrink-0 mt-0.5" />
              <span className="break-all">{errorMessage}</span>
            </div>
          )}
          <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-200">
            <span className="text-xl font-extrabold tracking-tight">AS</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-1 tracking-tight">AeroSync</h1>
          <p className="text-sm text-gray-400 mb-8">課外活動をスマートに同期</p>
          <button
            onClick={handleLogin}
            disabled={authLoading}
            className="w-full bg-[#5865F2] hover:bg-[#4752C4] disabled:opacity-60 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2.5 transition-all duration-200 shadow-md shadow-indigo-200"
          >
            {authLoading
              ? <><Loader2 size={18} className="animate-spin" /> 接続中...</>
              : <><DiscordIcon /> Discordでログイン</>
            }
          </button>
        </div>
      </div>
    );
  }

  // ── Authenticated shell ───────────────────────────────────────────────────

  const userProfile = session.user?.user_metadata ?? {};

  const renderContent = () => {
    switch (activeTab) {
      case "schedule":
        return (
          <div className="p-4 space-y-4">
            <h2 className="text-xl font-bold text-gray-900">スケジュール</h2>
            {isAdmin && (
              <AdminForm label="予定を追加">
                <Input type="date" value={newScheduleDate} onChange={e => setNewScheduleDate(e.target.value)} />
                <Input type="text" placeholder="予定のタイトル" value={newScheduleTitle} onChange={e => setNewScheduleTitle(e.target.value)} />
                <AddButton onClick={handleAddSchedule} label="追加" />
              </AdminForm>
            )}
            <div className="space-y-2">
              {schedules.length === 0 ? <EmptyState text="予定がありません" /> : schedules.map(item => (
                <div key={item.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex justify-between items-center shadow-sm">
                  <div>
                    <p className="text-[11px] text-blue-500 font-bold mb-0.5">{item.date}</p>
                    <p className="text-sm font-medium text-gray-800">{item.title}</p>
                  </div>
                  {isAdmin && (
                    <button onClick={() => deleteSchedule(item.id)} className="text-gray-300 hover:text-red-400 transition-colors p-1">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );

      case "inventory":
        return (
          <div className="p-4 space-y-4">
            <h2 className="text-xl font-bold text-gray-900">在庫・設備管理</h2>
            {isAdmin && (
              <AdminForm label="機材を追加">
                <div className="flex gap-2">
                  <Input type="text" placeholder="📷" value={newInvEmoji} onChange={e => setNewInvEmoji(e.target.value)} className="w-14 text-center" />
                  <Input type="text" placeholder="機材名" value={newInvName} onChange={e => setNewInvName(e.target.value)} className="flex-1" />
                </div>
                <Input type="number" placeholder="総数" min={1} value={newInvTotal} onChange={e => setNewInvTotal(e.target.value)} />
                <AddButton onClick={handleAddInventory} label="追加" />
              </AdminForm>
            )}
            <div className="grid grid-cols-2 gap-3">
              {inventory.map(item => (
                <div key={item.id} className="bg-white p-3 rounded-2xl border border-gray-100 flex flex-col items-center text-center relative shadow-sm">
                  {isAdmin && (
                    <button onClick={() => deleteInventory(item.id)} className="absolute top-2 right-2 text-gray-200 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  )}
                  <div className="w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center text-3xl mb-2">{item.image}</div>
                  <p className="text-xs font-bold text-gray-800 line-clamp-2 leading-tight mb-2">{item.name}</p>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full w-full ${
                    item.stock === 0 ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"
                  }`}>
                    残: {item.stock} / {item.total}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );

      case "wiki":
        return (
          <div className="p-4 space-y-4">
            <h2 className="text-xl font-bold text-gray-900">マニュアル & Wiki</h2>
            {isAdmin && (
              <AdminForm label="Wikiを追加">
                <div className="flex gap-2">
                  <select
                    value={newWikiType}
                    onChange={e => setNewWikiType(e.target.value)}
                    className="border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <option value="Slide">Slide</option>
                    <option value="Doc">Doc</option>
                  </select>
                  <Input type="text" placeholder="タイトル" value={newWikiTitle} onChange={e => setNewWikiTitle(e.target.value)} className="flex-1" />
                </div>
                <AddButton onClick={handleAddWiki} label="追加" />
              </AdminForm>
            )}
            <div className="space-y-2">
              {wikis.length === 0 ? <EmptyState text="Wikiがありません" /> : wikis.map(doc => (
                <div key={doc.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm">
                  <div>
                    <span className="text-[11px] text-blue-500 font-bold">{doc.type} · {doc.date}</span>
                    <p className="text-sm font-medium text-gray-800 mt-0.5">{doc.title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <button onClick={() => deleteWiki(doc.id)} className="text-gray-300 hover:text-red-400 transition-colors p-1">
                        <Trash2 size={15} />
                      </button>
                    )}
                    <ChevronRight size={18} className="text-gray-300" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case "settings":
        return (
          <div className="p-4 space-y-4">
            <h2 className="text-xl font-bold text-gray-900">設定・アカウント</h2>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm divide-y divide-gray-100">
              <div className="p-4 flex items-center gap-3">
                {userProfile?.avatar_url ? (
                  <img src={userProfile.avatar_url} alt="Avatar" className="w-11 h-11 rounded-full ring-2 ring-blue-100" />
                ) : (
                  <div className="w-11 h-11 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-base">
                    {(userProfile?.full_name as string)?.charAt(0) ?? "U"}
                  </div>
                )}
                <div>
                  <p className="font-bold text-gray-900 text-sm">{userProfile?.full_name ?? "ユーザー"}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Discord 連携済み</p>
                </div>
              </div>
              <div className="p-4 flex items-center justify-between bg-amber-50">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={16} className="text-amber-500" />
                  <span className="text-sm font-bold text-amber-800">管理者モード</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} className="sr-only peer" />
                  <div className="w-10 h-6 bg-gray-200 peer-checked:bg-amber-500 rounded-full transition-colors" />
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
                </label>
              </div>
              <button
                onClick={handleLogout}
                className="w-full p-4 flex items-center gap-3 text-red-500 hover:bg-red-50 transition-colors text-sm font-bold"
              >
                <LogOut size={16} /> ログアウト
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-lg font-extrabold tracking-tight">
          <span className="text-blue-600">Aero</span>Sync
        </h1>
        {isAdmin && (
          <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-blue-100">
            Admin
          </span>
        )}
      </header>

      {errorMessage && (
        <div className="bg-red-50 text-red-700 px-4 py-2.5 text-xs font-medium flex items-start gap-2 border-b border-red-100">
          <ShieldAlert size={14} className="shrink-0 mt-0.5" />
          <span className="break-all">{errorMessage}</span>
        </div>
      )}

      <main className="flex-1 overflow-y-auto pb-24">
        {renderContent()}
      </main>

      <nav className="fixed bottom-0 w-full bg-white border-t border-gray-100 pb-safe z-20">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
          {([
            { id: "schedule",  Icon: Calendar, label: "予定"  },
            { id: "inventory", Icon: Package,  label: "在庫"  },
            { id: "wiki",      Icon: BookOpen, label: "Wiki"  },
            { id: "settings",  Icon: Settings, label: "設定"  },
          ] as const).map(({ id, Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors
                ${activeTab === id ? "text-blue-600" : "text-gray-400 hover:text-gray-600"}`}
            >
              <Icon size={22} strokeWidth={activeTab === id ? 2.5 : 1.8} />
              <span className="text-[10px] font-bold">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
