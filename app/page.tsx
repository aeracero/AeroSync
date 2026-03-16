"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { 
  Calendar, Package, BookOpen, Settings, 
  LogOut, Plus, ShieldAlert, ChevronRight, Trash2
} from "lucide-react";

export default function AppShellV0() {
  const [isMounted, setIsMounted] = useState(false);
  const [session, setSession] = useState<any>(null); // Discordのログイン情報を保持
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState("schedule");

  const [schedules, setSchedules] = useState<{id: number, title: string, date: string}[]>([]);
  const [newScheduleTitle, setNewScheduleTitle] = useState("");
  const [newScheduleDate, setNewScheduleDate] = useState("");

  const [inventory, setInventory] = useState<{id: number, name: string, stock: number, total: number, image: string}[]>([]);
  const [newInvName, setNewInvName] = useState("");
  const [newInvTotal, setNewInvTotal] = useState("");
  const [newInvEmoji, setNewInvEmoji] = useState("📦");

  const [wikis, setWikis] = useState<{id: number, title: string, date: string, type: string}[]>([]);
  const [newWikiTitle, setNewWikiTitle] = useState("");
  const [newWikiType, setNewWikiType] = useState("Slide");

  useEffect(() => {
    setIsMounted(true);
    
    // Supabaseのログイン状態を監視
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // ローカルストレージからのデータ読み込み（モック用）
    const savedSchedules = localStorage.getItem("club_schedules");
    const savedInventory = localStorage.getItem("club_inventory");
    const savedWikis = localStorage.getItem("club_wikis");

    if (savedSchedules) setSchedules(JSON.parse(savedSchedules));
    if (savedInventory) setInventory(JSON.parse(savedInventory));
    else setInventory([{ id: 1, name: "一眼レフカメラ", stock: 1, total: 1, image: "📷" }]);
    if (savedWikis) setWikis(JSON.parse(savedWikis));

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("club_schedules", JSON.stringify(schedules));
      localStorage.setItem("club_inventory", JSON.stringify(inventory));
      localStorage.setItem("club_wikis", JSON.stringify(wikis));
    }
  }, [schedules, inventory, wikis, isMounted]);

  // --- Discord ログイン・ログアウト処理 ---
const handleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          //redirectTo: window.location.origin + '/auth/callback' // ここを修正
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
      if (error) throw error;
    } catch (error: any) {
      alert("ログインエラーが発生しました: " + error.message);
      console.error(error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // --- 追加・削除のロジック ---
  const handleAddSchedule = () => {
    if (!newScheduleTitle || !newScheduleDate) return;
    setSchedules([...schedules, { id: Date.now(), title: newScheduleTitle, date: newScheduleDate }]);
    setNewScheduleTitle(""); setNewScheduleDate("");
  };

  const handleAddInventory = () => {
    if (!newInvName || !newInvTotal) return;
    const totalNum = parseInt(newInvTotal, 10);
    setInventory([...inventory, { id: Date.now(), name: newInvName, stock: totalNum, total: totalNum, image: newInvEmoji }]);
    setNewInvName(""); setNewInvTotal("");
  };

  const handleAddWiki = () => {
    if (!newWikiTitle) return;
    const today = new Date().toISOString().split('T')[0];
    setWikis([...wikis, { id: Date.now(), title: newWikiTitle, date: today, type: newWikiType }]);
    setNewWikiTitle("");
  };

  const deleteItem = (setter: any, data: any[], id: number) => {
    setter(data.filter(item => item.id !== id));
  };

  if (!isMounted) return null;

  // --- 1. ログイン画面 ---
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-6 font-sans">
        <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-md">
            <span className="text-2xl font-bold">Aero</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">AeroSync</h1>
          <p className="text-sm text-gray-500 mb-8">課外活動をスマートに同期</p>
          <button onClick={handleLogin} className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors duration-200">
            Discordでログイン
          </button>
        </div>
      </div>
    );
  }

  const userProfile = session.user.user_metadata;

  // --- 2. メイン画面 ---
  const renderContent = () => {
    switch (activeTab) {
      case "schedule":
        return (
          <div className="p-4 space-y-4">
            <h2 className="text-xl font-bold text-gray-800">スケジュール & 進捗</h2>
            {isAdmin && (
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-2">
                <p className="text-xs font-bold text-blue-600">予定を追加 (管理者のみ)</p>
                <input type="date" value={newScheduleDate} onChange={e => setNewScheduleDate(e.target.value)} className="border rounded-lg p-2 text-sm" />
                <input type="text" placeholder="予定のタイトル" value={newScheduleTitle} onChange={e => setNewScheduleTitle(e.target.value)} className="border rounded-lg p-2 text-sm" />
                <button onClick={handleAddSchedule} className="bg-blue-600 text-white rounded-lg p-2 text-sm font-bold flex justify-center items-center gap-1"><Plus size={16} /> 追加</button>
              </div>
            )}
            <div className="space-y-2">
              {schedules.map(item => (
                <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-blue-600 font-bold">{item.date}</p>
                    <p className="text-sm font-medium text-gray-800">{item.title}</p>
                  </div>
                  {isAdmin && <button onClick={() => deleteItem(setSchedules, schedules, item.id)} className="text-red-400"><Trash2 size={18} /></button>}
                </div>
              ))}
              {schedules.length === 0 && <p className="text-sm text-gray-400 text-center py-4">予定がありません</p>}
            </div>
          </div>
        );

      case "inventory":
        return (
          <div className="p-4 space-y-4">
            <h2 className="text-xl font-bold text-gray-800">在庫・設備管理</h2>
            {isAdmin && (
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-2">
                <p className="text-xs font-bold text-blue-600">機材を追加 (管理者のみ)</p>
                <div className="flex gap-2">
                  <input type="text" placeholder="絵文字(📷など)" value={newInvEmoji} onChange={e => setNewInvEmoji(e.target.value)} className="border rounded-lg p-2 text-sm w-16 text-center" />
                  <input type="text" placeholder="機材名" value={newInvName} onChange={e => setNewInvName(e.target.value)} className="border rounded-lg p-2 text-sm flex-1" />
                </div>
                <input type="number" placeholder="総数" value={newInvTotal} onChange={e => setNewInvTotal(e.target.value)} className="border rounded-lg p-2 text-sm" />
                <button onClick={handleAddInventory} className="bg-blue-600 text-white rounded-lg p-2 text-sm font-bold flex justify-center items-center gap-1"><Plus size={16} /> 追加</button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {inventory.map(item => (
                <div key={item.id} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center relative">
                  {isAdmin && <button onClick={() => deleteItem(setInventory, inventory, item.id)} className="absolute top-2 right-2 text-gray-300 hover:text-red-400"><Trash2 size={14} /></button>}
                  <div className="w-16 h-16 bg-gray-50 rounded-lg flex items-center justify-center text-3xl mb-2">{item.image}</div>
                  <p className="text-xs font-bold text-gray-800 line-clamp-2 h-8">{item.name}</p>
                  <div className="mt-2 text-[10px] font-bold px-2 py-1 rounded-full bg-green-100 text-green-700 w-full">残: {item.stock} / {item.total}</div>
                </div>
              ))}
            </div>
          </div>
        );

      case "wiki":
        return (
          <div className="p-4 space-y-4">
            <h2 className="text-xl font-bold text-gray-800">マニュアル & Wiki</h2>
            {isAdmin && (
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-2">
                <p className="text-xs font-bold text-blue-600">Wikiを追加 (管理者のみ)</p>
                <div className="flex gap-2">
                  <select value={newWikiType} onChange={e => setNewWikiType(e.target.value)} className="border rounded-lg p-2 text-sm bg-white">
                    <option value="Slide">Slide</option>
                    <option value="Doc">Doc</option>
                  </select>
                  <input type="text" placeholder="タイトル" value={newWikiTitle} onChange={e => setNewWikiTitle(e.target.value)} className="border rounded-lg p-2 text-sm flex-1" />
                </div>
                <button onClick={handleAddWiki} className="bg-blue-600 text-white rounded-lg p-2 text-sm font-bold flex justify-center items-center gap-1"><Plus size={16} /> 追加</button>
              </div>
            )}
            <div className="space-y-2">
              {wikis.map(doc => (
                <div key={doc.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs text-blue-600 font-bold mb-1">{doc.type} • {doc.date}</span>
                    <span className="text-sm font-medium text-gray-800">{doc.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && <button onClick={() => deleteItem(setWikis, wikis, doc.id)} className="text-red-400"><Trash2 size={16} /></button>}
                    <ChevronRight size={20} className="text-gray-400" />
                  </div>
                </div>
              ))}
              {wikis.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Wikiがありません</p>}
            </div>
          </div>
        );

      case "settings":
        return (
          <div className="p-4 space-y-6">
            <h2 className="text-xl font-bold text-gray-800">設定・アカウント</h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                {/* ログインしたDiscordのアイコン画像を表示 */}
                {userProfile?.avatar_url ? (
                  <img src={userProfile.avatar_url} alt="User Avatar" className="w-10 h-10 rounded-full shadow-sm" />
                ) : (
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold">
                    {userProfile?.full_name?.charAt(0) || "U"}
                  </div>
                )}
                <div>
                  <p className="font-bold text-gray-800">{userProfile?.full_name || "ユーザー"}</p>
                  <p className="text-xs text-gray-500">Discord連携済み</p>
                </div>
              </div>
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-yellow-50">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={18} className="text-yellow-600" />
                  <span className="text-sm font-bold text-yellow-800">管理者モード</span>
                </div>
                <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} className="w-5 h-5 accent-yellow-600" />
              </div>
              <button onClick={handleLogout} className="w-full p-4 flex items-center gap-3 text-red-600 hover:bg-red-50 transition-colors text-sm font-bold">
                <LogOut size={18} /> ログアウト
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
      <header className="bg-white text-gray-800 p-4 shadow-sm flex items-center justify-between z-10 relative">
        <h1 className="text-lg font-extrabold tracking-tight"><span className="text-blue-600">Aero</span>Sync</h1>
        {isAdmin && <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-1 rounded-full">Admin</span>}
      </header>
      <main className="flex-1 overflow-y-auto pb-24">
        {renderContent()}
      </main>
      <nav className="fixed bottom-0 w-full bg-white border-t border-gray-200 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.04)] z-20">
        <div className="flex justify-around items-center h-16">
          <button onClick={() => setActiveTab("schedule")} className={`flex flex-col items-center justify-center w-full h-full ${activeTab === "schedule" ? "text-blue-600" : "text-gray-400"}`}>
            <Calendar size={22} />
            <span className="text-[10px] mt-1 font-bold">予定</span>
          </button>
          <button onClick={() => setActiveTab("inventory")} className={`flex flex-col items-center justify-center w-full h-full ${activeTab === "inventory" ? "text-blue-600" : "text-gray-400"}`}>
            <Package size={22} />
            <span className="text-[10px] mt-1 font-bold">在庫</span>
          </button>
          <button onClick={() => setActiveTab("wiki")} className={`flex flex-col items-center justify-center w-full h-full ${activeTab === "wiki" ? "text-blue-600" : "text-gray-400"}`}>
            <BookOpen size={22} />
            <span className="text-[10px] mt-1 font-bold">Wiki</span>
          </button>
          <button onClick={() => setActiveTab("settings")} className={`flex flex-col items-center justify-center w-full h-full ${activeTab === "settings" ? "text-blue-600" : "text-gray-400"}`}>
            <Settings size={22} />
            <span className="text-[10px] mt-1 font-bold">設定</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
