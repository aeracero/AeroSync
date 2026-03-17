"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Calendar, Package, BookOpen, Settings, LogOut, Plus, ShieldAlert,
  ChevronRight, Trash2, Loader2, Mail, Lock, Eye, EyeOff, User,
  Search, X, Bell, BellOff, ChevronLeft, Edit2, Save,
  UserPlus, Check, Image as ImageIcon, Hash, ArrowLeft,
  Smartphone, Info, Users, MessageCircle, Send, Bot, Sparkles,
  Clock, MapPin, CheckSquare, BarChart2, Star, TrendingUp, Zap
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = "schedule" | "inventory" | "wiki" | "settings" | "chat";
type AuthMode = "login" | "signup" | "check_email";
type Task = { id: string; title: string; date: string; description: string; assignees: string[]; openJoin: boolean; color: string; done: boolean; priority: "low"|"medium"|"high"; location?: string; };
type Availability = { userId: string; name: string; date: string; status: "available"|"maybe"|"unavailable"; note: string; };
type InventoryItem = { id: string; name: string; stock: number; total: number; image: string; isEmoji: boolean; category: string; };
type WikiPage = { id: string; title: string; content: string; category: string; updatedAt: string; author: string; views: number; };
type AdminRecord = { email: string; grantedBy: string; grantedAt: string; };
type ChatMessage = { role: "user"|"assistant"; content: string; ts: number; };

// ─── Constants ────────────────────────────────────────────────────────────────
const TASK_COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#84cc16"];
const WIKI_CATS = ["一般","機材","手順","ルール","メモ"];
const INV_CATS = ["カメラ","音響","照明","その他"];
const AVAIL_COLORS = { available:"#10b981", maybe:"#f59e0b", unavailable:"#ef4444" } as const;
const AVAIL_LABELS = { available:"参加可", maybe:"未定", unavailable:"不参加" } as const;

function loadLS<T>(k: string, fb: T): T { try { const r=localStorage.getItem(k); return r?JSON.parse(r):fb; } catch { return fb; } }
function saveLS(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
function registerSW() { if (typeof window!=="undefined"&&"serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(()=>{}); }
async function reqNotif(): Promise<boolean> { if (!("Notification" in window)) return false; if (Notification.permission==="granted") return true; return (await Notification.requestPermission())==="granted"; }

// ─── Animation CSS ────────────────────────────────────────────────────────────
const fadeIn = "animate-[fadeIn_0.3s_ease-out]";
const slideUp = "animate-[slideUp_0.35s_cubic-bezier(0.34,1.56,0.64,1)]";
const pulse = "animate-[pulse_2s_ease-in-out_infinite]";

// ─── Micro components ─────────────────────────────────────────────────────────
function DiscordIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.031.053a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>;
}

function Pill({ color, children }: { color?: string; children: React.ReactNode }) {
  return <span style={{ background:color?color+"22":undefined, color, border:`1px solid ${color}44` }} className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">{children}</span>;
}

function Toggle({ checked, onChange, color="bg-blue-500" }: { checked: boolean; onChange: (v:boolean)=>void; color?: string }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer" onClick={e=>e.stopPropagation()}>
      <input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} className="sr-only peer" />
      <div className={`w-11 h-6 bg-gray-200 peer-checked:${color} rounded-full transition-all duration-300`} />
      <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 peer-checked:translate-x-5" />
    </label>
  );
}

