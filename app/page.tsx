"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "../lib/supabase/client";
import {
  Calendar, Package, BookOpen, Settings,
  LogOut, Plus, ShieldAlert, ChevronRight, Trash2, Loader2, Mail, Lock, Eye, EyeOff, User
} from "lucide-react";

type Schedule      = { id: number; title: string; date: string };
type InventoryItem = { id: number; name: string; stock: number; total: number; image: string };
type Wiki          = { id: number; title: string; date: string; type: string };
type Tab           = "schedule" | "inventory" | "wiki" | "settings";
type AuthMode      = "login" | "signup" | "check_email";

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

const DEFAULT_INVENTORY: InventoryItem[] = [
  { id: 1, name: "一眼レフカメラ", stock: 1, total: 1, image: "📷" },
];

// ─── Tiny UI atoms ────────────────────────────────────────────────────────────

function DiscordIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.031.053a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
    </svg>
  );
}

function AdminForm({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex flex-col gap-2.5">
      <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wide">{label}</p>
      {children}
    </div>
  );
}

function AppInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 transition ${props.className ?? ""}`}
    />
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl py-2 text-sm font-bold flex justify-center items-center gap-1.5 transition-all">
      <Plus size={15} /> {label}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-gray-400 text-center py-8">{text}</p>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AppShell() {
  const [isMounted,    setIsMounted]    = useState(false);
  const [session,      setSession]      = useState<any>(undefined); // undefined=loading
  const [isAdmin,      setIsAdmin]      = useState(false);
  const [activeTab,    setActiveTab]    = useState<Tab>("schedule");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auth form state
  const [authMode,     setAuthMode]     = useState<AuthMode>("login");
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [showPw,       setShowPw]       = useState(false);
  const [authLoading,  setAuthLoading]  = useState(false);
  const [authError,    setAuthError]    = useState<string | null>(null);

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

  useEffect(() => {
    setIsMounted(true);
    // Use the factory — never a module-level singleton
    const supabase = createClient();

    const urlParams   = new URLSearchParams(window.location.search);
    const error       = urlParams.get("error_description") || urlParams.get("error");
    const customError = urlParams.get("auth_error");
    if (error || customError) {
      setErrorMessage(`【認証失敗】 ${error ?? ""} — 詳細: ${customError ?? "なし"}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    supabase.auth.getUser().then(({ data: { user }, error: userError }) => {
      if (userError) { setSession(null); return; }
      if (user) {
        supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s));
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

  useEffect(() => {
    if (!isMounted) return;
    localStorage.setItem("club_schedules", JSON.stringify(schedules));
    localStorage.setItem("club_inventory", JSON.stringify(inventory));
    localStorage.setItem("club_wikis",     JSON.stringify(wikis));
  }, [schedules, inventory, wikis, isMounted]);

  // ── Auth handlers ─────────────────────────────────────────────────────────

  const handleDiscordLogin = async () => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (e: any) {
      setAuthError(e.message);
      setAuthLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) { setAuthError("メールとパスワードを入力してください"); return; }
    setAuthError(null);
    setAuthLoading(true);
    try {
      const supabase = createClient();
      if (authMode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        setAuthMode("check_email");
      }
    } catch (e: any) {
      setAuthError(e.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) setErrorMessage(`ログアウトエラー: ${error.message}`);
  };

  // ── Data handlers ─────────────────────────────────────────────────────────

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

  const deleteSchedule  = useCallback((id: number) => setSchedules(p  => p.filter(x => x.id !== id)), []);
  const deleteInventory = useCallback((id: number) => setInventory(p  => p.filter(x => x.id !== id)), []);
  const deleteWiki      = useCallback((id: number) => setWikis(p      => p.filter(x => x.id !== id)), []);

  // ── Loading ────────────────────────────────────────────────────────────────

  if (!isMounted || session === undefined) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#f0f2f8]">
        <Loader2 size={28} className="animate-spin text-blue-500" />
      </div>
    );
  }

  // ── Login / signup screen ──────────────────────────────────────────────────

  if (!session) {
    return (
      <div className="min-h-screen bg-[#f0f2f8] flex items-center justify-center p-4 font-sans">
        {/* Subtle grid pattern background */}
        <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage: 'radial-gradient(circle, #3b5bdb 1px, transparent 1px)', backgroundSize: '28px 28px'}} />

        <div className="relative w-full max-w-sm">
          {/* Card */}
          <div className="bg-white rounded-3xl shadow-2xl shadow-blue-100/60 border border-white overflow-hidden">

            {/* Header band */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-8 pt-10 pb-8 text-center">
              <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4 ring-2 ring-white/30">
                <span className="text-white text-xl font-black tracking-tight">AS</span>
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight mb-1">AeroSync</h1>
              <p className="text-blue-200 text-sm">課外活動をスマートに同期</p>
            </div>

            <div className="px-8 py-7">

              {/* OAuth error from URL */}
              {errorMessage && (
                <div className="mb-5 bg-red-50 text-red-600 p-3 rounded-xl text-xs font-medium flex items-start gap-2 border border-red-100">
                  <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                  <span className="break-all">{errorMessage}</span>
                </div>
              )}

              {/* Check email state */}
              {authMode === "check_email" ? (
                <div className="text-center py-4">
                  <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Mail size={24} className="text-blue-500" />
                  </div>
                  <h2 className="font-bold text-gray-900 mb-2">メールを確認してください</h2>
                  <p className="text-sm text-gray-500 mb-5">確認メールを <span className="font-medium text-gray-700">{email}</span> に送信しました。リンクをクリックしてアカウントを有効化してください。</p>
                  <button onClick={() => { setAuthMode("login"); setEmail(""); setPassword(""); }} className="text-sm text-blue-600 font-medium hover:underline">
                    ログイン画面に戻る
                  </button>
                </div>
              ) : (
                <>
                  {/* Tab switcher */}
                  <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
                    {(["login", "signup"] as const).map(mode => (
                      <button key={mode} onClick={() => { setAuthMode(mode); setAuthError(null); }}
                        className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-all ${authMode === mode ? "bg-white text-gray-900 shadow-sm" : "text-gray-400"}`}>
                        {mode === "login" ? "ログイン" : "新規登録"}
                      </button>
                    ))}
                  </div>

                  {/* Auth error */}
                  {authError && (
                    <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-xl text-xs font-medium border border-red-100">
                      {authError}
                    </div>
                  )}

                  {/* Email form */}
                  <div className="space-y-3 mb-4">
                    <div className="relative">
                      <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="email"
                        placeholder="メールアドレス"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleEmailAuth()}
                        className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 transition bg-gray-50 focus:bg-white"
                      />
                    </div>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type={showPw ? "text" : "password"}
                        placeholder="パスワード"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleEmailAuth()}
                        className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 transition bg-gray-50 focus:bg-white"
                      />
                      <button onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleEmailAuth}
                    disabled={authLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md shadow-blue-200 mb-4"
                  >
                    {authLoading ? <Loader2 size={16} className="animate-spin" /> : <User size={16} />}
                    {authMode === "login" ? "メールでログイン" : "アカウント作成"}
                  </button>

                  {/* Divider */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400 font-medium">または</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>

                  {/* Discord OAuth */}
                  <button
                    onClick={handleDiscordLogin}
                    disabled={authLoading}
                    className="w-full bg-[#5865F2] hover:bg-[#4752C4] disabled:opacity-60 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] shadow-md shadow-indigo-200"
                  >
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
                <AppInput type="date" value={newScheduleDate} onChange={e => setNewScheduleDate(e.target.value)} />
                <AppInput type="text" placeholder="予定のタイトル" value={newScheduleTitle} onChange={e => setNewScheduleTitle(e.target.value)} />
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
                  <AppInput type="text" placeholder="📷" value={newInvEmoji} onChange={e => setNewInvEmoji(e.target.value)} className="w-14 text-center" />
                  <AppInput type="text" placeholder="機材名" value={newInvName} onChange={e => setNewInvName(e.target.value)} className="flex-1" />
                </div>
                <AppInput type="number" placeholder="総数" min={1} value={newInvTotal} onChange={e => setNewInvTotal(e.target.value)} />
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
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full w-full ${item.stock === 0 ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}>
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
                  <select value={newWikiType} onChange={e => setNewWikiType(e.target.value)}
                    className="border border-gray-200 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    <option value="Slide">Slide</option>
                    <option value="Doc">Doc</option>
                  </select>
                  <AppInput type="text" placeholder="タイトル" value={newWikiTitle} onChange={e => setNewWikiTitle(e.target.value)} className="flex-1" />
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
                    {(userProfile?.full_name as string)?.charAt(0) ?? (session.user?.email?.[0]?.toUpperCase() ?? "U")}
                  </div>
                )}
                <div>
                  <p className="font-bold text-gray-900 text-sm">{userProfile?.full_name ?? session.user?.email ?? "ユーザー"}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{userProfile?.full_name ? "Discord 連携済み" : "メール認証済み"}</p>
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
              <button onClick={handleLogout} className="w-full p-4 flex items-center gap-3 text-red-500 hover:bg-red-50 transition-colors text-sm font-bold">
                <LogOut size={16} /> ログアウト
              </button>
            </div>
          </div>
        );

      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-lg font-extrabold tracking-tight"><span className="text-blue-600">Aero</span>Sync</h1>
        {isAdmin && <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-blue-100">Admin</span>}
      </header>
      {errorMessage && (
        <div className="bg-red-50 text-red-700 px-4 py-2.5 text-xs font-medium flex items-start gap-2 border-b border-red-100">
          <ShieldAlert size={14} className="shrink-0 mt-0.5" /><span className="break-all">{errorMessage}</span>
        </div>
      )}
      <main className="flex-1 overflow-y-auto pb-24">{renderContent()}</main>
      <nav className="fixed bottom-0 w-full bg-white border-t border-gray-100 pb-safe z-20">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
          {([
            { id: "schedule",  Icon: Calendar, label: "予定"  },
            { id: "inventory", Icon: Package,  label: "在庫"  },
            { id: "wiki",      Icon: BookOpen, label: "Wiki"  },
            { id: "settings",  Icon: Settings, label: "設定"  },
          ] as const).map(({ id, Icon, label }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${activeTab === id ? "text-blue-600" : "text-gray-400 hover:text-gray-600"}`}>
              <Icon size={22} strokeWidth={activeTab === id ? 2.5 : 1.8} />
              <span className="text-[10px] font-bold">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