// ─── Calendar ─────────────────────────────────────────────────────────────────
function CalendarView({ tasks, availability, onDayClick, selectedDate }: {
  tasks: Task[]; availability: Availability[]; onDayClick: (d:string)=>void; selectedDate: string;
}) {
  const [vd, setVd] = useState(new Date());
  const yr=vd.getFullYear(), mo=vd.getMonth();
  const fd=new Date(yr,mo,1).getDay(), dim=new Date(yr,mo+1,0).getDate();
  const today=new Date().toISOString().split("T")[0];

  function ds(d:number){ return `${yr}-${String(mo+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`; }

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${fadeIn}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <button onClick={()=>setVd(new Date(yr,mo-1))} className="p-1.5 rounded-xl hover:bg-gray-100 transition-all active:scale-90">
          <ChevronLeft size={16} className="text-gray-500" />
        </button>
        <span className="font-bold text-sm text-gray-800">{yr}年 {mo+1}月</span>
        <button onClick={()=>setVd(new Date(yr,mo+1))} className="p-1.5 rounded-xl hover:bg-gray-100 transition-all active:scale-90">
          <ChevronRight size={16} className="text-gray-500" />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center px-1 pb-2">
        {["日","月","火","水","木","金","土"].map((d,i)=>(
          <div key={d} className={`py-2 text-[10px] font-bold ${i===0?"text-red-400":i===6?"text-blue-400":"text-gray-400"}`}>{d}</div>
        ))}
        {Array.from({length:fd}).map((_,i)=><div key={`b${i}`}/>)}
        {Array.from({length:dim},(_,i)=>i+1).map(d=>{
          const s=ds(d), dt=tasks.filter(t=>t.date===s), av=availability.filter(a=>a.date===s);
          const isSel=s===selectedDate, isT=s===today;
          return (
            <button key={d} onClick={()=>onDayClick(s)}
              className={`relative py-1.5 mx-0.5 my-0.5 rounded-xl text-xs font-medium transition-all duration-200 active:scale-90
                ${isSel?"bg-blue-600 text-white shadow-md shadow-blue-200":isT?"bg-blue-50 text-blue-600 font-bold":"text-gray-700 hover:bg-gray-50"}`}>
              {d}
              {(dt.length>0||av.length>0) && (
                <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                  {dt.slice(0,2).map(t=><div key={t.id} style={{background:isSel?"white":t.color}} className="w-1 h-1 rounded-full"/>)}
                  {av.length>0 && <div style={{background:isSel?"white":"#10b981"}} className="w-1 h-1 rounded-full"/>}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Wiki page view ───────────────────────────────────────────────────────────
function WikiPageView({ page, isAdmin, onSave, onBack }: { page: WikiPage; isAdmin: boolean; onSave:(p:WikiPage)=>void; onBack:()=>void; }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(page.title);
  const [content, setContent] = useState(page.content);
  const [category, setCategory] = useState(page.category);

  function save() { onSave({...page,title,content,category,updatedAt:new Date().toISOString().split("T")[0],views:page.views+1}); setEditing(false); }

  return (
    <div className={`flex flex-col h-full ${fadeIn}`}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
        <button onClick={onBack} className="p-1.5 rounded-xl hover:bg-gray-100 transition-all active:scale-90"><ArrowLeft size={18} className="text-gray-600"/></button>
        <div className="flex-1 min-w-0">
          {editing ? <input value={title} onChange={e=>setTitle(e.target.value)} className="w-full text-base font-bold border-b border-blue-300 focus:outline-none bg-transparent"/>
            : <h2 className="text-base font-bold text-gray-900 truncate">{page.title}</h2>}
        </div>
        {isAdmin && (editing
          ? <button onClick={save} className="flex items-center gap-1 text-xs font-bold text-white bg-blue-600 px-3 py-1.5 rounded-xl transition-all active:scale-95"><Save size={13}/> 保存</button>
          : <button onClick={()=>setEditing(true)} className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl transition-all active:scale-95"><Edit2 size={13}/> 編集</button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center gap-2 mb-4">
          {editing ? <select value={category} onChange={e=>setCategory(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-300">{WIKI_CATS.map(c=><option key={c}>{c}</option>)}</select>
            : <Pill color="#3b82f6">{page.category}</Pill>}
          <span className="text-[10px] text-gray-400">更新: {page.updatedAt} · 👁 {page.views}</span>
        </div>
        {editing
          ? <textarea value={content} onChange={e=>setContent(e.target.value)} rows={20} className="w-full text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none font-mono"/>
          : <div className="space-y-1">
              {content.split("\n").map((line,i)=>{
                if(line.startsWith("# ")) return <h1 key={i} className="text-xl font-black text-gray-900 mt-4 mb-2">{line.slice(2)}</h1>;
                if(line.startsWith("## ")) return <h2 key={i} className="text-lg font-bold text-gray-800 mt-3 mb-1 border-b border-gray-100 pb-1">{line.slice(3)}</h2>;
                if(line.startsWith("### ")) return <h3 key={i} className="text-base font-bold text-gray-700 mt-2 mb-1">{line.slice(4)}</h3>;
                if(line.startsWith("- ")) return <li key={i} className="text-sm text-gray-600 ml-4 my-0.5 list-disc">{line.slice(2)}</li>;
                if(line.startsWith("> ")) return <blockquote key={i} className="border-l-2 border-blue-300 pl-3 text-sm text-gray-500 italic my-1">{line.slice(2)}</blockquote>;
                if(line==="") return <div key={i} className="h-3"/>;
                return <p key={i} className="text-sm text-gray-700 leading-relaxed">{line}</p>;
              })}
            </div>
        }
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AppShell() {
  const [isMounted, setIsMounted] = useState(false);
  const [session, setSession] = useState<any>(undefined);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("schedule");
  const [errorMessage, setErrorMessage] = useState<string|null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string|null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [notifEnabled, setNotifEnabled] = useState(false);

  // Schedule
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTask, setNewTask] = useState({ title:"", desc:"", color:TASK_COLORS[0], open:true, assignees:[] as string[], priority:"medium" as Task["priority"], location:"" });
  const [newAssignee, setNewAssignee] = useState("");
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [myAvailStatus, setMyAvailStatus] = useState<Availability["status"]|null>(null);
  const [availNote, setAvailNote] = useState("");

  // Inventory
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [showInvForm, setShowInvForm] = useState(false);
  const [newInv, setNewInv] = useState({ name:"", total:"", emoji:"📦", image:null as string|null, category:INV_CATS[0] });
  const imgRef = useRef<HTMLInputElement>(null);

  // Wiki
  const [wikis, setWikis] = useState<WikiPage[]>([]);
  const [activeWiki, setActiveWiki] = useState<WikiPage|null>(null);
  const [showWikiForm, setShowWikiForm] = useState(false);
  const [newWiki, setNewWiki] = useState({ title:"", cat:WIKI_CATS[0] });
  const [wikiFilter, setWikiFilter] = useState("すべて");

  // Admins
  const [adminList, setAdminList] = useState<AdminRecord[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const currentUserEmail = session?.user?.email ?? session?.user?.user_metadata?.full_name ?? "me";

  useEffect(() => {
    setIsMounted(true);
    registerSW();
    const supabase = createClient();
    const urlParams = new URLSearchParams(window.location.search);
    const err = urlParams.get("error_description")||urlParams.get("error");
    const cerr = urlParams.get("auth_error");
    if (err||cerr) { setErrorMessage(`【認証失敗】${err??""} — 詳細: ${cerr??"なし"}`); window.history.replaceState({},document.title,window.location.pathname); }
    const tab = urlParams.get("tab") as Tab|null;
    if (tab) setActiveTab(tab);

    supabase.auth.getUser().then(({data:{user},error:ue})=>{
      if(ue){setSession(null);return;}
      if(user) supabase.auth.getSession().then(({data:{session:s}})=>setSession(s));
      else setSession(null);
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_,s)=>setSession(s));

    setTasks(loadLS("as_tasks",[]));
    setInventory(loadLS("as_inventory",[{id:"1",name:"一眼レフカメラ",stock:1,total:1,image:"📷",isEmoji:true,category:"カメラ"}]));
    setWikis(loadLS("as_wikis",[{id:"1",title:"AeroSync使い方ガイド",content:"# AeroSync使い方ガイド\n\n## はじめに\nこのWikiはAeroSyncの使い方をまとめたものです。\n\n## スケジュール\nカレンダーから日付を選んでタスクを追加できます。\n\n## 在庫管理\n機材の在庫を管理できます。\n\n## Wiki\nここに情報をまとめることができます。",category:"一般",updatedAt:new Date().toISOString().split("T")[0],author:"Admin",views:0}]));
    setAvailability(loadLS("as_avail",[]));
    setAdminList(loadLS("as_admins",[]));
    setNotifEnabled(typeof Notification!=="undefined"&&Notification.permission==="granted");
    setChatMessages(loadLS("as_chat",[]));

    return ()=>subscription.unsubscribe();
  }, []);

  useEffect(()=>{
    if(!isMounted)return;
    saveLS("as_tasks",tasks); saveLS("as_inventory",inventory);
    saveLS("as_wikis",wikis); saveLS("as_avail",availability);
    saveLS("as_admins",adminList); saveLS("as_chat",chatMessages);
  },[tasks,inventory,wikis,availability,adminList,chatMessages,isMounted]);

  // Update isAdmin based on adminList
  useEffect(()=>{
    if(!currentUserEmail||currentUserEmail==="me")return;
    const inList = adminList.some(a=>a.email===currentUserEmail);
    if(inList&&!isAdmin) setIsAdmin(true);
  },[adminList,currentUserEmail]);

  useEffect(()=>{ if(searchOpen) setTimeout(()=>searchRef.current?.focus(),100); },[searchOpen]);
  useEffect(()=>{ chatEndRef.current?.scrollIntoView({behavior:"smooth"}); },[chatMessages]);

  // Check user availability for selected date
  useEffect(()=>{
    const my = availability.find(a=>a.userId===currentUserEmail&&a.date===selectedDate);
    setMyAvailStatus(my?.status??null);
    setAvailNote(my?.note??"");
  },[selectedDate,availability,currentUserEmail]);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const handleDiscordLogin = async()=>{ setAuthError(null);setAuthLoading(true); try { const s=createClient(); const{error}=await s.auth.signInWithOAuth({provider:"discord",options:{redirectTo:`${window.location.origin}/auth/callback`}}); if(error)throw error; } catch(e:any){setAuthError(e.message);setAuthLoading(false);} };
  const handleEmailAuth = async()=>{ if(!email.trim()||!password.trim()){setAuthError("メールとパスワードを入力してください");return;} setAuthError(null);setAuthLoading(true); try{ const s=createClient(); if(authMode==="login"){const{error}=await s.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;}else{const{error}=await s.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:`${window.location.origin}/auth/callback`}});if(error)throw error;setAuthMode("check_email");}  }catch(e:any){setAuthError(e.message);}finally{setAuthLoading(false);} };
  const handleLogout = async()=>{ const s=createClient(); await s.auth.signOut(); };

  // ── Availability ──────────────────────────────────────────────────────────
  const setMyAvail = (status: Availability["status"]) => {
    setMyAvailStatus(status);
    setAvailability(prev => {
      const filtered = prev.filter(a=>!(a.userId===currentUserEmail&&a.date===selectedDate));
      return [...filtered, { userId:currentUserEmail, name:currentUserEmail, date:selectedDate, status, note:availNote }];
    });
  };
  const saveAvailNote = () => {
    setAvailability(prev => prev.map(a => a.userId===currentUserEmail&&a.date===selectedDate ? {...a,note:availNote} : a));
  };

  // ── Tasks ─────────────────────────────────────────────────────────────────
  const addTask = useCallback(()=>{
    if(!newTask.title.trim())return;
    setTasks(prev=>[...prev,{id:Date.now().toString(),title:newTask.title.trim(),date:selectedDate,description:newTask.desc.trim(),done:false,color:newTask.color,openJoin:newTask.open,assignees:newTask.assignees,priority:newTask.priority,location:newTask.location}]);
    setNewTask({title:"",desc:"",color:TASK_COLORS[0],open:true,assignees:[],priority:"medium",location:""});
    setShowTaskForm(false);
  },[newTask,selectedDate]);

  // ── Inventory ─────────────────────────────────────────────────────────────
  const addInventory = useCallback(()=>{
    if(!newInv.name.trim()||!newInv.total)return;
    const n=parseInt(newInv.total,10); if(isNaN(n)||n<1)return;
    setInventory(prev=>[...prev,{id:Date.now().toString(),name:newInv.name.trim(),stock:n,total:n,image:newInv.image??newInv.emoji,isEmoji:!newInv.image,category:newInv.category}]);
    setNewInv({name:"",total:"",emoji:"📦",image:null,category:INV_CATS[0]}); setShowInvForm(false);
  },[newInv]);

  // ── Wiki ──────────────────────────────────────────────────────────────────
  const addWiki = useCallback(()=>{
    if(!newWiki.title.trim())return;
    const page:WikiPage={id:Date.now().toString(),title:newWiki.title.trim(),content:`# ${newWiki.title.trim()}\n\nここに内容を書いてください。`,category:newWiki.cat,updatedAt:new Date().toISOString().split("T")[0],author:currentUserEmail,views:0};
    setWikis(prev=>[...prev,page]); setNewWiki({title:"",cat:WIKI_CATS[0]}); setShowWikiForm(false); setActiveWiki(page);
  },[newWiki,currentUserEmail]);

  // ── Admin management ──────────────────────────────────────────────────────
  const addAdmin = ()=>{
    if(!newAdminEmail.trim())return;
    if(adminList.some(a=>a.email===newAdminEmail.trim())){setNewAdminEmail("");return;}
    setAdminList(prev=>[...prev,{email:newAdminEmail.trim(),grantedBy:currentUserEmail,grantedAt:new Date().toISOString().split("T")[0]}]);
    setNewAdminEmail("");
  };
  const removeAdmin = (email:string)=>{
    if(email===currentUserEmail)return; // can't remove self
    setAdminList(prev=>prev.filter(a=>a.email!==email));
  };

  // ── Gemini chat ───────────────────────────────────────────────────────────
  const sendChat = async()=>{
    if(!chatInput.trim()||chatLoading)return;
    const userMsg:ChatMessage={role:"user",content:chatInput.trim(),ts:Date.now()};
    setChatMessages(prev=>[...prev,userMsg]);
    setChatInput(""); setChatLoading(true);
    const context = `タスク数: ${tasks.length}, 機材数: ${inventory.length}, Wikiページ数: ${wikis.length}. 今日の日付: ${new Date().toISOString().split("T")[0]}. タスク一覧: ${tasks.slice(0,5).map(t=>t.title).join(", ")}`;
    try {
      const res = await fetch("/api/gemini",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:[...chatMessages,userMsg],context})});
      const data = await res.json();
      setChatMessages(prev=>[...prev,{role:"assistant",content:data.reply||data.error||"エラーが発生しました",ts:Date.now()}]);
    } catch { setChatMessages(prev=>[...prev,{role:"assistant",content:"接続エラーが発生しました",ts:Date.now()}]); }
    finally { setChatLoading(false); }
  };

  // ── Notifications ─────────────────────────────────────────────────────────
  const toggleNotif = async()=>{ if(notifEnabled){setNotifEnabled(false);return;} const g=await reqNotif(); setNotifEnabled(g); if(g) new Notification("AeroSync",{body:"通知が有効になりました！",icon:"/icons/icon-192.png"}); };

  // ── Search ────────────────────────────────────────────────────────────────
  const searchResults = searchQuery.trim().length<1?[]:[
    ...tasks.filter(t=>t.title.includes(searchQuery)||t.description.includes(searchQuery)).map(t=>({type:"task",label:t.title,sub:t.date,tab:"schedule" as Tab,color:t.color,wiki:null as WikiPage|null})),
    ...inventory.filter(i=>i.name.includes(searchQuery)).map(i=>({type:"inventory",label:i.name,sub:`残: ${i.stock}/${i.total}`,tab:"inventory" as Tab,color:"#3b82f6",wiki:null})),
    ...wikis.filter(w=>w.title.includes(searchQuery)||w.content.includes(searchQuery)).map(w=>({type:"wiki",label:w.title,sub:w.category,tab:"wiki" as Tab,color:"#8b5cf6",wiki:w})),
  ];

  // ── Stats ─────────────────────────────────────────────────────────────────
  const completedTasks = tasks.filter(t=>t.done).length;
  const todayTasks = tasks.filter(t=>t.date===new Date().toISOString().split("T")[0]);
  const lowStock = inventory.filter(i=>i.stock<i.total*0.3);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!isMounted||session===undefined) return (
    <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="flex flex-col items-center gap-4">
        <div className={`w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-300 ${pulse}`}>
          <span className="text-white font-black text-xl">AS</span>
        </div>
        <div className="flex gap-1.5">
          {[0,1,2].map(i=><div key={i} className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:`${i*0.15}s`}}/>)}
        </div>
      </div>
    </div>
  );

  // ── Auth ────────────────────────────────────────────────────────────────
  if (!session) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_,i)=>(
          <div key={i} className="absolute rounded-full opacity-10 animate-pulse" style={{width:`${100+i*80}px`,height:`${100+i*80}px`,background:"radial-gradient(circle, #60a5fa, transparent)",left:`${10+i*15}%`,top:`${10+i*12}%`,animationDelay:`${i*0.5}s`}}/>
        ))}
      </div>
      <div className={`relative w-full max-w-sm ${slideUp}`}>
        <div className="bg-white/10 backdrop-blur-2xl rounded-3xl border border-white/20 overflow-hidden shadow-2xl">
          <div className="px-8 pt-10 pb-6 text-center">
            <div className="w-16 h-16 bg-blue-500/30 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4 ring-2 ring-white/30 shadow-lg">
              <span className="text-white text-xl font-black">AS</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight mb-1">AeroSync</h1>
            <p className="text-blue-200/80 text-sm">課外活動をスマートに同期</p>
          </div>
          <div className="px-8 pb-8">
            {errorMessage && <div className="mb-4 bg-red-500/20 text-red-200 p-3 rounded-xl text-xs font-medium border border-red-400/30 flex items-start gap-2"><ShieldAlert size={14} className="shrink-0 mt-0.5"/><span className="break-all">{errorMessage}</span></div>}
            {authMode==="check_email" ? (
              <div className="text-center py-4">
                <Mail size={32} className="text-blue-300 mx-auto mb-3"/>
                <p className="text-white font-bold mb-2">メールを確認してください</p>
                <p className="text-blue-200/70 text-sm mb-4">確認メールを <span className="font-bold text-white">{email}</span> に送信しました</p>
                <button onClick={()=>{setAuthMode("login");setEmail("");setPassword("");}} className="text-sm text-blue-300 hover:text-white transition-colors">ログイン画面に戻る</button>
              </div>
            ):(
              <>
                <div className="flex bg-white/10 rounded-xl p-1 mb-5">
                  {(["login","signup"] as const).map(m=>(
                    <button key={m} onClick={()=>{setAuthMode(m);setAuthError(null);}} className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-all ${authMode===m?"bg-white text-gray-900 shadow":"text-white/60"}`}>
                      {m==="login"?"ログイン":"新規登録"}
                    </button>
                  ))}
                </div>
                {authError && <div className="mb-4 bg-red-500/20 text-red-200 p-3 rounded-xl text-xs border border-red-400/20">{authError}</div>}
                <div className="space-y-3 mb-4">
                  <div className="relative"><Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40"/><input type="email" placeholder="メールアドレス" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleEmailAuth()} className="w-full pl-9 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white/15 transition"/></div>
                  <div className="relative"><Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40"/><input type={showPw?"text":"password"} placeholder="パスワード" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleEmailAuth()} className="w-full pl-9 pr-10 py-2.5 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"/><button onClick={()=>setShowPw(p=>!p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80">{showPw?<EyeOff size={15}/>:<Eye size={15}/>}</button></div>
                </div>
                <button onClick={handleEmailAuth} disabled={authLoading} className="w-full bg-blue-500 hover:bg-blue-400 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-blue-500/30 mb-4">
                  {authLoading?<Loader2 size={16} className="animate-spin"/>:<User size={16}/>}
                  {authMode==="login"?"メールでログイン":"アカウント作成"}
                </button>
                <div className="flex items-center gap-3 mb-4"><div className="flex-1 h-px bg-white/20"/><span className="text-xs text-white/40">または</span><div className="flex-1 h-px bg-white/20"/></div>
                <button onClick={handleDiscordLogin} disabled={authLoading} className="w-full bg-[#5865F2] hover:bg-[#4752C4] disabled:opacity-60 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]">
                  {authLoading?<Loader2 size={16} className="animate-spin"/>:<DiscordIcon/>} Discordでログイン
                </button>
              </>
            )}
          </div>
        </div>
        <p className="text-center text-xs text-white/30 mt-4">AeroSync · 課外活動管理</p>
      </div>
    </div>
  );

  // ── App ────────────────────────────────────────────────────────────────────
  const userProfile = session.user?.user_metadata??{};
  const displayName = userProfile?.full_name??session.user?.email??"ユーザー";
  const selectedTasks = tasks.filter(t=>t.date===selectedDate);
  const selectedAvail = availability.filter(a=>a.date===selectedDate);

  const renderContent = () => {
    // ── Schedule ────────────────────────────────────────────────────────────
    if (activeTab==="schedule") return (
      <div className={`p-4 space-y-4 ${fadeIn}`}>
        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-2">
          {[
            {label:"今日のタスク",value:todayTasks.length,icon:<Zap size={14}/>,color:"bg-blue-500"},
            {label:"完了済み",value:completedTasks,icon:<CheckSquare size={14}/>,color:"bg-green-500"},
            {label:"在庫不足",value:lowStock.length,icon:<TrendingUp size={14}/>,color:lowStock.length>0?"bg-red-500":"bg-gray-400"},
          ].map(s=>(
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-3 flex flex-col gap-1 shadow-sm">
              <div className={`w-6 h-6 ${s.color} rounded-lg flex items-center justify-center text-white`}>{s.icon}</div>
              <p className="text-xl font-black text-gray-900">{s.value}</p>
              <p className="text-[10px] text-gray-400 font-medium">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-gray-900">スケジュール</h2>
          {isAdmin && <button onClick={()=>setShowTaskForm(true)} className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"><Plus size={14}/> タスク追加</button>}
        </div>

        <CalendarView tasks={tasks} availability={availability} onDayClick={setSelectedDate} selectedDate={selectedDate}/>

        {/* Availability for selected date */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5"><Users size={14} className="text-blue-500"/> {selectedDate} の参加状況</h3>
          <div className="flex gap-2 mb-3">
            {(["available","maybe","unavailable"] as const).map(s=>(
              <button key={s} onClick={()=>setMyAvail(s)}
                style={{borderColor:AVAIL_COLORS[s]+(myAvailStatus===s?"":"44"),background:myAvailStatus===s?AVAIL_COLORS[s]+"22":"white",color:AVAIL_COLORS[s]}}
                className="flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-all active:scale-95">
                {AVAIL_LABELS[s]}
              </button>
            ))}
          </div>
          {myAvailStatus && (
            <div className="flex gap-2">
              <input value={availNote} onChange={e=>setAvailNote(e.target.value)} placeholder="コメント（任意）" className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"/>
              <button onClick={saveAvailNote} className="bg-blue-100 text-blue-700 text-xs font-bold px-3 rounded-xl hover:bg-blue-200 transition-colors">保存</button>
            </div>
          )}
          {selectedAvail.length>0 && (
            <div className="mt-3 space-y-1.5">
              {selectedAvail.map(a=>(
                <div key={a.userId} className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{background:AVAIL_COLORS[a.status]}}/>
                  <span className="font-medium text-gray-700 truncate flex-1">{a.name}</span>
                  <span style={{color:AVAIL_COLORS[a.status]}} className="font-bold shrink-0">{AVAIL_LABELS[a.status]}</span>
                  {a.note && <span className="text-gray-400 truncate max-w-[80px]">{a.note}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tasks for selected date */}
        <h3 className="text-sm font-bold text-gray-500">{selectedDate} のタスク</h3>
        {selectedTasks.length===0
          ? <div className="text-center py-8 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">この日はタスクがありません</div>
          : <div className="space-y-2">
              {selectedTasks.map(task=>(
                <div key={task.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${task.done?"opacity-55":""} ${fadeIn}`}
                  style={{borderColor:task.color+"44",borderLeftWidth:3,borderLeftColor:task.color}}>
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-sm font-bold ${task.done?"line-through text-gray-400":"text-gray-900"}`}>{task.title}</span>
                          <Pill color={task.color}>{task.priority==="high"?"🔥 高":task.priority==="medium"?"⚡ 中":"🌿 低"}</Pill>
                          {task.assignees.includes(currentUserEmail) && <Pill color={task.color}>担当</Pill>}
                        </div>
                        {task.description && <p className="text-xs text-gray-500 line-clamp-2">{task.description}</p>}
                        {task.location && <div className="flex items-center gap-1 mt-1"><MapPin size={10} className="text-gray-400"/><span className="text-[10px] text-gray-400">{task.location}</span></div>}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {task.assignees.length>0 && <div className="flex items-center gap-1"><Users size={11} className="text-gray-400"/><span className="text-[10px] text-gray-500">{task.assignees.length}人</span></div>}
                          {task.openJoin && <Pill color="#10b981">参加可能</Pill>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={()=>setTasks(p=>p.map(t=>t.id===task.id?{...t,done:!t.done}:t))}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${task.done?"bg-green-500 border-green-500":"border-gray-300 hover:border-green-400"}`}>
                          {task.done && <Check size={12} className="text-white"/>}
                        </button>
                        {isAdmin && <button onClick={()=>setTasks(p=>p.filter(t=>t.id!==task.id))} className="p-1 text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={14}/></button>}
                      </div>
                    </div>
                    {task.openJoin && !task.assignees.includes(currentUserEmail) && (
                      <button onClick={()=>setTasks(p=>p.map(t=>t.id===task.id?{...t,assignees:[...t.assignees,currentUserEmail]}:t))}
                        className="mt-2 w-full py-1.5 rounded-xl text-xs font-bold text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 transition-colors flex items-center justify-center gap-1">
                        <UserPlus size={12}/> タスクに参加
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
        }

        {/* Task form modal */}
        {showTaskForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={()=>setShowTaskForm(false)}>
            <div className={`bg-white w-full rounded-t-3xl p-6 space-y-3 max-h-[90vh] overflow-y-auto ${slideUp}`} onClick={e=>e.stopPropagation()}>
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto"/>
              <h3 className="font-black text-gray-900 text-base">タスクを追加 — {selectedDate}</h3>
              <input placeholder="タスク名 *" value={newTask.title} onChange={e=>setNewTask(p=>({...p,title:e.target.value}))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/>
              <textarea placeholder="説明（任意）" value={newTask.desc} onChange={e=>setNewTask(p=>({...p,desc:e.target.value}))} rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"/>
              <input placeholder="場所（任意）" value={newTask.location} onChange={e=>setNewTask(p=>({...p,location:e.target.value}))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/>
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2">優先度</p>
                <div className="flex gap-2">
                  {(["low","medium","high"] as const).map(p=>(
                    <button key={p} onClick={()=>setNewTask(prev=>({...prev,priority:p}))}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-all ${newTask.priority===p?"border-blue-500 bg-blue-50 text-blue-700":"border-gray-200 text-gray-500"}`}>
                      {p==="low"?"🌿 低":p==="medium"?"⚡ 中":"🔥 高"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2">カラー</p>
                <div className="flex gap-2 flex-wrap">{TASK_COLORS.map(c=><button key={c} onClick={()=>setNewTask(p=>({...p,color:c}))} style={{background:c}} className={`w-7 h-7 rounded-full transition-all ${newTask.color===c?"scale-125 ring-2 ring-offset-1 ring-gray-400":""}`}/>)}</div>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-sm font-medium text-gray-700">誰でも参加可能</span>
                <Toggle checked={newTask.open} onChange={v=>setNewTask(p=>({...p,open:v}))}/>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2">担当者を追加（任意）</p>
                <div className="flex gap-2">
                  <input placeholder="メール or 名前" value={newAssignee} onChange={e=>setNewAssignee(e.target.value)} className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/>
                  <button onClick={()=>{if(newAssignee.trim()){setNewTask(p=>({...p,assignees:[...p.assignees,newAssignee.trim()]}));setNewAssignee("");}}} className="bg-blue-100 text-blue-700 font-bold text-xs px-3 rounded-xl hover:bg-blue-200 transition-colors">追加</button>
                </div>
                {newTask.assignees.length>0 && <div className="flex flex-wrap gap-1.5 mt-2">{newTask.assignees.map(a=><span key={a} className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2 py-1 rounded-full">{a} <button onClick={()=>setNewTask(p=>({...p,assignees:p.assignees.filter(x=>x!==a)}))}><X size={10}/></button></span>)}</div>}
              </div>
              <button onClick={addTask} className="w-full bg-blue-600 text-white font-bold py-3 rounded-2xl text-sm hover:bg-blue-700 transition-all active:scale-[0.98]">タスクを追加</button>
            </div>
          </div>
        )}
      </div>
    );

    // ── Inventory ───────────────────────────────────────────────────────────
    if (activeTab==="inventory") return (
      <div className={`p-4 space-y-4 ${fadeIn}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-gray-900">在庫・設備</h2>
          {isAdmin && <button onClick={()=>setShowInvForm(true)} className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"><Plus size={14}/> 追加</button>}
        </div>
        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {["すべて",...INV_CATS].map(cat=>(
            <button key={cat} className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${wikiFilter===cat?"bg-blue-600 text-white border-blue-600":"bg-white text-gray-500 border-gray-200 hover:border-blue-300"}`}
              onClick={()=>setWikiFilter(cat)}>{cat}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(wikiFilter==="すべて"?inventory:inventory.filter(i=>i.category===wikiFilter)).map(item=>(
            <div key={item.id} className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all hover:shadow-md ${fadeIn}`}>
              <div className="relative">
                {item.isEmoji
                  ? <div className="h-24 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center text-5xl">{item.image}</div>
                  : <img src={item.image} alt={item.name} className="w-full h-24 object-cover"/>
                }
                {isAdmin && <button onClick={()=>setInventory(p=>p.filter(x=>x.id!==item.id))} className="absolute top-1.5 right-1.5 w-6 h-6 bg-white/90 rounded-full flex items-center justify-center text-gray-400 hover:text-red-400 shadow-sm transition-all"><Trash2 size={11}/></button>}
                <div className="absolute top-1.5 left-1.5"><Pill color="#3b82f6">{item.category}</Pill></div>
              </div>
              <div className="p-2.5">
                <p className="text-xs font-bold text-gray-800 truncate mb-1.5">{item.name}</p>
                <div className="flex items-center justify-between gap-1 mb-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{width:`${(item.stock/item.total)*100}%`,background:item.stock===0?"#ef4444":item.stock<item.total*0.3?"#f59e0b":"#3b82f6"}}/>
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 shrink-0">{item.stock}/{item.total}</span>
                </div>
                {isAdmin && <div className="flex gap-1"><button onClick={()=>setInventory(p=>p.map(x=>x.id===item.id&&x.stock>0?{...x,stock:x.stock-1}:x))} className="flex-1 py-1 bg-red-50 text-red-500 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors">−</button><button onClick={()=>setInventory(p=>p.map(x=>x.id===item.id&&x.stock<x.total?{...x,stock:x.stock+1}:x))} className="flex-1 py-1 bg-green-50 text-green-600 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors">＋</button></div>}
              </div>
            </div>
          ))}
        </div>
        {showInvForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={()=>setShowInvForm(false)}>
            <div className={`bg-white w-full rounded-t-3xl p-6 space-y-4 ${slideUp}`} onClick={e=>e.stopPropagation()}>
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto"/>
              <h3 className="font-black text-gray-900 text-base">機材を追加</h3>
              <button onClick={()=>imgRef.current?.click()} className="w-full h-28 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-blue-300 hover:bg-blue-50 transition-colors overflow-hidden">
                {newInv.image ? <img src={newInv.image} className="w-full h-full object-cover" alt="preview"/> : <><ImageIcon size={24} className="text-gray-300"/><span className="text-xs text-gray-400">写真をアップロード</span></>}
              </button>
              <input ref={imgRef} type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>setNewInv(p=>({...p,image:r.result as string}));r.readAsDataURL(f);}} className="hidden"/>
              {!newInv.image && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-200"/><span className="text-xs text-gray-400">または絵文字</span><div className="flex-1 h-px bg-gray-200"/>
                </div>
              )}
              {!newInv.image && <input placeholder="📷" value={newInv.emoji} onChange={e=>setNewInv(p=>({...p,emoji:e.target.value}))} className="w-20 mx-auto block text-center border border-gray-200 rounded-xl py-2 text-2xl focus:outline-none focus:ring-2 focus:ring-blue-300"/>}
              {newInv.image && <button onClick={()=>setNewInv(p=>({...p,image:null}))} className="text-xs text-red-500 font-medium">画像を削除</button>}
              <input placeholder="機材名 *" value={newInv.name} onChange={e=>setNewInv(p=>({...p,name:e.target.value}))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/>
              <input type="number" placeholder="総数 *" min={1} value={newInv.total} onChange={e=>setNewInv(p=>({...p,total:e.target.value}))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/>
              <select value={newInv.category} onChange={e=>setNewInv(p=>({...p,category:e.target.value}))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">
                {INV_CATS.map(c=><option key={c}>{c}</option>)}
              </select>
              <button onClick={addInventory} className="w-full bg-blue-600 text-white font-bold py-3 rounded-2xl text-sm hover:bg-blue-700 transition-all active:scale-[0.98]">追加</button>
            </div>
          </div>
        )}
      </div>
    );

    // ── Wiki ─────────────────────────────────────────────────────────────────
    if (activeTab==="wiki") {
      if (activeWiki) return <WikiPageView page={activeWiki} isAdmin={isAdmin} onSave={updated=>{setWikis(p=>p.map(w=>w.id===updated.id?updated:w));setActiveWiki(updated);}} onBack={()=>setActiveWiki(null)}/>;
      const fw = wikiFilter==="すべて"?wikis:wikis.filter(w=>w.category===wikiFilter);
      return (
        <div className={`p-4 space-y-4 ${fadeIn}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-gray-900">Wiki</h2>
            {isAdmin && <button onClick={()=>setShowWikiForm(true)} className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"><Plus size={14}/> 新規ページ</button>}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {["すべて",...WIKI_CATS].map(cat=>(
              <button key={cat} onClick={()=>setWikiFilter(cat)} className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${wikiFilter===cat?"bg-blue-600 text-white border-blue-600":"bg-white text-gray-500 border-gray-200"}`}>{cat}</button>
            ))}
          </div>
          <div className="space-y-2">
            {fw.length===0 ? <div className="text-center py-8 text-sm text-gray-400 bg-white rounded-2xl border border-gray-100">ページがありません</div>
              : fw.map(w=>(
                <button key={w.id} onClick={()=>{setWikis(p=>p.map(x=>x.id===w.id?{...x,views:x.views+1}:x));setActiveWiki({...w,views:w.views+1});}}
                  className={`w-full bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-left hover:border-blue-200 hover:shadow-md transition-all active:scale-[0.99] ${fadeIn}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1"><Hash size={13} className="text-blue-400 shrink-0"/><span className="font-bold text-sm text-gray-900 truncate">{w.title}</span></div>
                      <p className="text-xs text-gray-500 line-clamp-1 ml-5">{w.content.replace(/#+ /g,"").split("\n").find(l=>l.trim()&&!l.startsWith("#"))??"" }</p>
                      <div className="flex items-center gap-2 mt-1.5 ml-5"><Pill color="#3b82f6">{w.category}</Pill><span className="text-[10px] text-gray-400">{w.updatedAt}</span><span className="text-[10px] text-gray-400">👁 {w.views}</span></div>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 shrink-0 mt-1"/>
                  </div>
                </button>
              ))
            }
          </div>
          {showWikiForm && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={()=>setShowWikiForm(false)}>
              <div className={`bg-white w-full rounded-t-3xl p-6 space-y-4 ${slideUp}`} onClick={e=>e.stopPropagation()}>
                <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto"/>
                <h3 className="font-black text-gray-900 text-base">新規Wikiページ</h3>
                <input placeholder="ページタイトル" value={newWiki.title} onChange={e=>setNewWiki(p=>({...p,title:e.target.value}))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/>
                <select value={newWiki.cat} onChange={e=>setNewWiki(p=>({...p,cat:e.target.value}))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">{WIKI_CATS.map(c=><option key={c}>{c}</option>)}</select>
                <button onClick={addWiki} className="w-full bg-blue-600 text-white font-bold py-3 rounded-2xl text-sm hover:bg-blue-700 transition-all active:scale-[0.98]">作成して編集</button>
              </div>
            </div>
          )}
        </div>
      );
    }

    // ── Settings ─────────────────────────────────────────────────────────────
    if (activeTab==="settings") return (
      <div className={`p-4 space-y-4 pb-10 ${fadeIn}`}>
        <h2 className="text-xl font-black text-gray-900">設定</h2>

        {/* Profile */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-4 flex items-center gap-3">
          {userProfile?.avatar_url
            ? <img src={userProfile.avatar_url} alt="Avatar" className="w-14 h-14 rounded-2xl ring-2 ring-white/30"/>
            : <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center font-black text-white text-xl">{displayName.charAt(0).toUpperCase()}</div>}
          <div>
            <p className="font-bold text-white text-base">{displayName}</p>
            <p className="text-blue-200 text-xs">{session.user?.email}</p>
            {isAdmin && <span className="text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full mt-1 inline-block">Admin ⭐</span>}
          </div>
        </div>

        {/* Stats */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">アクティビティ</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[{v:tasks.length,l:"タスク"},{v:completedTasks,l:"完了"},{v:wikis.length,l:"Wiki"}].map(s=>(
              <div key={s.l}><p className="text-2xl font-black text-gray-900">{s.v}</p><p className="text-[10px] text-gray-400">{s.l}</p></div>
            ))}
          </div>
        </div>

        {/* Admin toggle */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
          <div className="px-4 py-2.5"><p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">権限</p></div>
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center"><ShieldAlert size={15} className="text-amber-600"/></div>
              <div><p className="text-sm font-bold text-gray-800">管理者モード</p><p className="text-xs text-gray-500">タスク・機材・Wikiの管理権限</p></div>
            </div>
            <Toggle checked={isAdmin} onChange={v=>{setIsAdmin(v); if(v&&!adminList.some(a=>a.email===currentUserEmail)){setAdminList(p=>[...p,{email:currentUserEmail,grantedBy:"self",grantedAt:new Date().toISOString().split("T")[0]}]);}}} color="bg-amber-500"/>
          </div>
        </div>

        {/* Admin management — only visible to admins */}
        {isAdmin && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">管理者を管理</p>
              <p className="text-xs text-gray-500">他のメンバーに管理者権限を付与できます</p>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <input placeholder="メールアドレス" value={newAdminEmail} onChange={e=>setNewAdminEmail(e.target.value)} className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/>
                <button onClick={addAdmin} className="bg-blue-600 text-white text-xs font-bold px-3 rounded-xl hover:bg-blue-700 transition-colors">追加</button>
              </div>
              {adminList.length>0 && (
                <div className="space-y-2">
                  {adminList.map(a=>(
                    <div key={a.email} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                      <div><p className="text-xs font-bold text-gray-800 truncate">{a.email}</p><p className="text-[10px] text-gray-400">追加: {a.grantedAt}</p></div>
                      {a.email!==currentUserEmail && <button onClick={()=>removeAdmin(a.email)} className="text-gray-300 hover:text-red-400 transition-colors p-1"><X size={14}/></button>}
                      {a.email===currentUserEmail && <span className="text-[10px] text-blue-500 font-bold">あなた</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notifications */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
          <div className="px-4 py-2.5"><p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">通知 & PWA</p></div>
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${notifEnabled?"bg-blue-100":"bg-gray-100"}`}>{notifEnabled?<Bell size={15} className="text-blue-600"/>:<BellOff size={15} className="text-gray-400"/>}</div>
              <div><p className="text-sm font-bold text-gray-800">プッシュ通知</p><p className="text-xs text-gray-500">{notifEnabled?"通知が有効です":"タップして有効化"}</p></div>
            </div>
            <Toggle checked={notifEnabled} onChange={async()=>toggleNotif()}/>
          </div>
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center"><Smartphone size={15} className="text-green-600"/></div>
            <div><p className="text-sm font-bold text-gray-800">アプリをインストール</p><p className="text-xs text-gray-500">ブラウザの「ホーム画面に追加」からインストール</p></div>
          </div>
        </div>

        {/* Data */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
          <div className="px-4 py-2.5"><p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">データ</p></div>
          {isAdmin && <button onClick={()=>{if(confirm("全データをリセットしますか？")){setTasks([]);setInventory([]);setWikis([]);}}} className="w-full px-4 py-3 flex items-center gap-3 text-red-500 hover:bg-red-50 transition-colors">
            <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center"><Trash2 size={14} className="text-red-500"/></div>
            <p className="text-sm font-bold">データをリセット</p>
          </button>}
        </div>

        <button onClick={handleLogout} className="w-full bg-white border border-gray-200 rounded-2xl py-3.5 flex items-center justify-center gap-2 text-red-500 font-bold text-sm hover:bg-red-50 transition-colors shadow-sm">
          <LogOut size={16}/> ログアウト
        </button>
        <p className="text-center text-xs text-gray-400">AeroSync v2.0 · 課外活動管理</p>
      </div>
    );

    // ── Chat ──────────────────────────────────────────────────────────────────
    if (activeTab==="chat") return (
      <div className={`flex flex-col h-[calc(100vh-8rem)] ${fadeIn}`}>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {chatMessages.length===0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className={`w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-200 ${pulse}`}>
                <Sparkles size={28} className="text-white"/>
              </div>
              <div>
                <p className="font-bold text-gray-900 text-base mb-1">AeroSync AI</p>
                <p className="text-sm text-gray-500 max-w-xs">スケジュール、在庫、Wikiについて何でも聞いてください。</p>
              </div>
              <div className="space-y-2 w-full max-w-xs">
                {["今日のタスクを教えて","在庫が少ないものは？","タスクの追加方法は？"].map(q=>(
                  <button key={q} onClick={()=>setChatInput(q)} className="w-full text-sm bg-white border border-gray-200 rounded-2xl px-4 py-2.5 text-gray-700 hover:border-blue-300 hover:bg-blue-50 transition-all text-left flex items-center gap-2">
                    <MessageCircle size={14} className="text-blue-400 shrink-0"/>{q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {chatMessages.map((m,i)=>(
            <div key={i} className={`flex gap-2.5 ${m.role==="user"?"flex-row-reverse":""} ${fadeIn}`}>
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${m.role==="assistant"?"bg-gradient-to-br from-blue-500 to-indigo-600":"bg-gray-200"}`}>
                {m.role==="assistant"?<Bot size={14} className="text-white"/>:<span className="text-xs font-bold text-gray-600">{displayName.charAt(0).toUpperCase()}</span>}
              </div>
              <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${m.role==="user"?"bg-blue-600 text-white rounded-tr-sm":"bg-white border border-gray-100 text-gray-800 shadow-sm rounded-tl-sm"}`}>
                {m.content}
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0"><Bot size={14} className="text-white"/></div>
              <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex gap-1.5 items-center">
                {[0,1,2].map(i=><div key={i} className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:`${i*0.15}s`}}/>)}
              </div>
            </div>
          )}
          <div ref={chatEndRef}/>
        </div>
        <div className="p-3 bg-white border-t border-gray-100 flex gap-2">
          <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendChat()}
            placeholder="メッセージを入力..." className="flex-1 bg-gray-100 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:bg-white transition"/>
          <button onClick={sendChat} disabled={chatLoading||!chatInput.trim()}
            className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-95 shadow-sm shadow-blue-200">
            <Send size={16}/>
          </button>
        </div>
      </div>
    );

    return null;
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(40px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
      `}</style>

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm"><span className="text-white text-[10px] font-black">AS</span></div>
          <h1 className="text-base font-black tracking-tight"><span className="text-blue-600">Aero</span>Sync</h1>
        </div>
        <div className="flex items-center gap-1.5">
          {isAdmin && <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">Admin ⭐</span>}
          <button onClick={()=>setSearchOpen(true)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-all active:scale-90"><Search size={18} className="text-gray-500"/></button>
        </div>
      </header>

      {errorMessage && (
        <div className="bg-red-50 text-red-700 px-4 py-2.5 text-xs font-medium flex items-start gap-2 border-b border-red-100">
          <ShieldAlert size={14} className="shrink-0 mt-0.5"/>
          <span className="flex-1 break-all">{errorMessage}</span>
          <button onClick={()=>setErrorMessage(null)}><X size={14}/></button>
        </div>
      )}

      <main className="flex-1 overflow-y-auto pb-20 overscroll-none">{renderContent()}</main>

      {/* Nav */}
      <nav className="fixed bottom-0 w-full bg-white/90 backdrop-blur-md border-t border-gray-100 z-30" style={{paddingBottom:"env(safe-area-inset-bottom)"}}>
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
          {([
            {id:"schedule",Icon:Calendar,label:"予定"},
            {id:"inventory",Icon:Package,label:"在庫"},
            {id:"wiki",Icon:BookOpen,label:"Wiki"},
            {id:"chat",Icon:MessageCircle,label:"AI"},
            {id:"settings",Icon:Settings,label:"設定"},
          ] as const).map(({id,Icon,label})=>(
            <button key={id} onClick={()=>{setActiveTab(id);setActiveWiki(null);}}
              className={`flex flex-col items-center justify-center w-full h-full gap-0.5 transition-all duration-200 ${activeTab===id?"text-blue-600":"text-gray-400 hover:text-gray-600"}`}>
              <div className={`p-1.5 rounded-xl transition-all duration-200 ${activeTab===id?"bg-blue-100":""}`}>
                <Icon size={20} strokeWidth={activeTab===id?2.5:1.8}/>
              </div>
              <span className="text-[10px] font-bold">{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Search overlay */}
      {searchOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col" onClick={()=>setSearchOpen(false)}>
          <div className={`bg-white w-full p-4 shadow-2xl ${slideUp}`} onClick={e=>e.stopPropagation()}>
            <div className="flex items-center gap-3 bg-gray-100 rounded-2xl px-4 py-2.5">
              <Search size={18} className="text-gray-400 shrink-0"/>
              <input ref={searchRef} value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="タスク、機材、Wikiを検索..." className="flex-1 bg-transparent text-sm focus:outline-none text-gray-800 placeholder-gray-400"/>
              <button onClick={()=>{setSearchOpen(false);setSearchQuery("");}}><X size={18} className="text-gray-400"/></button>
            </div>
            {searchResults.length>0 && (
              <div className="mt-3 space-y-1 max-h-72 overflow-y-auto">
                {searchResults.map((r,i)=>(
                  <button key={i} onClick={()=>{setActiveTab(r.tab);setSearchOpen(false);setSearchQuery("");if(r.wiki)setActiveWiki(r.wiki);}}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{background:r.color+"22"}}>
                      {r.type==="task"?<Calendar size={14} style={{color:r.color}}/>:r.type==="inventory"?<Package size={14} style={{color:r.color}}/>:<BookOpen size={14} style={{color:r.color}}/>}
                    </div>
                    <div className="flex-1 min-w-0"><p className="text-sm font-bold text-gray-900 truncate">{r.label}</p><p className="text-xs text-gray-400">{r.sub}</p></div>
                    <ChevronRight size={14} className="text-gray-300 shrink-0"/>
                  </button>
                ))}
              </div>
            )}
            {searchQuery.trim().length>0&&searchResults.length===0 && <p className="text-center text-sm text-gray-400 py-6">「{searchQuery}」の結果が見つかりません</p>}
          </div>
        </div>
      )}
    </div>
  );
}
