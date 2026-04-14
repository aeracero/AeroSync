"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Calendar, Package, BookOpen, Settings, LogOut, Plus, ShieldAlert,
  ChevronRight, Trash2, Loader2, Mail, Lock, Eye, EyeOff, User,
  Search, X, Bell, BellOff, ChevronLeft, Edit2, Save,
  UserPlus, Check, Image as ImageIcon, Hash, ArrowLeft,
  Smartphone, Users, MessageCircle, Send, Bot, Sparkles,
  MapPin, CheckSquare, TrendingUp, Zap, Shield, Crown,
  Palette, Wand2, ChevronDown, RotateCcw, Moon, Sun, Globe,
  Volume2, VolumeX, Vibrate, Eye as EyeIcon, EyeOff as EyeOffIcon,
  Copy, Download, Upload, RefreshCw, HelpCircle, Star, Flame, Home, AtSign, BellRing
} from "lucide-react";

// ─── Constants & Settings ──────────────────────────────────────────────────────
// ★ オーナー権限を自動付与したいDiscordアカウントのユーザーID（数字の羅列）をここに入力してください
const TARGET_OWNER_DISCORD_ID = "916106297190019102";
// ─────────────────────────────────────────────────────────────────────────────

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = "home"|"schedule"|"inventory"|"wiki"|"members"|"settings"|"discord";
type DiscordChannel = { id:string; name:string; type:number; parent_id:string|null; position:number; topic?:string; };
type DiscordMessage = { id:string; content:string; author:{id:string;username:string;avatar:string|null;discriminator:string}; timestamp:string; embeds?:any[]; };
type AuthMode = "login"|"signup"|"check_email";
type SettingsTab = "profile"|"roles"|"appearance"|"notifications"|"privacy"|"data"|"budget"|"about";

type Task = { id:string; title:string; date:string; description:string; assignees:string[]; openJoin:boolean; color:string; done:boolean; priority:"low"|"medium"|"high"; location?:string; photo?:string; notes?:string; checklist?:{id:string;text:string;done:boolean}[]; recurrence?:string; recurrenceCount?:number; };
type Expense = { id:string; title:string; amount:number; category:string; date:string; note:string; created_by:string; created_by_name:string; };
type TaskComment = { id:string; task_id:string; user_id:string; user_name:string; content:string; created_at:string; };
type SharedFile = { id:string; name:string; storage_path:string; url:string; size:number; mime_type:string; category:string; uploaded_by:string; uploaded_by_name:string; created_at?:string; };
type ActivityLog = { id:string; user_id:string; user_name:string; action:string; entity_type:string; entity_id:string; details:any; created_at:string; };
type Availability = { userId:string; name:string; date:string; status:"available"|"maybe"|"unavailable"; note:string; };
type InventoryItem = { id:string; name:string; stock:number; total:number; image:string; isEmoji:boolean; category:string; };
type WikiPage = { id:string; title:string; content:string; category:string; updatedAt:string; author:string; views:number; };
type ChatMessage = { role:"user"|"assistant"; content:string; ts:number; };
type Member = { id:string; email:string; display_name:string; avatar_url?:string; discord_id?:string; role_id:string; visual_effect:string; online_at?:string; };
type DmMessage = { id:string; channel_id:string; channel_type:string; sender_id:string; sender_email:string; sender_name:string; sender_avatar?:string; content:string; mentions:string[]; created_at:string; };
type AppNotification = { id:string; type:string; title:string; body:string; read:boolean; created_at:string; };
type AttendanceLog = { id:string; user_id:string; user_email:string|null; user_name:string|null; checked_in_at:string; checked_out_at:string|null; duration_minutes:number|null; };

type Permission = { manageRoles: boolean; manageTasks: boolean; manageInventory: boolean; manageWiki: boolean; manageMembers: boolean; viewStats: boolean; exportData: boolean; };
type Role = { id: string; name: string; color: string; icon: string; permissions: Permission; isDefault: boolean; visualEffect: string; createdAt: string; team?: string; };
type MemberRole = { email: string; roleId: string; assignedAt: string; assignedBy: string; };
type Team = { id: string; name: string; color: string; icon: string; description: string; };
type PinnedLink = { id: string; title: string; url: string; description: string; };
type AppearanceSettings = { theme: "system"|"light"|"dark"; accentColor: string; fontSize: "sm"|"md"|"lg"; reduceMotion: boolean; compactMode: boolean; };

// ─── Constants (Data) ─────────────────────────────────────────────────────────
const TASK_COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#84cc16"];
const WIKI_CATS = ["一般","機材","手順","ルール","メモ"];
const INV_CATS = ["カメラ","音響","照明","その他"];
const AVAIL_COLORS = { available:"#10b981", maybe:"#f59e0b", unavailable:"#ef4444" } as const;
const AVAIL_LABELS = { available:"参加可", maybe:"未定", unavailable:"不参加" } as const;
const ROLE_COLORS = ["#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#8b5cf6","#ec4899","#06b6d4","#84cc16","#64748b"];
const ROLE_ICONS = ["👑","⭐","🛡️","🎯","🔧","🎨","🚀","💎","🔑","👤","🎭","⚡","🌟","🏆","🦊"];
const VISUAL_EFFECTS = [
  { id:"none", label:"なし", preview:"" }, { id:"sparkle", label:"✨ スパークル", preview:"sparkle" },
  { id:"fire", label:"🔥 ファイア", preview:"fire" }, { id:"rainbow", label:"🌈 レインボー", preview:"rainbow" },
  { id:"glow", label:"💫 グロー", preview:"glow" }, { id:"snow", label:"❄️ スノー", preview:"snow" },
  { id:"stars", label:"⭐ スターズ", preview:"stars" }, { id:"pulse", label:"💜 パルス", preview:"pulse" },
];
const ACCENT_COLORS = ["#3b82f6","#8b5cf6","#ec4899","#10b981","#f59e0b","#ef4444","#06b6d4"];

const DEFAULT_PERMISSIONS: Permission = { manageRoles:false, manageTasks:false, manageInventory:false, manageWiki:false, manageMembers:false, viewStats:false, exportData:false };
const ADMIN_PERMISSIONS: Permission = { manageRoles:true, manageTasks:true, manageInventory:true, manageWiki:true, manageMembers:true, viewStats:true, exportData:true };

const DEFAULT_ROLES: Role[] = [
  { id:"owner", name:"オーナー", color:"#f59e0b", icon:"👑", permissions:ADMIN_PERMISSIONS, isDefault:true, visualEffect:"stars", createdAt:"2024-01-01" },
  { id:"admin", name:"管理者", color:"#ef4444", icon:"🛡️", permissions:ADMIN_PERMISSIONS, isDefault:true, visualEffect:"glow", createdAt:"2024-01-01" },
  { id:"member", name:"メンバー", color:"#3b82f6", icon:"👤", permissions:DEFAULT_PERMISSIONS, isDefault:true, visualEffect:"none", createdAt:"2024-01-01" },
];

function loadLS<T>(k:string, fb:T):T { try { const r=localStorage.getItem(k); return r?JSON.parse(r):fb; } catch { return fb; } }
function saveLS(k:string, v:unknown) { try { localStorage.setItem(k,JSON.stringify(v)); } catch {} }
function registerSW(onUpdate?: () => void) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").then(reg => {
    setInterval(() => reg.update(), 60_000);
    reg.addEventListener("updatefound", () => {
      const newSW = reg.installing;
      if (!newSW) return;
      newSW.addEventListener("statechange", () => {
        if (newSW.state === "installed" && navigator.serviceWorker.controller) onUpdate?.();
      });
    });
  }).catch(() => {});
  navigator.serviceWorker.addEventListener("message", (e) => { if (e.data?.type === "SW_UPDATED") onUpdate?.(); });
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (!refreshing) { refreshing = true; window.location.reload(); } });
}
async function reqNotif():Promise<boolean> { if(!("Notification" in window)) return false; if(Notification.permission==="granted") return true; return (await Notification.requestPermission())==="granted"; }

const fadeIn = "animate-[fadeIn_0.3s_ease-out]";
const slideUp = "animate-[slideUp_0.35s_cubic-bezier(0.34,1.56,0.64,1)]";

function VisualEffectWrapper({ effect, children }: { effect:string; children:React.ReactNode }) {
  if (effect === "none" || !effect) return <>{children}</>;
  if (effect === "sparkle") return <span className="relative inline-flex">{children}<span className="absolute -top-1 -right-1 text-[10px] animate-bounce pointer-events-none">✨</span></span>;
  if (effect === "fire") return <span className="relative inline-flex">{children}<span className="absolute -top-2 -right-0.5 text-[10px] pointer-events-none" style={{animation:"floatPulse 1.5s ease-in-out infinite"}}>🔥</span></span>;
  if (effect === "rainbow") return <span className="bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 bg-clip-text text-transparent font-black">{children}</span>;
  if (effect === "glow") return <span style={{filter:"drop-shadow(0 0 6px rgba(139,92,246,0.7))"}}>  {children}</span>;
  if (effect === "snow") return <span className="relative inline-flex">{children}<span className="absolute -top-1 -right-0.5 text-[10px] pointer-events-none" style={{animation:"spin 3s linear infinite"}}>❄️</span></span>;
  if (effect === "stars") return <span className="relative inline-flex">{children}<span className="absolute -top-1.5 -right-0.5 text-[10px] pointer-events-none animate-pulse">⭐</span></span>;
  if (effect === "pulse") return <span className="animate-pulse">{children}</span>;
  return <>{children}</>;
}

function ParticleEffect({ effect }: { effect:string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (effect === "none" || !effect) return;
    const canvas = canvasRef.current; if(!canvas) return;
    const ctx = canvas.getContext("2d"); if(!ctx) return;
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    type P = { x:number; y:number; vx:number; vy:number; size:number; alpha:number; char:string; color:string; };
    const particles: P[] = [];
    const chars: Record<string,string[]> = {
      sparkle:["✨","⭐","💫"], fire:["🔥","🌟","✨"], snow:["❄️","🌨️","⛄"],
      stars:["⭐","🌟","💫","✨"], rainbow:["🌈"], glow:["💜","💙","💚"],
    };
    const ch = chars[effect] || ["✨"];
    for (let i=0; i<20; i++) particles.push({
      x:Math.random()*canvas.width, y:Math.random()*canvas.height,
      vx:(Math.random()-0.5)*0.5, vy:-Math.random()*0.8-0.2,
      size:12+Math.random()*10, alpha:0.4+Math.random()*0.6,
      char:ch[Math.floor(Math.random()*ch.length)], color:"white"
    });
    let raf: number;
    function draw() {
      ctx!.clearRect(0,0,canvas!.width,canvas!.height);
      particles.forEach(p => {
        ctx!.globalAlpha = p.alpha; ctx!.font = `${p.size}px serif`; ctx!.fillText(p.char, p.x, p.y);
        p.x += p.vx; p.y += p.vy; p.alpha -= 0.003;
        if (p.alpha <= 0 || p.y < -20) { p.y = canvas!.height + 10; p.x = Math.random()*canvas!.width; p.alpha = 0.4+Math.random()*0.6; p.char = ch[Math.floor(Math.random()*ch.length)]; }
      });
      ctx!.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(raf);
  }, [effect]);
  if (effect === "none" || !effect) return null;
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-10 opacity-30" style={{width:"100%",height:"100%"}}/>;
}

function DiscordIcon({ size=18 }:{size?:number}) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.031.053a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>; }
function Pill({ color, children }: { color?:string; children:React.ReactNode }) { return <span style={{background:color?color+"22":undefined,color,border:`1px solid ${color}44`}} className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">{children}</span>; }
function Toggle({ checked, onChange, activeColor="#3b82f6" }: { checked:boolean; onChange:(v:boolean)=>void; activeColor?:string }) { return <label className="relative inline-flex items-center cursor-pointer" onClick={e=>e.stopPropagation()}><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} className="sr-only peer"/><div className="w-11 h-6 bg-gray-200 rounded-full transition-all duration-300" style={{background:checked?activeColor:"#e5e7eb"}}/><div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300" style={{transform:checked?"translateX(20px)":"translateX(0)"}}/></label>; }
function SectionHeader({ title }: { title:string }) { return <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 py-2.5">{title}</p>; }
function SettingsRow({ icon, iconBg, title, subtitle, right, onClick, danger }: { icon:React.ReactNode; iconBg:string; title:string; subtitle?:string; right?:React.ReactNode; onClick?:()=>void; danger?:boolean; }) { return <div onClick={onClick} className={`flex items-center gap-3 px-4 py-3 ${onClick?"cursor-pointer hover:bg-gray-50":""} ${danger?"hover:bg-red-50":""} transition-colors`}><div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>{icon}</div><div className="flex-1 min-w-0"><p className={`text-sm font-bold ${danger?"text-red-500":"text-gray-800"}`}>{title}</p>{subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}</div>{right ?? (onClick && <ChevronRight size={15} className="text-gray-300 shrink-0"/>)}</div>; }

function CalendarView({ tasks, availability, onDayClick, selectedDate }: { tasks:Task[]; availability:Availability[]; onDayClick:(d:string)=>void; selectedDate:string; }) {
  const [vd, setVd] = useState(new Date());
  const yr=vd.getFullYear(), mo=vd.getMonth();
  const fd=new Date(yr,mo,1).getDay(), dim=new Date(yr,mo+1,0).getDate();
  const today=new Date().toISOString().split("T")[0];
  function ds(d:number){ return `${yr}-${String(mo+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`; }
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${fadeIn}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <button onClick={()=>setVd(new Date(yr,mo-1))} className="p-1.5 rounded-xl hover:bg-gray-100 transition-all active:scale-90"><ChevronLeft size={16} className="text-gray-500"/></button>
        <span className="font-bold text-sm text-gray-800">{yr}年 {mo+1}月</span>
        <button onClick={()=>setVd(new Date(yr,mo+1))} className="p-1.5 rounded-xl hover:bg-gray-100 transition-all active:scale-90"><ChevronRight size={16} className="text-gray-500"/></button>
      </div>
      <div className="grid grid-cols-7 text-center px-1 pb-2">
        {["日","月","火","水","木","金","土"].map((d,i)=><div key={d} className={`py-2 text-[10px] font-bold ${i===0?"text-red-400":i===6?"text-blue-400":"text-gray-400"}`}>{d}</div>)}
        {Array.from({length:fd}).map((_,i)=><div key={`b${i}`}/>)}
        {Array.from({length:dim},(_,i)=>i+1).map(d=>{
          const s=ds(d), dt=tasks.filter(t=>t.date===s), av=availability.filter(a=>a.date===s);
          const isSel=s===selectedDate, isT=s===today;
          return (
            <button key={d} onClick={()=>onDayClick(s)}
              className={`relative py-1.5 mx-0.5 my-0.5 rounded-xl text-xs font-medium transition-all duration-200 active:scale-90 ${isSel?"bg-blue-600 text-white shadow-md shadow-blue-200":isT?"bg-blue-50 text-blue-600 font-bold":dt.length>0?"font-bold text-gray-900":"text-gray-700 hover:bg-gray-50"}`}
              style={dt.length>0&&!isSel?{background:`linear-gradient(135deg, ${dt[0].color}22, ${dt[0].color}11)`,boxShadow:`0 0 8px ${dt[0].color}55, inset 0 1px 0 ${dt[0].color}33`,border:`1px solid ${dt[0].color}44`}:undefined}>
              {d}
              {(dt.length>0||av.length>0)&&(
                <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                  {dt.slice(0,2).map(t=><div key={t.id} style={{background:isSel?"white":t.color}} className="w-1 h-1 rounded-full"/>)}
                  {av.length>0&&<div style={{background:isSel?"white":"#10b981"}} className="w-1 h-1 rounded-full"/>}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WikiPageView({ page, canEdit, onSave, onBack }: { page:WikiPage; canEdit:boolean; onSave:(p:WikiPage)=>void; onBack:()=>void; }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(page.title);
  const [content, setContent] = useState(page.content);
  const [category, setCategory] = useState(page.category);
  function save() { onSave({...page,title,content,category,updatedAt:new Date().toISOString().split("T")[0],views:page.views+1}); setEditing(false); }
  return (
    <div className={`flex flex-col h-full ${fadeIn}`}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
        <button onClick={onBack} className="p-1.5 rounded-xl hover:bg-gray-100 transition-all active:scale-90"><ArrowLeft size={18} className="text-gray-600"/></button>
        <div className="flex-1 min-w-0">{editing?<input value={title} onChange={e=>setTitle(e.target.value)} className="w-full text-base font-bold border-b border-blue-300 focus:outline-none bg-transparent"/>:<h2 className="text-base font-bold text-gray-900 truncate">{page.title}</h2>}</div>
        {canEdit&&(editing?<button onClick={save} className="flex items-center gap-1 text-xs font-bold text-white bg-blue-600 px-3 py-1.5 rounded-xl transition-all active:scale-95"><Save size={13}/> 保存</button>:<button onClick={()=>setEditing(true)} className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl transition-all active:scale-95"><Edit2 size={13}/> 編集</button>)}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center gap-2 mb-4">
          {editing?<select value={category} onChange={e=>setCategory(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none">{WIKI_CATS.map(c=><option key={c}>{c}</option>)}</select>:<Pill color="#3b82f6">{page.category}</Pill>}
          <span className="text-[10px] text-gray-400">更新: {page.updatedAt} · 👁 {page.views}</span>
        </div>
        {editing?<textarea value={content} onChange={e=>setContent(e.target.value)} rows={20} className="w-full text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none font-mono"/>
          :<div className="space-y-1">
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

function RoleEditor({ role, onSave, onClose, onDelete }: { role:Role; onSave:(r:Role)=>void; onClose:()=>void; onDelete?:()=>void; }) {
  const [draft, setDraft] = useState<Role>({...role, permissions:{...role.permissions}});
  const PERM_LABELS: {key:keyof Permission; label:string; desc:string}[] = [
    {key:"manageTasks",label:"タスク管理",desc:"タスクの追加・編集・削除"}, {key:"manageInventory",label:"在庫管理",desc:"機材の追加・編集・削除"},
    {key:"manageWiki",label:"Wiki管理",desc:"Wikiページの編集・削除"}, {key:"manageMembers",label:"メンバー管理",desc:"ロールの割り当て"},
    {key:"manageRoles",label:"ロール管理",desc:"ロールの作成・編集・削除"}, {key:"viewStats",label:"統計閲覧",desc:"詳細な統計情報の閲覧"}, {key:"exportData",label:"データ出力",desc:"データのエクスポート"},
  ];
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end" onClick={onClose}>
      <div className={`bg-white w-full rounded-t-3xl max-h-[90vh] overflow-y-auto ${slideUp}`} onClick={e=>e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1"/>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2"><span className="text-xl">{draft.icon}</span><h3 className="font-black text-gray-900 text-base">ロールを編集</h3></div>
          <button onClick={onClose} className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center"><X size={14} className="text-gray-500"/></button>
        </div>
        <div className="p-5 space-y-5">
          <div className="rounded-2xl p-4 flex items-center gap-3" style={{background:draft.color+"18",border:`1.5px solid ${draft.color}44`}}>
            <span className="text-2xl">{draft.icon}</span>
            <div><VisualEffectWrapper effect={draft.visualEffect}><span className="font-black text-base" style={{color:draft.color}}>{draft.name}</span></VisualEffectWrapper><p className="text-xs text-gray-500 mt-0.5">プレビュー</p></div>
          </div>
          <div><label className="text-xs font-bold text-gray-500 block mb-1.5">ロール名</label><input value={draft.name} onChange={e=>setDraft(p=>({...p,name:e.target.value}))} disabled={draft.isDefault} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-50 disabled:text-gray-400"/></div>
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-2">カラー</label>
            <div className="flex gap-2 flex-wrap">
              {ROLE_COLORS.map(c=><button key={c} onClick={()=>setDraft(p=>({...p,color:c}))} style={{background:c}} className={`w-8 h-8 rounded-full transition-all ${draft.color===c?"scale-125 ring-2 ring-offset-1 ring-gray-400":""}`}/>)}
              <div className="relative"><input type="color" value={draft.color} onChange={e=>setDraft(p=>({...p,color:e.target.value}))} className="w-8 h-8 rounded-full cursor-pointer border-0 p-0"/></div>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-2">アイコン</label>
            <div className="flex flex-wrap gap-2">{ROLE_ICONS.map(ic=><button key={ic} onClick={()=>setDraft(p=>({...p,icon:ic}))} className={`w-9 h-9 rounded-xl text-xl flex items-center justify-center transition-all ${draft.icon===ic?"bg-blue-100 ring-2 ring-blue-400 scale-110":"bg-gray-100 hover:bg-gray-200"}`}>{ic}</button>)}</div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-2">ビジュアルエフェクト</label>
            <div className="grid grid-cols-2 gap-2">{VISUAL_EFFECTS.map(ef=><button key={ef.id} onClick={()=>setDraft(p=>({...p,visualEffect:ef.id}))} className={`py-2.5 px-3 rounded-xl text-xs font-bold border-2 text-left transition-all ${draft.visualEffect===ef.id?"border-blue-500 bg-blue-50 text-blue-700":"border-gray-200 text-gray-600 hover:border-gray-300"}`}>{ef.label}</button>)}</div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-2">権限</label>
            <div className="space-y-2 bg-gray-50 rounded-2xl p-3">
              {PERM_LABELS.map(({key,label,desc})=>(
                <div key={key} className="flex items-center justify-between gap-3 py-1">
                  <div><p className="text-sm font-bold text-gray-800">{label}</p><p className="text-xs text-gray-500">{desc}</p></div>
                  <Toggle checked={draft.permissions[key]} onChange={v=>setDraft(p=>({...p,permissions:{...p.permissions,[key]:v}}))} activeColor={draft.color}/>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={()=>onSave(draft)} className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-2xl text-sm hover:bg-blue-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"><Save size={15}/> 保存</button>
            {!draft.isDefault && onDelete && <button onClick={onDelete} className="w-12 bg-red-50 text-red-500 font-bold py-3 rounded-2xl text-sm hover:bg-red-100 transition-all flex items-center justify-center"><Trash2 size={15}/></button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function GanttView({ tasks, onTaskClick, accentColor }: { tasks: Task[]; onTaskClick: (id: string) => void; accentColor: string; }) {
  const [viewStart, setViewStart] = useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });
  const DAYS_SHOWN = 30;
  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => {
    const d = new Date(viewStart); d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });
  const today = new Date().toISOString().split('T')[0];
  const sortedTasks = [...tasks].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <button onClick={() => { const d = new Date(viewStart); d.setDate(d.getDate() - 14); setViewStart(new Date(d)); }} className="p-1.5 rounded-xl hover:bg-gray-100 transition-all"><ChevronLeft size={16} className="text-gray-500"/></button>
        <span className="font-bold text-sm text-gray-800">{viewStart.getFullYear()}年 {viewStart.getMonth() + 1}月〜</span>
        <button onClick={() => { const d = new Date(viewStart); d.setDate(d.getDate() + 14); setViewStart(new Date(d)); }} className="p-1.5 rounded-xl hover:bg-gray-100 transition-all"><ChevronRight size={16} className="text-gray-500"/></button>
      </div>
      <div className="overflow-x-auto">
        <div style={{ minWidth: `${DAYS_SHOWN * 32 + 100}px` }}>
          <div className="flex border-b border-gray-100 sticky top-0 bg-white z-10">
            <div className="w-24 shrink-0 px-2 py-2 text-[10px] font-bold text-gray-400 border-r border-gray-100">タスク</div>
            <div className="flex flex-1">
              {days.map((day, i) => {
                const d = new Date(day);
                const isToday = day === today;
                const dayOfWeek = d.getDay();
                return (
                  <div key={day} className={`w-8 shrink-0 text-center py-1 text-[9px] font-bold border-r border-gray-50 ${isToday ? 'bg-blue-50 text-blue-600' : dayOfWeek === 0 ? 'text-red-400' : dayOfWeek === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
                    {i === 0 || d.getDate() === 1 ? `${d.getMonth()+1}/${d.getDate()}` : d.getDate()}
                  </div>
                );
              })}
            </div>
          </div>
          {sortedTasks.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">タスクがありません</div>
          ) : (
            sortedTasks.map(task => {
              const taskDayIdx = days.indexOf(task.date);
              return (
                <div key={task.id} className="flex items-center border-b border-gray-50 hover:bg-gray-50 transition-colors group" style={{ minHeight: '36px' }}>
                  <div className="w-24 shrink-0 px-2 py-1.5 border-r border-gray-100 overflow-hidden">
                    <p className="text-[10px] font-bold text-gray-700 truncate">{task.title}</p>
                    <p className="text-[9px] text-gray-400">{task.priority === 'high' ? '🔥' : task.priority === 'medium' ? '⚡' : '🌿'}</p>
                  </div>
                  <div className="flex flex-1 items-center relative" style={{ height: '36px' }}>
                    {days.map((day) => {
                      const isToday = day === today;
                      return (
                        <div key={day} className={`w-8 shrink-0 h-full border-r border-gray-50 ${isToday ? 'bg-blue-50/50' : ''}`}/>
                      );
                    })}
                    {taskDayIdx >= 0 && (
                      <button
                        onClick={() => onTaskClick(task.id)}
                        className={`absolute top-1/2 -translate-y-1/2 h-6 rounded-lg flex items-center px-2 text-[9px] font-bold text-white shadow-sm transition-all hover:h-7 hover:shadow-md ${task.done ? 'opacity-50' : ''}`}
                        style={{ left: `${taskDayIdx * 32 + 2}px`, minWidth: '28px', background: task.color }}
                        title={task.title}
                      >
                        <span className="truncate">{task.done ? '✓' : task.title.slice(0, 6)}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default function AppShell() {
  const [isMounted, setIsMounted] = useState(false);
  const [session, setSession] = useState<any>(undefined);
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("profile");
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

  const [roles, setRoles] = useState<Role[]>(DEFAULT_ROLES);
  const [memberRoles, setMemberRoles] = useState<MemberRole[]>([]);
  const [editingRole, setEditingRole] = useState<Role|null>(null);
  const [showNewRoleForm, setShowNewRoleForm] = useState(false);
  const [assignEmail, setAssignEmail] = useState("");
  const [assignRoleId, setAssignRoleId] = useState("");

  const [appearance, setAppearance] = useState<AppearanceSettings>({ theme:"system", accentColor:"#3b82f6", fontSize:"md", reduceMotion:false, compactMode:false });
  const [myVisualEffect, setMyVisualEffect] = useState("none");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [privateMode, setPrivateMode] = useState(false);
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTask, setNewTask] = useState({ title:"", desc:"", color:TASK_COLORS[0], open:true, assignees:[] as string[], priority:"medium" as Task["priority"], location:"" });
  const [newAssignee, setNewAssignee] = useState("");
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [myAvailStatus, setMyAvailStatus] = useState<Availability["status"]|null>(null);
  const [availNote, setAvailNote] = useState("");

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [showInvForm, setShowInvForm] = useState(false);
  const [invCats, setInvCats] = useState<string[]>(()=>loadLS("as_inv_cats", INV_CATS));
  const [newInv, setNewInv] = useState({ name:"", total:"", emoji:"📦", image:null as string|null, category:INV_CATS[0] });
  const [showInvCatForm, setShowInvCatForm] = useState(false);
  const [newInvCat, setNewInvCat] = useState("");
  const imgRef = useRef<HTMLInputElement>(null);
  const xlsxImportRef = useRef<HTMLInputElement>(null);
  const [invFilter, setInvFilter] = useState("すべて");
  const [xlsxImporting, setXlsxImporting] = useState(false);

  const [wikis, setWikis] = useState<WikiPage[]>([]);
  const [activeWiki, setActiveWiki] = useState<WikiPage|null>(null);
  const [showWikiForm, setShowWikiForm] = useState(false);
  const [newWiki, setNewWiki] = useState({ title:"", cat:WIKI_CATS[0] });
  const [wikiFilter, setWikiFilter] = useState("すべて");

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [selectionTooltip, setSelectionTooltip] = useState<{text:string;x:number;y:number}|null>(null);
  const pendingSendRef = useRef(false);

  const [members, setMembers] = useState<Member[]>([]);
  const [dmOpen, setDmOpen] = useState<Member|null>(null);
  const [dmMessages, setDmMessages] = useState<DmMessage[]>([]);
  const [dmInput, setDmInput] = useState("");
  const [dmLoading, setDmLoading] = useState(false);
  const dmEndRef = useRef<HTMLDivElement>(null);
  const [groupMessages, setGroupMessages] = useState<DmMessage[]>([]);
  const [groupInput, setGroupInput] = useState("");
  const [groupOpen, setGroupOpen] = useState(false);

  const [mentionTarget, setMentionTarget] = useState<Member|null>(null);
  const [roleChangeTarget, setRoleChangeTarget] = useState<string|null>(null);
  const [taskDetailId, setTaskDetailId] = useState<string|null>(null);
  const [taskEditDesc, setTaskEditDesc] = useState("");
  const [taskEditPhoto, setTaskEditPhoto] = useState<string|null>(null);
  const taskPhotoRef = useRef<HTMLInputElement>(null);
  const spreadsheetRef = useRef<HTMLInputElement>(null);
  const xlsxScheduleRef = useRef<HTMLInputElement>(null);
  const [scheduleImporting, setScheduleImporting] = useState(false);
  const importDataRef = useRef<HTMLInputElement>(null);
  const [teams, setTeams] = useState<Team[]>(loadLS("as_teams", []));
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: "", color: "#3b82f6", icon: "👥", description: "" });
  const [pinnedLinks, setPinnedLinks] = useState<PinnedLink[]>(loadLS("as_pins", []));
  const [showPinForm, setShowPinForm] = useState(false);
  const [newPin, setNewPin] = useState({ title: "", url: "", description: "" });
  const [scheduleView, setScheduleView] = useState<"calendar"|"gantt">("calendar");
  const [geminiApiKey, setGeminiApiKey] = useState(loadLS<string>("as_gemini_key", ""));
  const [discordBotToken, setDiscordBotToken] = useState("");
  const [discordPollChannelId, setDiscordPollChannelId] = useState("");
  const [discordPolls, setDiscordPolls] = useState<Record<string,string>>(loadLS("as_discord_polls", {}));
  const [discordSettingsSaving, setDiscordSettingsSaving] = useState(false);
  const [discordSyncing, setDiscordSyncing] = useState(false);
  const [discordPosting, setDiscordPosting] = useState(false);
  const [displayNameEdit, setDisplayNameEdit] = useState("");
  const [displayNameSaving, setDisplayNameSaving] = useState(false);
  const [aiIconPos, setAiIconPos] = useState<{x:number;y:number}>(()=>loadLS("as_ai_pos", {x:16, y:96}));
  const aiIconDragging = useRef(false);
  const aiIconDragOffset = useRef({x:0,y:0});
  const [attendanceSyncing, setAttendanceSyncing] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string|null>(null);
  const [qrWeekLabel, setQrWeekLabel] = useState("");
  const [qrValidUntil, setQrValidUntil] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [qrScanResult, setQrScanResult] = useState<"checkin"|"checkout"|"error"|null>(null);
  const [qrScanData, setQrScanData] = useState<{durationMinutes?:number}|null>(null);
  const qrVideoRef = useRef<HTMLVideoElement>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // ── 新機能用 state ──────────────────────────────────────────────────────
  // ② 出席統計
  const [monthlyAttendance, setMonthlyAttendance] = useState<AttendanceLog[]>([]);
  const [attendanceStatsLoading, setAttendanceStatsLoading] = useState(false);
  // ③ 繰り返しタスク
  const [newTaskRecurrence, setNewTaskRecurrence] = useState<"none"|"weekly"|"monthly">("none");
  const [newTaskRecurrenceCount, setNewTaskRecurrenceCount] = useState(1);
  // ⑤ 予算・費用管理
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [newExpense, setNewExpense] = useState({ title:"", amount:"", category:"活動費", date:new Date().toISOString().split("T")[0], note:"" });
  const EXPENSE_CATS = ["活動費","機材費","交通費","食費","その他"];
  // ⑥ タスクコメント＋チェックリスト
  const [taskComments, setTaskComments] = useState<TaskComment[]>([]);
  const [taskCommentInput, setTaskCommentInput] = useState("");
  const [newChecklistText, setNewChecklistText] = useState("");
  // ⑧ ファイル共有
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const [sharedFilesLoading, setSharedFilesLoading] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [fileFilter, setFileFilter] = useState("すべて");
  const fileUploadRef = useRef<HTMLInputElement>(null);
  // ⑨ アクティビティログ
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [activityLogsLoading, setActivityLogsLoading] = useState(false);
  // ⑩ メンバー出席履歴
  const [attendanceHistoryMember, setAttendanceHistoryMember] = useState<Member|null>(null);
  const [memberAttendanceLogs, setMemberAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [memberAttendanceLoading, setMemberAttendanceLoading] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const unreadCount = notifications.filter(n=>!n.read).length;

  // ── Discord チャンネル同期 state ─────────────────────────────────────────
  const [discordGuildId, setDiscordGuildId] = useState("");
  const [discordChannels, setDiscordChannels] = useState<DiscordChannel[]>([]);
  const [discordChannelsLoading, setDiscordChannelsLoading] = useState(false);
  const [activeDiscordChannel, setActiveDiscordChannel] = useState<DiscordChannel|null>(null);
  const [discordMessages, setDiscordMessages] = useState<DiscordMessage[]>([]);
  const [discordChatInput, setDiscordChatInput] = useState("");
  const [discordChatSending, setDiscordChatSending] = useState(false);
  const [discordMessagesLoading, setDiscordMessagesLoading] = useState(false);
  const lastDiscordMsgId = useRef<string>("");
  const discordPollRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const discordMsgEndRef = useRef<HTMLDivElement>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  // ── ユーザー情報の抽出 ───────────────────────────────────────────
  const userProfile = session?.user?.user_metadata ?? {};
  const displayName = userProfile?.full_name ?? session?.user?.email ?? "ユーザー";
  const currentUserEmail = session?.user?.email ?? userProfile?.full_name ?? "me";
  const currentUserId = session?.user?.id ?? "";

  const myMemberRecord = members.find(m=>m.email===currentUserEmail);
  const myLocalRole = memberRoles.find(m=>m.email===currentUserEmail);
  const myEffectiveRoleId = myMemberRecord?.role_id ?? myLocalRole?.roleId ?? "member";
  const myRoleData = roles.find(r=>r.id===myEffectiveRoleId) ?? roles.find(r=>r.id==="member") ?? DEFAULT_ROLES.find(r=>r.id==="member")!;
  const perms = myRoleData?.permissions ?? DEFAULT_PERMISSIONS;
  const canManageRoles = perms.manageRoles || perms.manageMembers;

  const selectedTasks = tasks.filter(t=>t.date===selectedDate);
  const selectedAvail = availability.filter(a=>a.date===selectedDate);

  const completedTasks = tasks.filter(t=>t.done).length;
  const todayTasks = tasks.filter(t=>t.date===new Date().toISOString().split("T")[0]);
  const lowStock = inventory.filter(i=>i.stock<i.total*0.3);
  // ──────────────────────────────────────────────────────────────────────────

  // ★グループチャット購読・クリーンアップ
  useEffect(()=>{
    if(!groupOpen) return;
    const supabase=createClient();
    let channel: any;
    const load=async()=>{
      const {data}=await supabase.from("messages").select("*").eq("channel_id","general").order("created_at",{ascending:true}).limit(100);
      if(data) setGroupMessages(data as DmMessage[]);
      channel = supabase.channel("general_msgs").on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`channel_id=eq.general`},(p)=>{
        const incoming = p.new as DmMessage;
        setGroupMessages(prev=>{
          const isDupe = prev.some(m=>m.sender_id===incoming.sender_id&&m.content===incoming.content&&Math.abs(new Date(m.created_at).getTime()-new Date(incoming.created_at).getTime())<5000);
          if(isDupe) return prev.map(m=>m.sender_id===incoming.sender_id&&m.content===incoming.content?{...m,id:incoming.id}:m);
          return [...prev,incoming];
        });
      }).subscribe();
    };
    load();
    return () => { if (channel) supabase.removeChannel(channel); };
  },[groupOpen]);

  // ★DMチャット購読・クリーンアップ（問題解決）
  useEffect(()=>{
    if(!dmOpen) return;
    setDmMessages([]); // 開いた瞬間に前のメッセージをクリア
    const supabase=createClient();
    let channel: any;
    const load=async()=>{
      const {data:{user}}=await supabase.auth.getUser();
      if(!user)return;
      const channelId=`dm:${[user.id,dmOpen.id].sort().join(":")}`;
      const {data}=await supabase.from("messages").select("*").eq("channel_id",channelId).order("created_at",{ascending:true}).limit(50);
      if(data) setDmMessages(data as DmMessage[]);
      channel = supabase.channel(`dm_${channelId.replace(/:/g,"_")}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`channel_id=eq.${channelId}`},(p)=>{
        const incoming = p.new as DmMessage;
        setDmMessages(prev=>{
          const isDuplicate = prev.some(m=>m.sender_id===incoming.sender_id && m.content===incoming.content && Math.abs(new Date(m.created_at).getTime()-new Date(incoming.created_at).getTime())<5000);
          if(isDuplicate) return prev.map(m=>m.sender_id===incoming.sender_id&&m.content===incoming.content?{...m,id:incoming.id,created_at:incoming.created_at}:m);
          return [...prev, incoming];
        });
      }).subscribe();
    };
    load();
    return () => { if (channel) supabase.removeChannel(channel); };
  },[dmOpen?.id]);

  useEffect(() => {
    setIsMounted(true);
    registerSW(() => setUpdateAvailable(true));
    const supabase = createClient();

    function handleSelectionChange() {
      try {
        const sel = window.getSelection();
        const text = sel?.toString().trim() ?? "";
        const activeEl = document.activeElement;
        const isInput = activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement;
        if (isInput || text.length <= 3 || text.length >= 500) { setSelectionTooltip(null); return; }
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) setSelectionTooltip({ text, x: rect.left + rect.width / 2, y: rect.top });
        }
      } catch { setSelectionTooltip(null); }
    }
    function handlePointerDown(e: PointerEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-selection-tooltip]")) setSelectionTooltip(null);
    }
    document.addEventListener("pointerup", handleSelectionChange);
    document.addEventListener("pointerdown", handlePointerDown);

    const urlParams = new URLSearchParams(window.location.search);
    const err = urlParams.get("error_description")||urlParams.get("error");
    const cerr = urlParams.get("auth_error");
    if(err||cerr){ setErrorMessage(`【認証失敗】${err??""} — ${cerr??"なし"}`); window.history.replaceState({},document.title,window.location.pathname); }
    const tab = urlParams.get("tab") as Tab|null;
    if(tab) setActiveTab(tab);

    supabase.auth.getUser().then(({data:{user},error:ue})=>{
      if(ue){setSession(null);return;}
      if(user) supabase.auth.getSession().then(({data:{session:s}})=>setSession(s));
      else setSession(null);
    });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_,s)=>setSession(s));

    const loadedMemberRoles = loadLS<MemberRole[]>("as_memberroles", []);
    setRoles(loadLS("as_roles", DEFAULT_ROLES));
    setMemberRoles(loadedMemberRoles);
    setAppearance(loadLS("as_appearance", {theme:"system",accentColor:"#3b82f6",fontSize:"md",reduceMotion:false,compactMode:false}));
    const loadedVisualEffect = loadLS("as_myeffect", "none");
    setMyVisualEffect(loadedVisualEffect);
    setChatMessages(loadLS("as_chat", []));
    setNotifEnabled(typeof Notification!=="undefined"&&Notification.permission==="granted");

    const initSupabase = async () => {
      try {
        const { data: membersData } = await supabase.from("members").select("*").order("created_at");
        if (membersData) setMembers(membersData);

        const { data: tasksData } = await supabase.from("tasks").select("*").order("date");
        if (tasksData && tasksData.length > 0) setTasks(tasksData.map((t:any)=>({
          id:t.id, title:t.title, date:t.date, description:t.description||"",
          assignees:t.assignees||[], openJoin:t.open_join, color:t.color,
          done:t.done, priority:t.priority, location:t.location||""
        })));

        const { data: invData } = await supabase.from("inventory").select("*").order("created_at");
        if (invData && invData.length > 0) {
          // DBにあるカテゴリをinvCatsに反映（カスタムカテゴリを保持）
          const dbCats = [...new Set(invData.map((i:any) => i.category).filter(Boolean))] as string[];
          setInvCats(prev => {
            const merged = [...new Set([...prev, ...dbCats])];
            saveLS("as_inv_cats", merged);
            return merged;
          });
          setInventory(invData.map((i:any)=>({
            id:i.id, name:i.name, stock:i.stock ?? 0, total:i.total ?? 1,
            image:i.image||"📦", isEmoji:i.is_emoji ?? true, category:i.category || "その他"
          })));
        }

        const { data: wikiData } = await supabase.from("wiki_pages").select("*").order("updated_at", {ascending:false});
        if (wikiData && wikiData.length > 0) setWikis(wikiData.map((w:any)=>({
          id:w.id, title:w.title, content:w.content, category:w.category,
          updatedAt:w.updated_at?.split("T")[0]||new Date().toISOString().split("T")[0],
          author:w.author||"", views:w.views||0
        })));

        const { data: availData } = await supabase.from("availability").select("*");
        if (availData) setAvailability(availData.map((a:any)=>({
          userId:a.user_id, name:a.user_email||a.user_id, date:a.date, status:a.status, note:a.note||""
        })));

        const { data: notifData } = await supabase.from("notifications").select("*").order("created_at",{ascending:false}).limit(50);
        if (notifData) setNotifications(notifData);

        const { data: rolesData } = await supabase.from("roles").select("*");
        if (rolesData && rolesData.length > 0) setRoles(rolesData.map((r:any)=>({
          id:r.id, name:r.name, color:r.color, icon:r.icon,
          permissions:r.permissions||DEFAULT_PERMISSIONS, isDefault:r.is_default,
          visualEffect:r.visual_effect||"none", createdAt:r.created_at?.split("T")[0]||""
        })));

        const { data: { user: u } } = await supabase.auth.getUser();
        if (u) {
          // DiscordのユーザーID（OAuthプロバイダーのID）を取得
          const providerId = u.user_metadata?.provider_id || u.user_metadata?.sub;
          const isOwnerAccount = providerId === TARGET_OWNER_DISCORD_ID;

          const { data: existingUser } = await supabase.from("members").select("*").eq("id", u.id).maybeSingle();
          
          if (existingUser) {
            if (existingUser.visual_effect && existingUser.visual_effect !== "none") {
              setMyVisualEffect(existingUser.visual_effect);
            }

            await supabase.from("members").update({
              email: u.email,
              display_name: u.user_metadata?.full_name || u.email,
              avatar_url: u.user_metadata?.avatar_url,
              discord_id: providerId,
              role_id: isOwnerAccount ? "owner" : existingUser.role_id, // 指定されたDiscordIDなら強制的にオーナー
              online_at: new Date().toISOString(),
            }).eq("id", u.id);

            // オーナーとして昇格した場合、UIの表示も即座に更新する
            if (isOwnerAccount && existingUser.role_id !== "owner") {
              setMembers(p=>p.map(m=>m.id===u.id?{...m,role_id:"owner"}:m));
              setMemberRoles(p=>[...p.filter(m=>m.email!==u.email),{email:u.email||"",roleId:"owner",assignedAt:new Date().toISOString(),assignedBy:"system"}]);
            }
          } else {
            const preAssigned = loadedMemberRoles.find(mr => mr.email === u.email);
            const initialRole = isOwnerAccount ? "owner" : (preAssigned?.roleId || "member");
            await supabase.from("members").insert({
              id: u.id, email: u.email,
              display_name: u.user_metadata?.full_name || u.email,
              avatar_url: u.user_metadata?.avatar_url,
              discord_id: providerId,
              role_id: initialRole,
              visual_effect: loadedVisualEffect || "none",
              online_at: new Date().toISOString(),
            });
          }
        }
      } catch(e) { console.error("[AeroSync] Supabase init failed:", e); }
    };
    initSupabase();

    const tasksSub = supabase.channel("tasks_changes").on("postgres_changes",{event:"*",schema:"public",table:"tasks"},(payload)=>{
      if(payload.eventType==="INSERT") setTasks(p=>[...p,{id:payload.new.id,title:payload.new.title,date:payload.new.date,description:payload.new.description||"",assignees:payload.new.assignees||[],openJoin:payload.new.open_join,color:payload.new.color,done:payload.new.done,priority:payload.new.priority,location:payload.new.location||""}]);
      if(payload.eventType==="UPDATE") setTasks(p=>p.map(t=>t.id===payload.new.id?{...t,done:payload.new.done,assignees:payload.new.assignees||t.assignees}:t));
      if(payload.eventType==="DELETE") setTasks(p=>p.filter(t=>t.id!==(payload.old as any).id));
    }).subscribe();

    const invSub = supabase.channel("inventory_changes").on("postgres_changes",{event:"*",schema:"public",table:"inventory"},(payload)=>{
      if(payload.eventType==="INSERT") setInventory(p=>[...p,{id:payload.new.id,name:payload.new.name,stock:payload.new.stock,total:payload.new.total,image:payload.new.image||"📦",isEmoji:payload.new.is_emoji,category:payload.new.category}]);
      if(payload.eventType==="UPDATE") setInventory(p=>p.map(i=>i.id===payload.new.id?{...i,stock:payload.new.stock}:i));
      if(payload.eventType==="DELETE") setInventory(p=>p.filter(i=>i.id!==(payload.old as any).id));
    }).subscribe();

    const wikiSub = supabase.channel("wiki_changes").on("postgres_changes",{event:"*",schema:"public",table:"wiki_pages"},(payload)=>{
      if(payload.eventType==="INSERT"||payload.eventType==="UPDATE") {
        const w={id:payload.new.id,title:payload.new.title,content:payload.new.content,category:payload.new.category,updatedAt:payload.new.updated_at?.split("T")[0]||"",author:payload.new.author||"",views:payload.new.views||0};
        setWikis(p=>{ const idx=p.findIndex(x=>x.id===w.id); return idx>=0?p.map((x,i)=>i===idx?w:x):[...p,w]; });
      }
      if(payload.eventType==="DELETE") setWikis(p=>p.filter(w=>w.id!==(payload.old as any).id));
    }).subscribe();

    const availSub = supabase.channel("avail_changes").on("postgres_changes",{event:"*",schema:"public",table:"availability"},(payload)=>{
      const n=payload.new as any; const o=payload.old as any;
      const a={userId:n?.user_id,name:n?.user_email||"",date:n?.date,status:n?.status,note:n?.note||""};
      if(payload.eventType==="INSERT"||payload.eventType==="UPDATE") setAvailability(p=>[...p.filter(x=>!(x.userId===a.userId&&x.date===a.date)),a]);
      if(payload.eventType==="DELETE") setAvailability(p=>p.filter(x=>!(x.userId===o?.user_id&&x.date===o?.date)));
    }).subscribe();

    const membersSub = supabase.channel("members_changes").on("postgres_changes",{event:"*",schema:"public",table:"members"},(payload)=>{
      if(payload.eventType==="INSERT"||payload.eventType==="UPDATE") {
        const updated = payload.new as Member;
        setMembers(p=>{const idx=p.findIndex(m=>m.id===updated.id);return idx>=0?p.map((m,i)=>i===idx?{...m,...updated}:m):[...p,updated];});
        if(updated.role_id) setMemberRoles(p=>[...p.filter(mr=>mr.email!==updated.email),{email:updated.email||"",roleId:updated.role_id,assignedAt:new Date().toISOString().split("T")[0],assignedBy:"sync"}]);
      }
    }).subscribe();

    const notifSub = supabase.channel("notif_changes").on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications"},(payload)=>{
      setNotifications(p=>[payload.new as AppNotification,...p]);
      if(typeof Notification!=="undefined"&&Notification.permission==="granted") new Notification(payload.new.title,{body:payload.new.body,icon:"/icons/icon-192.png"});
    }).subscribe();

    const rolesSub = supabase.channel("roles_changes").on("postgres_changes",{event:"*",schema:"public",table:"roles"},(payload)=>{
      if(payload.eventType==="INSERT") {
        const r = payload.new;
        setRoles(p=>[...p.filter(x=>x.id!==r.id), { id:r.id, name:r.name, color:r.color, icon:r.icon, permissions:r.permissions||DEFAULT_PERMISSIONS, isDefault:r.is_default, visualEffect:r.visual_effect||"none", createdAt:r.created_at?.split("T")[0]||"" }]);
      }
      if(payload.eventType==="UPDATE") {
        const r = payload.new;
        setRoles(p=>p.map(x=>x.id===r.id?{ ...x, name:r.name, color:r.color, icon:r.icon, permissions:r.permissions||DEFAULT_PERMISSIONS, visualEffect:r.visual_effect||"none" }:x));
      }
      if(payload.eventType==="DELETE") setRoles(p=>p.filter(x=>x.id!==(payload.old as any).id));
    }).subscribe();

    return () => {
      try { tasksSub.unsubscribe(); invSub.unsubscribe(); wikiSub.unsubscribe(); availSub.unsubscribe(); membersSub.unsubscribe(); notifSub.unsubscribe(); rolesSub.unsubscribe(); } catch {}
      subscription.unsubscribe();
      document.removeEventListener("pointerup", handleSelectionChange);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  useEffect(()=>{
    if(!isMounted)return;
    saveLS("as_roles", roles);
    saveLS("as_memberroles", memberRoles);
    saveLS("as_appearance", appearance);
    saveLS("as_myeffect", myVisualEffect);
    saveLS("as_chat", chatMessages);
    saveLS("as_teams", teams);
    saveLS("as_pins", pinnedLinks);
    saveLS("as_gemini_key", geminiApiKey);
    saveLS("as_discord_polls", discordPolls);
  },[roles,memberRoles,appearance,myVisualEffect,chatMessages,teams,pinnedLinks,geminiApiKey,discordPolls,isMounted]);

  useEffect(()=>{ chatEndRef.current?.scrollIntoView({behavior:"smooth"}); },[chatMessages]);
  useEffect(()=>{ dmEndRef.current?.scrollIntoView({behavior:"smooth"}); },[dmMessages]);
  useEffect(()=>{ discordMsgEndRef.current?.scrollIntoView({behavior:"smooth"}); },[discordMessages]);
  useEffect(()=>{ if(searchOpen) setTimeout(()=>searchRef.current?.focus(),100); },[searchOpen]);

  useEffect(()=>{
    const my = availability.find(a=>(a.userId===currentUserId||a.userId===currentUserEmail)&&a.date===selectedDate);
    setMyAvailStatus(my?.status??null); setAvailNote(my?.note??"");
  },[selectedDate,availability,currentUserId,currentUserEmail]);

  const handleDiscordLogin = async()=>{
    setAuthError(null); setAuthLoading(true);
    try { const s=createClient(); const{error}=await s.auth.signInWithOAuth({provider:"discord",options:{redirectTo:`${window.location.origin}/auth/callback`}}); if(error)throw error; }
    catch(e:any){setAuthError(e.message);setAuthLoading(false);}
  };
  const handleEmailAuth = async()=>{
    if(!email.trim()||!password.trim()){setAuthError("入力してください");return;}
    setAuthError(null); setAuthLoading(true);
    try{
      const s=createClient();
      if(authMode==="login"){const{error}=await s.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;}
      else{const{error}=await s.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:`${window.location.origin}/auth/callback`}});if(error)throw error;setAuthMode("check_email");}
    }catch(e:any){setAuthError(e.message);}finally{setAuthLoading(false);}
  };
  const handleLogout = async()=>{ const s=createClient(); await s.auth.signOut(); };

  // ── DB Sync Functions for Roles (Pessimistic Update) ─────────────────────
  const updateMemberRole = async (memberId: string, newRoleId: string) => {
    if (!canManageRoles) return;
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    try {
      const supabase = createClient();
      const { data, error } = await supabase.from("members").update({ role_id: newRoleId }).eq("id", memberId).select();
      
      if (error) {
        alert(`ロールの更新エラー: ${error.message}`);
        return;
      } 
      if (!data || data.length === 0) {
        alert("データベースの更新がブロックされました。Supabaseで public.members テーブルの RLSポリシー（UPDATE権限）が許可されているか確認してください。");
        return;
      }

      // DBの成功を確認してからUIに反映
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role_id: newRoleId } : m));
      if (member.email) {
        setMemberRoles(prev => [
          ...prev.filter(mr => mr.email !== member.email),
          { email: member.email, roleId: newRoleId, assignedAt: new Date().toISOString(), assignedBy: currentUserEmail }
        ]);
      }
      setRoleChangeTarget(null);
    } catch (e) {
      console.error("role update catch err:", e);
      alert("予期せぬエラーが発生しました");
    }
  };

  const saveRole = async (role: Role) => {
    if (!canManageRoles) return;
    const isNew = !roles.find(r => r.id === role.id);
    
    try {
      const supabase = createClient();
      if (isNew) {
        const { data, error } = await supabase.from("roles").insert({
          id: role.id, name: role.name, color: role.color, icon: role.icon,
          permissions: role.permissions, is_default: role.isDefault, visual_effect: role.visualEffect
        }).select();
        if(error) { alert(`作成エラー: ${error.message}`); return; }
        if (!data || data.length === 0) { alert("ロール作成がブロックされました。roles テーブルの RLSポリシーを確認してください。"); return; }
      } else {
        const { data, error } = await supabase.from("roles").update({
          name: role.name, color: role.color, icon: role.icon,
          permissions: role.permissions, is_default: role.isDefault, visual_effect: role.visualEffect
        }).eq("id", role.id).select();
        if(error) { alert(`更新エラー: ${error.message}`); return; }
        if (!data || data.length === 0) { alert("ロール更新がブロックされました。roles テーブルの RLSポリシーを確認してください。"); return; }
      }

      // 成功後にUI更新
      setRoles(prev => isNew ? [...prev, role] : prev.map(r => r.id === role.id ? role : r));
      setEditingRole(null);
      setShowNewRoleForm(false);
    } catch(e) { console.error("Role save error:", e); }
  };

  const deleteRole = async (roleId: string) => {
    if (!canManageRoles) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from("roles").delete().eq("id", roleId);
      if(error) { alert(`削除エラー: ${error.message}`); return; }
      
      setRoles(prev => prev.filter(r => r.id !== roleId));
      setEditingRole(null);
    } catch(e) { console.error("Role delete error:", e); }
  };

  const setMyAvail = async(status:Availability["status"])=>{
    setMyAvailStatus(status);
    const sb=createClient();
    const {data:{user}}=await sb.auth.getUser();
    if(!user)return;
    const myName=user.user_metadata?.full_name||user.email||"";
    setAvailability(prev=>[...prev.filter(a=>!(a.userId===user.id&&a.date===selectedDate)),{userId:user.id,name:myName,date:selectedDate,status,note:availNote}]);
    try {
      await sb.from("availability").upsert({user_id:user.id,user_email:currentUserEmail,date:selectedDate,status,note:availNote},{onConflict:"user_id,date"});
    } catch(e){console.log("avail sync err",e);}
  };

  const addTask = useCallback(async()=>{
    if(!newTask.title.trim())return;
    const supabase = createClient();
    const { data:{ user } } = await supabase.auth.getUser();

    // 繰り返しタスク: 日付リストを生成
    const dates: string[] = [selectedDate];
    if (newTaskRecurrence !== "none" && newTaskRecurrenceCount > 1) {
      for (let i = 1; i < newTaskRecurrenceCount; i++) {
        const base = new Date(selectedDate);
        if (newTaskRecurrence === "weekly") base.setDate(base.getDate() + 7 * i);
        else base.setMonth(base.getMonth() + i);
        dates.push(base.toISOString().split("T")[0]);
      }
    }

    for (const date of dates) {
      const localId = `${Date.now()}_${date}`;
      setTasks(prev=>[...prev,{id:localId,title:newTask.title.trim(),date,description:newTask.desc.trim(),done:false,color:newTask.color,openJoin:newTask.open,assignees:newTask.assignees,priority:newTask.priority,location:newTask.location,recurrence:newTaskRecurrence,recurrenceCount:newTaskRecurrenceCount}]);
      try {
        const { data } = await supabase.from("tasks").insert({
          title:newTask.title.trim(), date, description:newTask.desc.trim(),
          done:false, color:newTask.color, open_join:newTask.open, assignees:newTask.assignees,
          priority:newTask.priority, location:newTask.location, created_by:user?.id,
          recurrence:newTaskRecurrence, recurrence_count:newTaskRecurrenceCount,
        }).select().single();
        if(data) {
          setTasks(p=>p.map(t=>t.id===localId?{...t,id:data.id}:t));
          logActivity("タスク作成", "task", data.id, { title: newTask.title.trim() });
        }
      } catch(e) { console.log("Task sync error:", e); }
    }

    setNewTask({title:"",desc:"",color:TASK_COLORS[0],open:true,assignees:[],priority:"medium",location:""});
    setNewTaskRecurrence("none"); setNewTaskRecurrenceCount(1);
    setShowTaskForm(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[newTask,selectedDate,newTaskRecurrence,newTaskRecurrenceCount]);

  const addInventory = useCallback(async()=>{
    if(!newInv.name.trim()||!newInv.total)return;
    const n=parseInt(newInv.total,10); if(isNaN(n)||n<1)return;
    const supabase = createClient();
    const localId = Date.now().toString();
    setInventory(prev=>[...prev,{id:localId,name:newInv.name.trim(),stock:n,total:n,image:newInv.image??newInv.emoji,isEmoji:!newInv.image,category:newInv.category}]);
    setNewInv(p=>({name:"",total:"",emoji:"📦",image:null,category:p.category})); setShowInvForm(false);
    try {
      const { data } = await supabase.from("inventory").insert({
        name:newInv.name.trim(), stock:n, total:n,
        image:newInv.image??newInv.emoji, is_emoji:!newInv.image, category:newInv.category
      }).select().single();
      if(data) {
        setInventory(p=>p.map(i=>i.id===localId?{...i,id:data.id}:i));
        logActivity("機材追加", "inventory", data.id, { name: newInv.name.trim() });
      }
    } catch(e) { console.log("Inventory sync error:", e); }
  },[newInv]);

  const addWiki = useCallback(()=>{
    if(!newWiki.title.trim())return;
    const page:WikiPage={id:Date.now().toString(),title:newWiki.title.trim(),content:`# ${newWiki.title.trim()}\n\nここに内容を書いてください。`,category:newWiki.cat,updatedAt:new Date().toISOString().split("T")[0],author:currentUserEmail,views:0};
    setWikis(prev=>[...prev,page]); setNewWiki({title:"",cat:WIKI_CATS[0]}); setShowWikiForm(false); setActiveWiki(page);
  },[newWiki,currentUserEmail]);

  const sendChat = async()=>{
    if(!chatInput.trim()||chatLoading)return;
    const userMsg:ChatMessage={role:"user",content:chatInput.trim(),ts:Date.now()};
    setChatMessages(prev=>[...prev,userMsg]); setChatInput(""); setChatLoading(true);
    const context=`タスク数:${tasks.length},機材数:${inventory.length},Wikiページ数:${wikis.length},今日:${new Date().toISOString().split("T")[0]},タスク:${tasks.slice(0,5).map(t=>t.title).join(",")}`;
    try {
      const res=await fetch("/api/gemini",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:[...chatMessages,userMsg],context,apiKey:geminiApiKey||undefined})});
      const data=await res.json();
      const reply = data.reply || data.error || "エラーが発生しました";
      const sources: string[] = data.sources ?? [];
      const fullReply = sources.length > 0 ? reply + `\n\n🔍 参照: ${sources.slice(0,2).join(', ')}` : reply;
      setChatMessages(prev=>[...prev,{role:"assistant",content:fullReply,ts:Date.now()}]);
    } catch { setChatMessages(prev=>[...prev,{role:"assistant",content:"接続エラーが発生しました",ts:Date.now()}]); }
    finally { setChatLoading(false); }
  };

  const sendDm = async()=>{
    if(!dmInput.trim()||!dmOpen||dmLoading)return;
    const supabase=createClient();
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return;
    const channelId=`dm:${[user.id,dmOpen.id].sort().join(":")}`;
    const msg:DmMessage={id:Date.now().toString(),channel_id:channelId,channel_type:"dm",sender_id:user.id,sender_email:user.email||"",sender_name:user.user_metadata?.full_name||user.email||"",content:dmInput.trim(),mentions:[],created_at:new Date().toISOString()};
    setDmMessages(p=>[...p,msg]);
    setDmInput("");setDmLoading(true);
    try {
      await supabase.from("messages").insert({channel_id:channelId,channel_type:"dm",sender_id:user.id,sender_email:user.email,sender_name:user.user_metadata?.full_name||user.email,content:msg.content,mentions:[]});
      await fetch("/api/notify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"message",targetUserId:dmOpen.id,targetDiscordId:dmOpen.discord_id,message:{title:`📩 ${user.user_metadata?.full_name||user.email}からDM`,body:msg.content,data:{channelId}}})});
    } catch(e){console.log("DM send error:",e);}
    finally{setDmLoading(false);}
  };

  const sendGroupMessage = async(mentionMember?:Member)=>{
    if(!groupInput.trim())return;
    const supabase=createClient();
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)return;
    const mentions=mentionMember?[mentionMember.id]:[];
    const msg:DmMessage={id:Date.now().toString(),channel_id:"general",channel_type:"group",sender_id:user.id,sender_email:user.email||"",sender_name:user.user_metadata?.full_name||user.email||"",content:groupInput.trim(),mentions,created_at:new Date().toISOString()};
    setGroupMessages(p=>[...p,msg]);
    setGroupInput("");setMentionTarget(null);
    try {
      await supabase.from("messages").insert({channel_id:"general",channel_type:"group",sender_id:user.id,sender_email:user.email,sender_name:user.user_metadata?.full_name||user.email,content:msg.content,mentions});
      if(mentionMember){
        await fetch("/api/notify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"mention",targetUserId:mentionMember.id,targetDiscordId:mentionMember.discord_id,channelId:process.env.NEXT_PUBLIC_DISCORD_CHANNEL_ID,message:{title:`🔔 @${user.user_metadata?.full_name||user.email}からメンション`,body:msg.content,data:{}}})});
      }
    } catch(e){console.log("Group msg error:",e);}
  };

  const importSpreadsheet = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      const lines = text.trim().split(/\r?\n/);
      if (lines.length < 2) return;
      const sep = text.includes('\t') ? '\t' : ',';
      const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
      const dateIdx = headers.findIndex(h => h.includes('日付') || h.includes('date') || h === '日');
      const titleIdx = headers.findIndex(h => h.includes('タスク') || h.includes('作業') || h.includes('title') || h.includes('名'));
      const descIdx = headers.findIndex(h => h.includes('説明') || h.includes('description') || h.includes('内容'));
      const priorityIdx = headers.findIndex(h => h.includes('優先') || h.includes('priority'));
      const assigneeIdx = headers.findIndex(h => h.includes('担当') || h.includes('assignee') || h.includes('メンバー'));
      const colorIdx = headers.findIndex(h => h.includes('カラー') || h.includes('color') || h.includes('色'));
      if (dateIdx === -1 || titleIdx === -1) {
        alert('スプレッドシートに「日付」と「タスク名」の列が必要です。\n検出されたヘッダー: ' + headers.join(', '));
        return;
      }
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      let imported = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
        if (!cols[dateIdx] || !cols[titleIdx]) continue;
        let dateStr = cols[dateIdx];
        if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(dateStr)) {
          dateStr = dateStr.replace(/\//g, '-').replace(/(\d{4})-(\d{1})-/, '$1-0$2-').replace(/-(\d{1})$/, '-0$1');
        } else if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(dateStr)) {
          const parts = dateStr.split(/[\/\-]/);
          dateStr = `${parts[2]}-${parts[0].padStart(2,'0')}-${parts[1].padStart(2,'0')}`;
        }
        const title = cols[titleIdx];
        const desc = descIdx >= 0 ? cols[descIdx] || '' : '';
        const priority: Task['priority'] = priorityIdx >= 0 && cols[priorityIdx]
          ? (cols[priorityIdx].includes('高') || cols[priorityIdx].toLowerCase().includes('high') ? 'high'
            : cols[priorityIdx].includes('低') || cols[priorityIdx].toLowerCase().includes('low') ? 'low'
            : 'medium')
          : 'medium';
        const assignees = assigneeIdx >= 0 && cols[assigneeIdx] ? cols[assigneeIdx].split(/[,、]/).map(a=>a.trim()).filter(Boolean) : [];
        const color = colorIdx >= 0 && cols[colorIdx] ? cols[colorIdx] : TASK_COLORS[imported % TASK_COLORS.length];
        const localId = `import_${Date.now()}_${i}`;
        setTasks(prev => [...prev, { id: localId, title, date: dateStr, description: desc, done: false, color, openJoin: true, assignees, priority, location: '' }]);
        try {
          const { data } = await supabase.from('tasks').insert({
            title, date: dateStr, description: desc, done: false, color, open_join: true, assignees, priority, location: '', created_by: user?.id
          }).select().single();
          if (data) setTasks(p => p.map(t => t.id === localId ? { ...t, id: data.id } : t));
        } catch (e) { console.log('import task err', e); }
        imported++;
      }
      alert(`${imported}件のタスクをインポートしました！`);
    };
    reader.readAsText(file, 'UTF-8');
  }, []);

  // ── Excel(.xlsx/.xls)スケジュールインポート ─────────────────────────
  const importExcelSchedule = async (file: File) => {
    setScheduleImporting(true);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      let imported = 0;
      const errors: string[] = [];

      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (rows.length === 0) continue;

        for (const row of rows) {
          // タイトル列を柔軟に検出
          const title = String(
            row["タイトル"] || row["title"] || row["件名"] || row["予定"] ||
            row["イベント"] || row["タスク名"] || row["タスク"] || row["作業"] || ""
          ).trim();
          if (!title) continue;

          // 日付列を柔軟に検出・変換
          const rawDate =
            row["日付"] || row["date"] || row["開始日"] || row["日"] ||
            row["開催日"] || row["実施日"] || row["予定日"] || "";

          let dateStr = selectedDate; // フォールバックは選択中の日付
          if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
            // xlsx が Date オブジェクトとして解析した場合
            dateStr = rawDate.toISOString().split("T")[0];
          } else if (typeof rawDate === "number" && rawDate > 0) {
            // Excel のシリアル日付（1900年起点）
            const d = new Date(Math.round((rawDate - 25569) * 86400000));
            dateStr = d.toISOString().split("T")[0];
          } else if (typeof rawDate === "string" && rawDate.trim()) {
            const s = rawDate.trim();
            // YYYY-MM-DD or YYYY/MM/DD
            if (/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/.test(s)) {
              dateStr = s.replace(/\//g, "-").replace(/-(\d{1})-/, "-0$1-").replace(/-(\d{1})$/, "-0$1");
            // MM/DD/YYYY or MM-DD-YYYY
            } else if (/^\d{1,2}[-\/]\d{1,2}[-\/]\d{4}$/.test(s)) {
              const p = s.split(/[-\/]/);
              dateStr = `${p[2]}-${p[0].padStart(2,"0")}-${p[1].padStart(2,"0")}`;
            // YYYY年MM月DD日
            } else if (/^\d{4}年\d{1,2}月\d{1,2}日$/.test(s)) {
              const m = s.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
              if (m) dateStr = `${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`;
            }
          }

          // 日付の妥当性チェック
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            errors.push(`「${title}」の日付「${rawDate}」を解析できませんでした`);
            continue;
          }

          const desc = String(row["説明"] || row["description"] || row["内容"] || row["備考"] || "").trim();
          const rawPriority = String(row["優先度"] || row["priority"] || "").toLowerCase();
          const priority: Task["priority"] =
            rawPriority.includes("高") || rawPriority.includes("high") ? "high" :
            rawPriority.includes("低") || rawPriority.includes("low") ? "low" : "medium";
          const location = String(row["場所"] || row["location"] || row["会場"] || "").trim();
          const rawColor = String(row["カラー"] || row["color"] || row["色"] || "").trim();
          const color = TASK_COLORS.includes(rawColor) ? rawColor : TASK_COLORS[imported % TASK_COLORS.length];

          const localId = `xl_sched_${Date.now()}_${Math.random()}`;
          const task: Task = { id: localId, title, date: dateStr, description: desc, assignees: [], openJoin: true, color, done: false, priority, location };
          setTasks(p => [...p, task]);
          try {
            const { data } = await sb.from("tasks").insert({
              title, date: dateStr, description: desc, assignees: [], open_join: true, color, done: false, priority, location, created_by: user?.id
            }).select().single();
            if (data) setTasks(p => p.map(t => t.id === localId ? { ...t, id: data.id } : t));
          } catch (e) { console.log("excel sched import err", e); }
          imported++;
        }
      }

      let msg = `✅ ${imported}件のスケジュールをカレンダーに追加しました！`;
      if (errors.length > 0) msg += `\n\n⚠️ スキップ（日付エラー）:\n${errors.slice(0,5).join("\n")}`;
      alert(msg);
    } catch (e: any) {
      alert(`Excelインポート失敗: ${e.message}`);
    } finally {
      setScheduleImporting(false);
    }
  };

  const postDiscordPoll = async () => {
    const chId = discordPollChannelId || process.env.NEXT_PUBLIC_DISCORD_CHANNEL_ID;
    if (!discordBotToken) { alert("設定でDiscord Bot Tokenを入力してください"); return; }
    if (!chId) { alert("設定でDiscord投票チャンネルIDを入力してください"); return; }
    setDiscordPosting(true);
    try {
      const res = await fetch("/api/discord/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: chId,
          date: selectedDate,
          botToken: discordBotToken,
          existingMessageId: discordPolls[selectedDate] || null,
        }),
      });
      const data = await res.json();
      if (data.error) { alert(`エラー: ${data.error}`); return; }
      if (data.messageId) {
        setDiscordPolls(prev => ({ ...prev, [selectedDate]: data.messageId }));
      }
      alert(data.updated ? "Discord投票を更新しました ✅" : "Discord投票を送信しました ✅");
    } catch (e: any) { alert(`送信失敗: ${e.message}`); }
    finally { setDiscordPosting(false); }
  };

  const syncDiscordReactions = async () => {
    const chId = discordPollChannelId || process.env.NEXT_PUBLIC_DISCORD_CHANNEL_ID;
    const messageId = discordPolls[selectedDate];
    if (!discordBotToken || !messageId || !chId) return;
    setDiscordSyncing(true);
    try {
      const res = await fetch("/api/discord/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: chId, messageId, date: selectedDate, botToken: discordBotToken }),
      });
      const data = await res.json();
      if (data.error) { alert(`同期エラー: ${data.error}`); return; }
      // Refresh local availability state from DB
      const sb = createClient();
      const { data: fresh } = await sb.from("availability").select("*").eq("date", selectedDate);
      if (fresh) {
        setAvailability(prev => [
          ...prev.filter(a => a.date !== selectedDate),
          ...fresh.map((a: any) => ({
            userId: a.user_id, name: a.user_email || a.user_id, date: a.date, status: a.status, note: a.note || "",
          })),
        ]);
      }
      alert(`${data.count}人のDiscord反応を同期しました ✅\n${data.synced?.join("、") || ""}`);
    } catch (e: any) { alert(`同期失敗: ${e.message}`); }
    finally { setDiscordSyncing(false); }
  };

  const loadAttendanceLogs = async (date?: string) => {
    setAttendanceLoading(true);
    try {
      const target = date ?? new Date().toISOString().split("T")[0];
      const sb = createClient();
      const { data } = await sb
        .from("attendance_logs")
        .select("*")
        .gte("checked_in_at", `${target}T00:00:00+00:00`)
        .lte("checked_in_at", `${target}T23:59:59+00:00`)
        .order("checked_in_at", { ascending: false });
      if (data) setAttendanceLogs(data as AttendanceLog[]);
    } catch {}
    finally { setAttendanceLoading(false); }
  };

  // selectedDate が変わったとき（スケジュールタブ）に出席ログを再取得
  useEffect(() => {
    if (activeTab === "schedule") loadAttendanceLogs(selectedDate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, activeTab]);

  // ホームタブに切り替えたとき出席統計を取得
  useEffect(() => {
    if (activeTab === "home") loadMonthlyAttendance();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // 設定タブaboutに切り替えたときアクティビティログを取得
  useEffect(() => {
    if (activeTab === "settings" && settingsTab === "about") loadActivityLogs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, settingsTab]);

  // 設定タブbudgetに切り替えたとき費用を取得
  useEffect(() => {
    if (activeTab === "settings" && settingsTab === "budget") loadExpenses();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, settingsTab]);

  // WikiタブにてSharedFilesを取得
  useEffect(() => {
    if (activeTab === "wiki") loadSharedFiles();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ── ユーザー名変更 ────────────────────────────────────────────────
  const saveDisplayName = async () => {
    const name = displayNameEdit.trim();
    if (!name) return;
    setDisplayNameSaving(true);
    try {
      const sb = createClient();
      await sb.auth.updateUser({ data: { full_name: name } });
      const { data: { user } } = await sb.auth.getUser();
      if (user) await sb.from("members").update({ display_name: name }).eq("id", user.id);
      setDisplayNameEdit("");
    } catch (e: any) { alert(`保存失敗: ${e.message}`); }
    finally { setDisplayNameSaving(false); }
  };

  // ── Discord 出席確認同期 ─────────────────────────────────────────
  const syncAttendanceToDiscord = async () => {
    if (!discordBotToken) { alert("設定でBot Tokenを入力してください"); return; }
    if (!discordPollChannelId) { alert("設定でチャンネルIDを入力してください"); return; }
    setAttendanceSyncing(true);
    try {
      const res = await fetch("/api/discord/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken: discordBotToken, channelId: discordPollChannelId, date: selectedDate }),
      });
      const data = await res.json();
      if (data.error) { alert(`同期失敗: ${data.error}`); return; }
      alert(`✅ ${data.count}件の出席記録をDiscordに送信しました`);
    } catch (e: any) { alert(`エラー: ${e.message}`); }
    finally { setAttendanceSyncing(false); }
  };

  // ── Discord 共有設定（Supabase） ─────────────────────────────────────────
  const loadDiscordSettings = async () => {
    try {
      const sb = createClient();
      const { data } = await sb.from("app_settings").select("*").eq("id", "discord").single();
      if (data) {
        if (data.discord_bot_token) setDiscordBotToken(data.discord_bot_token);
        if (data.discord_guild_id) setDiscordGuildId(data.discord_guild_id);
        if (data.discord_poll_channel_id) setDiscordPollChannelId(data.discord_poll_channel_id);
      }
    } catch {}
  };

  const saveDiscordSettings = async () => {
    setDiscordSettingsSaving(true);
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      const { error } = await sb.from("app_settings").upsert({
        id: "discord",
        discord_bot_token: discordBotToken,
        discord_guild_id: discordGuildId,
        discord_poll_channel_id: discordPollChannelId,
        updated_by: user?.email ?? user?.user_metadata?.full_name ?? "",
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      alert("✅ Discord設定を全メンバーに反映しました");
    } catch (e: any) { alert(`保存失敗: ${e.message}`); }
    finally { setDiscordSettingsSaving(false); }
  };

  // ── Discord チャンネル同期 ────────────────────────────────────────────────
  const fetchDiscordChannels = async () => {
    if (!discordBotToken) { alert("設定でBot Tokenを入力してください"); return; }
    if (!discordGuildId) { alert("設定でGuild IDを入力してください"); return; }
    setDiscordChannelsLoading(true);
    try {
      const res = await fetch(`/api/discord/channels?guildId=${discordGuildId}`, {
        headers: { "x-bot-token": discordBotToken },
      });
      const data = await res.json();
      if (data.error) { alert(`チャンネル取得失敗: ${data.error}`); return; }
      setDiscordChannels(data.channels ?? []);
    } catch (e: any) { alert(`エラー: ${e.message}`); }
    finally { setDiscordChannelsLoading(false); }
  };

  const fetchDiscordMessages = async (channelId: string, after?: string) => {
    if (!discordBotToken) return;
    try {
      const url = `/api/discord/messages?channelId=${channelId}&limit=50${after?`&after=${after}`:""}`;
      const res = await fetch(url, { headers: { "x-bot-token": discordBotToken } });
      const data = await res.json();
      if (data.error) { console.error(data.error); return; }
      const msgs: DiscordMessage[] = data.messages ?? [];
      if (after) {
        // incremental: append only new messages
        if (msgs.length > 0) {
          setDiscordMessages(prev => [...prev, ...msgs]);
          lastDiscordMsgId.current = msgs[msgs.length - 1].id;
        }
      } else {
        // initial load
        setDiscordMessages(msgs);
        if (msgs.length > 0) lastDiscordMsgId.current = msgs[msgs.length - 1].id;
      }
    } catch (e) { console.error(e); }
  };

  const selectDiscordChannel = async (ch: DiscordChannel) => {
    setActiveDiscordChannel(ch);
    setDiscordMessages([]);
    lastDiscordMsgId.current = "";
    setDiscordMessagesLoading(true);
    await fetchDiscordMessages(ch.id);
    setDiscordMessagesLoading(false);
  };

  const sendDiscordMessage = async () => {
    if (!discordChatInput.trim() || !activeDiscordChannel || discordChatSending) return;
    const content = discordChatInput.trim();
    setDiscordChatInput("");
    setDiscordChatSending(true);
    try {
      const res = await fetch("/api/discord/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bot-token": discordBotToken },
        body: JSON.stringify({ channelId: activeDiscordChannel.id, content, userName: displayName }),
      });
      const data = await res.json();
      if (data.error) { alert(`送信失敗: ${data.error}`); setDiscordChatInput(content); return; }
      // fetch latest messages to show the sent one
      await fetchDiscordMessages(activeDiscordChannel.id, lastDiscordMsgId.current || undefined);
    } catch (e: any) { alert(`エラー: ${e.message}`); setDiscordChatInput(content); }
    finally { setDiscordChatSending(false); }
  };

  // ── Discord ポーリング useEffect ──────────────────────────────────────────
  useEffect(() => {
    if (activeDiscordChannel && discordBotToken && activeTab === "discord") {
      discordPollRef.current = setInterval(() => {
        fetchDiscordMessages(activeDiscordChannel.id, lastDiscordMsgId.current || undefined);
      }, 5000);
    }
    return () => {
      if (discordPollRef.current) { clearInterval(discordPollRef.current); discordPollRef.current = null; }
    };
  }, [activeDiscordChannel, discordBotToken, activeTab]);

  // Discord タブに切り替えたときにチャンネルを自動ロード
  useEffect(() => {
    if (activeTab === "discord" && discordBotToken && discordGuildId && discordChannels.length === 0) {
      fetchDiscordChannels();
    }
  }, [activeTab, discordBotToken, discordGuildId]);

  // セッション確立後にDiscord共有設定を読み込む
  useEffect(() => {
    if (session) loadDiscordSettings();
  }, [session]);

  // ⑨ アクティビティログ（fire-and-forget）
  const logActivity = (action: string, entityType: string, entityId: string, details: any) => {
    const sb = createClient();
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      sb.from("activity_logs").insert({
        user_id: user.id,
        user_name: user.user_metadata?.full_name || user.email || "",
        action, entity_type: entityType, entity_id: entityId, details,
      }).then(() => {});
    }).catch(() => {});
  };

  const loadActivityLogs = async () => {
    setActivityLogsLoading(true);
    try {
      const sb = createClient();
      const { data } = await sb.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(20);
      if (data) setActivityLogs(data as ActivityLog[]);
    } catch {}
    finally { setActivityLogsLoading(false); }
  };

  // ② 出席統計ダッシュボード
  const loadMonthlyAttendance = async () => {
    setAttendanceStatsLoading(true);
    try {
      const sb = createClient();
      const now = new Date();
      const firstDay = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().split("T")[0];
      const { data } = await sb.from("attendance_logs").select("*")
        .gte("checked_in_at", `${firstDay}T00:00:00+00:00`)
        .lte("checked_in_at", `${lastDay}T23:59:59+00:00`);
      if (data) setMonthlyAttendance(data as AttendanceLog[]);
    } catch {}
    finally { setAttendanceStatsLoading(false); }
  };

  // ⑤ 費用管理
  const loadExpenses = async () => {
    setExpensesLoading(true);
    try {
      const sb = createClient();
      const { data } = await sb.from("expenses").select("*").order("date", { ascending: false });
      if (data) setExpenses(data as Expense[]);
    } catch {}
    finally { setExpensesLoading(false); }
  };

  const addExpense = async () => {
    if (!newExpense.title.trim() || !newExpense.amount) return;
    const amount = parseInt(newExpense.amount, 10);
    if (isNaN(amount)) return;
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    try {
      const { data } = await sb.from("expenses").insert({
        title: newExpense.title.trim(), amount, category: newExpense.category,
        date: newExpense.date, note: newExpense.note.trim(),
        created_by: user.id, created_by_name: user.user_metadata?.full_name || user.email || "",
      }).select().single();
      if (data) setExpenses(p => [data as Expense, ...p]);
      setNewExpense({ title:"", amount:"", category:"活動費", date:new Date().toISOString().split("T")[0], note:"" });
    } catch(e) { console.log("expense add err", e); }
  };

  const deleteExpense = async (id: string) => {
    const sb = createClient();
    try {
      await sb.from("expenses").delete().eq("id", id);
      setExpenses(p => p.filter(e => e.id !== id));
    } catch {}
  };

  // ⑥ タスクコメント
  const loadTaskComments = async (taskId: string) => {
    const sb = createClient();
    try {
      const { data } = await sb.from("task_comments").select("*").eq("task_id", taskId).order("created_at", { ascending: true });
      if (data) setTaskComments(data as TaskComment[]);
    } catch {}
  };

  const addTaskComment = async (taskId: string) => {
    if (!taskCommentInput.trim()) return;
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    try {
      const { data } = await sb.from("task_comments").insert({
        task_id: taskId, user_id: user.id,
        user_name: user.user_metadata?.full_name || user.email || "",
        content: taskCommentInput.trim(),
      }).select().single();
      if (data) { setTaskComments(p => [...p, data as TaskComment]); setTaskCommentInput(""); }
    } catch {}
  };

  const deleteTaskComment = async (id: string) => {
    const sb = createClient();
    try {
      await sb.from("task_comments").delete().eq("id", id);
      setTaskComments(p => p.filter(c => c.id !== id));
    } catch {}
  };

  // ⑥ チェックリスト更新
  const updateChecklist = async (taskId: string, checklist: {id:string;text:string;done:boolean}[]) => {
    setTasks(p => p.map(t => t.id === taskId ? { ...t, checklist } : t));
    const sb = createClient();
    try { await sb.from("tasks").update({ checklist }).eq("id", taskId); } catch {}
  };

  // ⑧ ファイル共有
  const loadSharedFiles = async () => {
    setSharedFilesLoading(true);
    try {
      const sb = createClient();
      const { data } = await sb.from("shared_files").select("*").order("created_at", { ascending: false });
      if (data) setSharedFiles(data as SharedFile[]);
    } catch {}
    finally { setSharedFilesLoading(false); }
  };

  const uploadSharedFile = async (file: File) => {
    if (file.size > 50 * 1024 * 1024) { alert("50MB以下のファイルを選択してください"); return; }
    setFileUploading(true);
    try {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const ext = file.name.split(".").pop() || "";
      const path = `${user.id}/${Date.now()}_${file.name}`;
      const { error: upErr } = await sb.storage.from("shared-files").upload(path, file, { upsert: true });
      if (upErr) { alert(`アップロード失敗: ${upErr.message}`); return; }
      const publicUrl = sb.storage.from("shared-files").getPublicUrl(path).data.publicUrl;
      const mime = file.type || "application/octet-stream";
      const category = mime.startsWith("image/") ? "画像" : mime.startsWith("video/") ? "動画" : ext && ["pdf","doc","docx","txt","xls","xlsx","ppt","pptx"].includes(ext.toLowerCase()) ? "ドキュメント" : "その他";
      const { data } = await sb.from("shared_files").insert({
        name: file.name, storage_path: path, url: publicUrl,
        size: file.size, mime_type: mime, category,
        uploaded_by: user.id, uploaded_by_name: user.user_metadata?.full_name || user.email || "",
      }).select().single();
      if (data) setSharedFiles(p => [data as SharedFile, ...p]);
    } catch(e: any) { alert(`エラー: ${e.message}`); }
    finally { setFileUploading(false); }
  };

  const deleteSharedFile = async (file: SharedFile) => {
    const sb = createClient();
    try {
      await sb.storage.from("shared-files").remove([file.storage_path]);
      await sb.from("shared_files").delete().eq("id", file.id);
      setSharedFiles(p => p.filter(f => f.id !== file.id));
    } catch {}
  };

  // ⑦ iCal エクスポート
  const exportIcal = () => {
    const filteredTasks = tasks.filter(t => t.date >= new Date().toISOString().split("T")[0]);
    const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
    const toIcalDate = (d: string) => d.replace(/-/g, "");
    const lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//AeroSync//AeroSync//JA",
      "X-WR-CALNAME:AeroSync", "CALSCALE:GREGORIAN",
    ];
    filteredTasks.forEach(t => {
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:aerosync-${t.id}@aerosync`);
      lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,"").split(".")[0]}Z`);
      lines.push(`DTSTART;VALUE=DATE:${toIcalDate(t.date)}`);
      lines.push(`DTEND;VALUE=DATE:${toIcalDate(t.date)}`);
      lines.push(`SUMMARY:${escape(t.title)}`);
      if (t.description) lines.push(`DESCRIPTION:${escape(t.description)}`);
      if (t.location) lines.push(`LOCATION:${escape(t.location)}`);
      lines.push("END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "aerosync-schedule.ics"; a.click();
  };

  // ⑩ メンバー出席履歴
  const loadMemberAttendance = async (memberId: string) => {
    setMemberAttendanceLoading(true);
    try {
      const sb = createClient();
      const { data } = await sb.from("attendance_logs").select("*").eq("user_id", memberId).order("checked_in_at", { ascending: false }).limit(30);
      if (data) setMemberAttendanceLogs(data as AttendanceLog[]);
    } catch {}
    finally { setMemberAttendanceLoading(false); }
  };

  // ── Excelインポート ──────────────────────────────────────────────
  const handleXlsxImport = async (file: File) => {
    setXlsxImporting(true);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });

      let importedInv = 0, importedTasks = 0;
      const sb = createClient();

      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (rows.length === 0) continue;
        const cols = Object.keys(rows[0]).map(k => k.toLowerCase());

        // ─ 在庫シートの判定（機材名/name列がある）
        const isInv = cols.some(c => ["機材名","name","品名","機材"].includes(c));
        // ─ スケジュールシートの判定（タイトル/title列がある）
        const isSched = cols.some(c => ["タイトル","title","件名","予定","イベント"].includes(c));

        if (isInv) {
          for (const row of rows) {
            const name = String(row["機材名"] || row["name"] || row["品名"] || row["機材"] || "").trim();
            if (!name) continue;
            const total = parseInt(String(row["総数"] || row["total"] || row["数量"] || "1"), 10) || 1;
            const stock = parseInt(String(row["在庫"] || row["stock"] || row["現在庫"] || String(total)), 10) || total;
            const cat = String(row["カテゴリ"] || row["category"] || row["分類"] || invCats[0] || INV_CATS[0]).trim();
            const emoji = String(row["絵文字"] || row["emoji"] || "📦");

            // カスタムカテゴリが存在しない場合は追加
            if (!invCats.includes(cat) && !INV_CATS.includes(cat)) {
              const next = [...invCats, cat];
              setInvCats(next);
              saveLS("as_inv_cats", next);
            }

            const localId = `xl_${Date.now()}_${Math.random()}`;
            setInventory(p => [...p, { id: localId, name, stock, total, image: emoji, isEmoji: true, category: cat }]);
            try {
              const { data } = await sb.from("inventory").insert({ name, stock, total, image: emoji, is_emoji: true, category: cat }).select().single();
              if (data) setInventory(p => p.map(i => i.id === localId ? { ...i, id: data.id } : i));
            } catch {}
            importedInv++;
          }
        }

        if (isSched) {
          for (const row of rows) {
            const title = String(row["タイトル"] || row["title"] || row["件名"] || row["予定"] || row["イベント"] || "").trim();
            if (!title) continue;
            const rawDate = row["日付"] || row["date"] || row["開始日"] || "";
            let dateStr = selectedDate;
            if (rawDate instanceof Date) {
              dateStr = rawDate.toISOString().split("T")[0];
            } else if (typeof rawDate === "string" && rawDate.match(/^\d{4}-\d{2}-\d{2}/)) {
              dateStr = rawDate.slice(0, 10);
            } else if (typeof rawDate === "number") {
              const d = new Date(Math.round((rawDate - 25569) * 86400000));
              dateStr = d.toISOString().split("T")[0];
            }
            const desc = String(row["説明"] || row["description"] || row["内容"] || "").trim();
            const color = String(row["カラー"] || row["color"] || TASK_COLORS[0]).trim();
            const priority = (["low","medium","high"].includes(String(row["優先度"] || row["priority"]).toLowerCase())
              ? String(row["優先度"] || row["priority"]).toLowerCase()
              : "medium") as Task["priority"];
            const location = String(row["場所"] || row["location"] || "").trim();

            const localId = `xl_${Date.now()}_${Math.random()}`;
            const task: Task = { id: localId, title, date: dateStr, description: desc, assignees: [], openJoin: true, color: TASK_COLORS.includes(color) ? color : TASK_COLORS[0], done: false, priority, location };
            setTasks(p => [...p, task]);
            try {
              const { data } = await sb.from("tasks").insert({ title, date: dateStr, description: desc, assignees: [], open_join: true, color: task.color, done: false, priority, location }).select().single();
              if (data) setTasks(p => p.map(t => t.id === localId ? { ...t, id: data.id } : t));
            } catch {}
            importedTasks++;
          }
        }
      }
      alert(`インポート完了！\n在庫: ${importedInv}件\nスケジュール: ${importedTasks}件`);
    } catch (e: any) { alert(`インポート失敗: ${e.message}`); }
    finally { setXlsxImporting(false); }
  };

  const loadQRCode = async () => {
    setQrLoading(true);
    setQrDataUrl(null);
    try {
      const res = await fetch("/api/checkin/qr");
      const data = await res.json();
      if (data.error) { alert(`QR生成エラー: ${data.error}`); return; }
      setQrDataUrl(data.dataUrl);
      setQrWeekLabel(data.weekLabel);
      setQrValidUntil(data.validUntil);
    } catch (e: any) { alert(`QR取得失敗: ${e.message}`); }
    finally { setQrLoading(false); }
  };

  const printQR = () => {
    if (!qrDataUrl) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>AeroSync QR</title><style>body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;background:#fff}h2{font-size:1.4rem;margin-bottom:4px;color:#1e293b}p{font-size:.85rem;color:#64748b;margin:4px 0}img{width:280px;height:280px;margin:16px 0;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.12)}@media print{button{display:none}}</style></head><body><h2>AeroSync 作業場 出欠QR</h2><p>${qrWeekLabel}</p><p>${qrValidUntil} まで有効</p><img src="${qrDataUrl}" alt="QR"/><p style="font-size:.75rem;color:#94a3b8">毎週月曜日に更新されます</p><button onclick="window.print()" style="margin-top:16px;padding:10px 28px;border:none;border-radius:8px;background:#3b82f6;color:#fff;font-size:.9rem;cursor:pointer">印刷</button></body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  const stopQRScanner = () => {
    setShowQRScanner(false);
    setQrScanResult(null);
    setQrScanData(null);
  };

  // QR camera scanner effect
  useEffect(() => {
    if (!showQRScanner) return;
    let stream: MediaStream | null = null;
    let animId: number | null = null;
    let done = false;

    const handleResult = async (raw: string) => {
      done = true;
      if (animId) cancelAnimationFrame(animId);
      const token = raw.startsWith("AEROSYNC:") ? raw.slice(9) : raw;
      try {
        const res = await fetch("/api/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (data.error) { setQrScanResult("error"); return; }
        if (data.action === "checkout") {
          setQrScanData({ durationMinutes: data.durationMinutes });
          setQrScanResult("checkout");
        } else {
          setQrScanData(null);
          setQrScanResult("checkin");
          logActivity("入室", "attendance", data.logId || Date.now().toString(), { name: displayName });
        }
        // Refresh attendance logs for today
        const today = new Date().toISOString().split("T")[0];
        await loadAttendanceLogs(today);
        setTimeout(() => stopQRScanner(), 2000);
      } catch { setQrScanResult("error"); }
    };

    const scan = async () => {
      if (done) return;
      const video = qrVideoRef.current;
      const canvas = qrCanvasRef.current;
      if (!video || !canvas || video.videoWidth === 0) { animId = requestAnimationFrame(scan); return; }
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(video, 0, 0);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      try {
        if ("BarcodeDetector" in window) {
          const det = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
          const codes = await det.detect(video);
          if (codes.length > 0) { handleResult(codes[0].rawValue); return; }
        } else {
          const { default: jsQR } = await import("jsqr");
          const code = jsQR(img.data, img.width, img.height);
          if (code) { handleResult(code.data); return; }
        }
      } catch {}
      animId = requestAnimationFrame(scan);
    };

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then(s => {
        stream = s;
        if (qrVideoRef.current) qrVideoRef.current.srcObject = s;
        animId = requestAnimationFrame(scan);
      })
      .catch(() => { alert("カメラへのアクセスを許可してください"); setShowQRScanner(false); });

    return () => {
      done = true;
      if (animId) cancelAnimationFrame(animId);
      stream?.getTracks().forEach(t => t.stop());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showQRScanner]);

  const sendMentionToDiscord = async(member:Member, message:string)=>{
    if(!perms.manageMembers&&!perms.manageRoles){alert("メンション権限がありません");return;}
    const supabase=createClient();
    const {data:{user}}=await supabase.auth.getUser();
    try {
      await fetch("/api/notify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"mention",targetUserId:member.id,targetDiscordId:member.discord_id,message:{title:`🔔 @メンション`,body:message,data:{}}})});
      await supabase.from("notifications").insert({user_id:member.id,type:"mention",title:`@${user?.user_metadata?.full_name||user?.email}からメンション`,body:message});
    } catch(e){console.log("Mention error:",e);}
  };

  useEffect(()=>{
    if(chatOpen&&pendingSendRef.current&&chatInput.trim()){ pendingSendRef.current=false; sendChat(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[chatOpen]);

  const toggleNotif = async()=>{ if(notifEnabled){setNotifEnabled(false);return;} const g=await reqNotif(); setNotifEnabled(g); if(g) new Notification("AeroSync",{body:"通知が有効になりました！",icon:"/icons/icon-192.png"}); };

  const searchResults = searchQuery.trim().length<1?[]:[
    ...tasks.filter(t=>t.title.includes(searchQuery)||t.description.includes(searchQuery)).map(t=>({type:"task",label:t.title,sub:t.date,tab:"schedule" as Tab,color:t.color,wiki:null as WikiPage|null})),
    ...inventory.filter(i=>i.name.includes(searchQuery)).map(i=>({type:"inventory",label:i.name,sub:`残:${i.stock}/${i.total}`,tab:"inventory" as Tab,color:"#3b82f6",wiki:null})),
    ...wikis.filter(w=>w.title.includes(searchQuery)||w.content.includes(searchQuery)).map(w=>({type:"wiki",label:w.title,sub:w.category,tab:"wiki" as Tab,color:"#8b5cf6",wiki:w})),
  ];

  if(!isMounted||session===undefined) return (
    <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-300 animate-pulse"><span className="text-white font-black text-xl">AS</span></div>
        <div className="flex gap-1.5">{[0,1,2].map(i=><div key={i} className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:`${i*0.15}s`}}/>)}</div>
      </div>
    </div>
  );

  if(!session) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_,i)=><div key={i} className="absolute rounded-full opacity-10 animate-pulse" style={{width:`${100+i*80}px`,height:`${100+i*80}px`,background:"radial-gradient(circle, #60a5fa, transparent)",left:`${10+i*15}%`,top:`${10+i*12}%`,animationDelay:`${i*0.5}s`}}/>)}
      </div>
      <div className="relative w-full max-w-sm" style={{animation:"slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1)"}}>
        <div className="bg-white/10 backdrop-blur-2xl rounded-3xl border border-white/20 overflow-hidden shadow-2xl">
          <div className="px-8 pt-10 pb-6 text-center">
            <div className="w-16 h-16 bg-blue-500/30 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4 ring-2 ring-white/30"><span className="text-white text-xl font-black">AS</span></div>
            <h1 className="text-2xl font-black text-white tracking-tight mb-1">AeroSync</h1>
            <p className="text-blue-200/80 text-sm">課外活動をスマートに同期</p>
          </div>
          <div className="px-8 pb-8">
            {errorMessage&&<div className="mb-4 bg-red-500/20 text-red-200 p-3 rounded-xl text-xs border border-red-400/30 flex items-start gap-2"><ShieldAlert size={14} className="shrink-0 mt-0.5"/><span className="break-all">{errorMessage}</span></div>}
            {authMode==="check_email"?(
              <div className="text-center py-4">
                <Mail size={32} className="text-blue-300 mx-auto mb-3"/>
                <p className="text-white font-bold mb-2">メールを確認してください</p>
                <p className="text-blue-200/70 text-sm mb-4">{email} に確認メールを送信しました</p>
                <button onClick={()=>{setAuthMode("login");setEmail("");setPassword("");}} className="text-sm text-blue-300 hover:text-white transition-colors">ログインに戻る</button>
              </div>
            ):(
              <>
                <div className="flex bg-white/10 rounded-xl p-1 mb-5">
                  {(["login","signup"] as const).map(m=><button key={m} onClick={()=>{setAuthMode(m);setAuthError(null);}} className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-all ${authMode===m?"bg-white text-gray-900 shadow":"text-white/60"}`}>{m==="login"?"ログイン":"新規登録"}</button>)}
                </div>
                {authError&&<div className="mb-4 bg-red-500/20 text-red-200 p-3 rounded-xl text-xs border border-red-400/20">{authError}</div>}
                <div className="space-y-3 mb-4">
                  <div className="relative"><Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40"/><input type="email" placeholder="メールアドレス" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleEmailAuth()} className="w-full pl-9 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"/></div>
                  <div className="relative"><Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40"/><input type={showPw?"text":"password"} placeholder="パスワード" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleEmailAuth()} className="w-full pl-9 pr-10 py-2.5 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"/><button onClick={()=>setShowPw(p=>!p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40">{showPw?<EyeOff size={15}/>:<Eye size={15}/>}</button></div>
                </div>
                <button onClick={handleEmailAuth} disabled={authLoading} className="w-full bg-blue-500 hover:bg-blue-400 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-blue-500/30 mb-4">
                  {authLoading?<Loader2 size={16} className="animate-spin"/>:<User size={16}/>}
                  {authMode==="login"?"ログイン":"アカウント作成"}
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

  const renderContent = () => {
    if(activeTab==="home") {
      const hour = new Date().getHours();
      const greeting = hour < 5 ? "おやすみなさい" : hour < 12 ? "おはようございます" : hour < 17 ? "こんにちは" : hour < 21 ? "こんばんは" : "おやすみなさい";
      const todayStr = new Date().toISOString().split("T")[0];
      const todayTaskList = tasks.filter(t => t.date === todayStr);
      const upcomingTasks = tasks.filter(t => t.date > todayStr && !t.done).slice(0, 3);
      const myTasks = tasks.filter(t => t.assignees.includes(currentUserEmail) && !t.done);
      const lowStockItems = inventory.filter(i => i.stock < i.total * 0.3);
      const recentWikis = [...wikis].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3);
      const myAvailToday = availability.find(a => a.userId === currentUserEmail && a.date === todayStr);
      const completionRate = tasks.length > 0 ? Math.round((tasks.filter(t=>t.done).length / tasks.length) * 100) : 0;

      return (
        <div className={`${fadeIn}`} style={{fontSize: appearance.fontSize === "sm" ? "13px" : appearance.fontSize === "lg" ? "17px" : "15px"}}>
          <div className="relative overflow-hidden px-5 pt-8 pb-6" style={{background:`linear-gradient(160deg, ${appearance.accentColor}18 0%, ${appearance.accentColor}05 60%, transparent 100%)`}}>
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none" style={{background:appearance.accentColor, transform:"translate(30%,-30%)"}}/>
            <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full opacity-5 pointer-events-none" style={{background:appearance.accentColor, transform:"translate(-30%,30%)"}}/>

            <div className="relative flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold mb-1" style={{color:appearance.accentColor, opacity:0.7}}>{greeting}</p>
                <div className="flex items-center gap-2 mb-1">
                  <VisualEffectWrapper effect={myVisualEffect}>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight truncate">
                      {displayName.split("@")[0]}
                    </h1>
                  </VisualEffectWrapper>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-lg">{myRoleData?.icon}</span>
                  <VisualEffectWrapper effect={myRoleData?.visualEffect||"none"}>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{background:myRoleData?.color+"22",color:myRoleData?.color,border:`1px solid ${myRoleData?.color}33`}}>{myRoleData?.name}</span>
                  </VisualEffectWrapper>
                  {myAvailToday && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{background:AVAIL_COLORS[myAvailToday.status]+"22",color:AVAIL_COLORS[myAvailToday.status]}}>
                      {AVAIL_LABELS[myAvailToday.status]}
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0">
                {userProfile?.avatar_url
                  ? <img src={userProfile.avatar_url} alt="avatar" className="w-16 h-16 rounded-2xl shadow-lg" style={{outline:`3px solid ${appearance.accentColor}44`,outlineOffset:"2px"}}/>
                  : <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-lg" style={{background:`linear-gradient(135deg, ${appearance.accentColor}, ${appearance.accentColor}bb)`}}>
                      {(displayName).charAt(0).toUpperCase()}
                    </div>
                }
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <div className="relative w-14 h-14 shrink-0">
                <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="22" fill="none" stroke="#e5e7eb" strokeWidth="5"/>
                  <circle cx="28" cy="28" r="22" fill="none" stroke={appearance.accentColor} strokeWidth="5"
                    strokeDasharray={`${2*Math.PI*22}`} strokeDashoffset={`${2*Math.PI*22*(1-completionRate/100)}`}
                    strokeLinecap="round" style={{transition:"stroke-dashoffset 1s ease"}}/>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-black text-gray-800">{completionRate}%</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-black text-gray-900">タスク達成率</p>
                <p className="text-xs text-gray-500">{tasks.filter(t=>t.done).length} / {tasks.length} 完了</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs text-gray-400">{new Date().toLocaleDateString("ja-JP",{month:"long",day:"numeric",weekday:"short"})}</p>
                <p className="text-xs font-bold" style={{color:appearance.accentColor}}>{todayTaskList.length}件の予定</p>
              </div>
            </div>
          </div>

          <div className="px-4 space-y-5 pb-6">
            <div className="grid grid-cols-4 gap-2">
              {[
                {n:tasks.filter(t=>!t.done).length, label:"残タスク", color:"#3b82f6", icon:"📋"},
                {n:myTasks.length, label:"自分の担当", color:appearance.accentColor, icon:"🎯"},
                {n:lowStockItems.length, label:"在庫不足", color:"#ef4444", icon:"⚠️"},
                {n:wikis.length, label:"Wiki", color:"#8b5cf6", icon:"📖"},
              ].map(s=>(
                <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-2.5 text-center" style={{borderTopWidth:2,borderTopColor:s.color}}>
                  <div className="text-lg mb-0.5">{s.icon}</div>
                  <p className="text-lg font-black text-gray-900">{s.n}</p>
                  <p className="text-[9px] text-gray-400 font-bold leading-tight">{s.label}</p>
                </div>
              ))}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="text-base font-black text-gray-900 flex items-center gap-1.5"><span>📅</span> 今日の予定</h2>
                <button onClick={()=>setActiveTab("schedule")} className="text-xs font-bold transition-colors" style={{color:appearance.accentColor}}>すべて見る →</button>
              </div>
              {todayTaskList.length === 0
                ? <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
                    <p className="text-2xl mb-1">🎉</p>
                    <p className="text-sm font-bold text-gray-700">今日の予定はありません</p>
                    <p className="text-xs text-gray-400 mt-0.5">ゆっくり休んでください</p>
                  </div>
                : <div className="space-y-2">
                    {todayTaskList.slice(0, 4).map((t, i) => (
                      <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3 px-3.5 py-3 transition-all active:scale-[0.99]" style={{borderLeftWidth:3,borderLeftColor:t.color, animationDelay:`${i*0.05}s`}}>
                        <button onClick={async ()=>{
                          const nd=!t.done;
                          setTasks(p=>p.map(x=>x.id===t.id?{...x,done:nd}:x));
                          try{const sb=createClient();await sb.from('tasks').update({done:nd}).eq('id',t.id);}catch(er){console.log('done err',er);}
                        }}
                          className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all" style={t.done?{background:t.color,borderColor:t.color}:{borderColor:t.color+"88"}}>
                          {t.done&&<Check size={10} className="text-white"/>}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold truncate ${t.done?"line-through text-gray-400":"text-gray-900"}`}>{t.title}</p>
                          {t.location&&<p className="text-[10px] text-gray-400 flex items-center gap-0.5 mt-0.5"><MapPin size={9}/>{t.location}</p>}
                        </div>
                        <Pill color={t.color}>{t.priority==="high"?"🔥":t.priority==="medium"?"⚡":"🌿"}</Pill>
                      </div>
                    ))}
                    {todayTaskList.length > 4 && <p className="text-xs text-center text-gray-400 pt-1">他 {todayTaskList.length-4} 件</p>}
                  </div>
              }
            </div>

            {myTasks.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h2 className="text-base font-black text-gray-900 flex items-center gap-1.5"><span>🎯</span> 自分の担当</h2>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{background:appearance.accentColor}}>{myTasks.length}件</span>
                </div>
                <div className="space-y-1.5">
                  {myTasks.slice(0, 3).map(t=>(
                    <div key={t.id} onClick={()=>{setSelectedDate(t.date);setActiveTab("schedule");}} className="bg-white rounded-xl border border-gray-100 shadow-sm flex items-center gap-3 px-3 py-2.5 cursor-pointer active:scale-[0.99] transition-all">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{background:t.color}}/>
                      <p className="text-xs font-bold text-gray-800 truncate flex-1">{t.title}</p>
                      <span className="text-[10px] text-gray-400 shrink-0">{t.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {upcomingTasks.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h2 className="text-base font-black text-gray-900 flex items-center gap-1.5"><span>🔮</span> 近日の予定</h2>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
                  {upcomingTasks.map(t=>(
                    <div key={t.id} onClick={()=>{setSelectedDate(t.date);setActiveTab("schedule");}} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors active:scale-[0.99]">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{background:t.color+"22"}}>
                        <Calendar size={14} style={{color:t.color}}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate">{t.title}</p>
                        <p className="text-[10px] text-gray-400">{t.date}</p>
                      </div>
                      <ChevronRight size={14} className="text-gray-300 shrink-0"/>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {lowStockItems.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h2 className="text-base font-black text-gray-900 flex items-center gap-1.5"><span>⚠️</span> 在庫不足</h2>
                  <button onClick={()=>setActiveTab("inventory")} className="text-xs font-bold" style={{color:appearance.accentColor}}>管理する →</button>
                </div>
                <div className="bg-red-50 rounded-2xl border border-red-100 overflow-hidden divide-y divide-red-100">
                  {lowStockItems.slice(0,3).map(item=>(
                    <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="text-xl shrink-0">{item.isEmoji?item.image:"📦"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 truncate">{item.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex-1 bg-red-200 rounded-full h-1 overflow-hidden">
                            <div className="h-full rounded-full bg-red-500" style={{width:`${(item.stock/item.total)*100}%`}}/>
                          </div>
                          <span className="text-[10px] font-bold text-red-500 shrink-0">{item.stock}/{item.total}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recentWikis.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h2 className="text-base font-black text-gray-900 flex items-center gap-1.5"><span>📖</span> 最近のWiki</h2>
                  <button onClick={()=>setActiveTab("wiki")} className="text-xs font-bold" style={{color:appearance.accentColor}}>すべて見る →</button>
                </div>
                <div className="space-y-1.5">
                  {recentWikis.map(w=>(
                    <button key={w.id} onClick={async()=>{setWikis(p=>p.map(x=>x.id===w.id?{...x,views:x.views+1}:x));setActiveWiki({...w,views:w.views+1});setActiveTab("wiki");try{const sb=createClient();await sb.from('wiki_pages').update({views:w.views+1}).eq('id',w.id);}catch(e){console.log(e);}}}
                      className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 text-left flex items-center gap-3 hover:border-blue-200 transition-all active:scale-[0.99]">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{background:appearance.accentColor+"15"}}>
                        <Hash size={15} style={{color:appearance.accentColor}}/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{w.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Pill color={appearance.accentColor}>{w.category}</Pill>
                          <span className="text-[10px] text-gray-400">👁 {w.views}</span>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-gray-300 shrink-0"/>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="text-base font-black text-gray-900 flex items-center gap-1.5 mb-2.5"><span>⚡</span> クイックアクション</h2>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  {label:"タスクを追加", icon:"➕", tab:"schedule" as Tab, action:()=>{setActiveTab("schedule");setShowTaskForm(true);}},
                  {label:"Wikiを開く", icon:"📖", tab:"wiki" as Tab, action:()=>setActiveTab("wiki")},
                  {label:"在庫確認", icon:"📦", tab:"inventory" as Tab, action:()=>setActiveTab("inventory")},
                  {label:"AIに聞く", icon:"✨", tab:"settings" as Tab, action:()=>setChatOpen(true)},
                ].map(a=>(
                  <button key={a.label} onClick={a.action}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 text-left hover:shadow-md transition-all active:scale-[0.97]">
                    <span className="text-xl">{a.icon}</span>
                    <p className="text-xs font-bold text-gray-800">{a.label}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="text-base font-black text-gray-900 flex items-center gap-1.5"><span>📌</span> ピン留めリンク</h2>
                <button onClick={()=>setShowPinForm(true)} className="w-7 h-7 rounded-xl flex items-center justify-center" style={{background:appearance.accentColor+"22",color:appearance.accentColor}}><Plus size={14}/></button>
              </div>
              {pinnedLinks.length === 0
                ? <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center text-xs text-gray-400">
                    <p className="text-lg mb-1">📌</p>よく使うリンクをピン留め
                  </div>
                : <div className="space-y-2">
                    {pinnedLinks.map(pin=>(
                      <div key={pin.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3 px-3.5 py-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base" style={{background:appearance.accentColor+"15"}}>🔗</div>
                        <div className="flex-1 min-w-0">
                          <button onClick={()=>window.open(pin.url,"_blank")} className="text-sm font-bold text-gray-900 truncate hover:underline text-left w-full">{pin.title}</button>
                          {pin.description&&<p className="text-[10px] text-gray-400 truncate">{pin.description}</p>}
                        </div>
                        <button onClick={()=>setPinnedLinks(p=>p.filter(x=>x.id!==pin.id))} className="text-gray-300 hover:text-red-400 transition-colors p-1 shrink-0"><X size={13}/></button>
                      </div>
                    ))}
                  </div>
              }
              {showPinForm&&(
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={()=>setShowPinForm(false)}>
                  <div className={`bg-white w-full rounded-t-3xl p-6 space-y-4 ${slideUp}`} onClick={e=>e.stopPropagation()}>
                    <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto"/>
                    <h3 className="font-black text-gray-900">リンクをピン留め</h3>
                    <input placeholder="タイトル *" value={newPin.title} onChange={e=>setNewPin(p=>({...p,title:e.target.value}))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/>
                    <input placeholder="URL * (https://...)" value={newPin.url} onChange={e=>setNewPin(p=>({...p,url:e.target.value}))} type="url" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/>
                    <input placeholder="説明（任意）" value={newPin.description} onChange={e=>setNewPin(p=>({...p,description:e.target.value}))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/>
                    <button onClick={()=>{if(!newPin.title.trim()||!newPin.url.trim())return;let url=newPin.url.trim();if(!url.startsWith("http"))url="https://"+url;setPinnedLinks(p=>[...p,{id:Date.now().toString(),title:newPin.title.trim(),url,description:newPin.description.trim()}]);setNewPin({title:"",url:"",description:""});setShowPinForm(false);}} className="w-full text-white font-bold py-3 rounded-2xl text-sm" style={{background:appearance.accentColor}}>ピン留め</button>
                  </div>
                </div>
              )}
            </div>

            {/* ② 出席統計ダッシュボード */}
            {(()=>{
              if (attendanceStatsLoading) return <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center"><Loader2 size={16} className="animate-spin mx-auto text-gray-300"/></div>;
              if (monthlyAttendance.length === 0) return null;
              const totalCheckins = monthlyAttendance.length;
              const completedLogs = monthlyAttendance.filter(l => l.duration_minutes != null);
              const avgDuration = completedLogs.length > 0 ? Math.round(completedLogs.reduce((s,l) => s + (l.duration_minutes||0), 0) / completedLogs.length) : 0;
              // 上位3名
              const memberCounts: Record<string, {name:string;count:number}> = {};
              monthlyAttendance.forEach(l => {
                const key = l.user_id;
                const name = l.user_name || l.user_email || l.user_id;
                if (!memberCounts[key]) memberCounts[key] = { name, count: 0 };
                memberCounts[key].count++;
              });
              const top3 = Object.values(memberCounts).sort((a,b) => b.count - a.count).slice(0,3);
              const maxCount = top3[0]?.count || 1;
              return (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <h2 className="text-base font-black text-gray-900 flex items-center gap-1.5 mb-3"><span>📊</span> 今月の出席統計</h2>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-blue-50 rounded-xl p-2.5 text-center">
                      <p className="text-lg font-black text-blue-700">{totalCheckins}</p>
                      <p className="text-[10px] text-blue-500 font-bold">今月の出席</p>
                    </div>
                    <div className="bg-green-50 rounded-xl p-2.5 text-center">
                      <p className="text-lg font-black text-green-700">{avgDuration}</p>
                      <p className="text-[10px] text-green-500 font-bold">平均滞在(分)</p>
                    </div>
                    <div className="bg-purple-50 rounded-xl p-2.5 text-center">
                      <p className="text-xs font-black text-purple-700 truncate">{top3[0]?.name.split("@")[0] || "-"}</p>
                      <p className="text-[10px] text-purple-500 font-bold">最多出席</p>
                    </div>
                  </div>
                  {top3.length > 0 && (
                    <div className="space-y-2">
                      {top3.map((m, i) => (
                        <div key={m.name} className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-gray-400 w-4">{i+1}</span>
                          <span className="text-xs font-bold text-gray-700 w-24 truncate">{m.name.split("@")[0]}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{width:`${(m.count/maxCount)*100}%`, background:["#3b82f6","#10b981","#8b5cf6"][i]}}/>
                          </div>
                          <span className="text-[10px] font-bold text-gray-500 w-6 text-right">{m.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      );
    }

    if(activeTab==="schedule") return (
      <div className={`p-4 space-y-4 ${fadeIn}`}>
        <div className="grid grid-cols-3 gap-2">
          {[{label:"今日",value:todayTasks.length,icon:<Zap size={14}/>,bg:"bg-blue-500"},{label:"完了",value:completedTasks,icon:<CheckSquare size={14}/>,bg:"bg-green-500"},{label:"在庫不足",value:lowStock.length,icon:<TrendingUp size={14}/>,bg:lowStock.length>0?"bg-red-500":"bg-gray-400"}].map(s=>(
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-3 flex flex-col gap-1 shadow-sm">
              <div className={`w-6 h-6 ${s.bg} rounded-lg flex items-center justify-center text-white`}>{s.icon}</div>
              <p className="text-xl font-black text-gray-900">{s.value}</p>
              <p className="text-[10px] text-gray-400 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-1.5 bg-white rounded-xl border border-gray-100 p-1 shadow-sm">
          <button onClick={()=>setScheduleView("calendar")} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${scheduleView==="calendar"?"text-white shadow-sm":"text-gray-500"}`} style={scheduleView==="calendar"?{background:appearance.accentColor}:{}}><Calendar size={12}/> カレンダー</button>
          <button onClick={()=>setScheduleView("gantt")} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${scheduleView==="gantt"?"text-white shadow-sm":"text-gray-500"}`} style={scheduleView==="gantt"?{background:appearance.accentColor}:{}}><TrendingUp size={12}/> ガントチャート</button>
        </div>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-gray-900">スケジュール</h2>
          <div className="flex items-center gap-2">
            {perms.manageTasks&&<button onClick={()=>spreadsheetRef.current?.click()} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-gray-600 shadow-sm transition-all active:scale-95"><Upload size={14}/> CSV</button>}
            {perms.manageTasks&&(
              <button onClick={()=>xlsxScheduleRef.current?.click()} disabled={scheduleImporting} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm transition-all active:scale-95 disabled:opacity-50">
                {scheduleImporting?<Loader2 size={12} className="animate-spin"/>:<Upload size={12}/>} Excel
              </button>
            )}
            <button onClick={exportIcal} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-gray-600 shadow-sm transition-all active:scale-95"><Download size={12}/> iCal</button>
            {perms.manageTasks&&<button onClick={()=>setShowTaskForm(true)} className="flex items-center gap-1.5 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm transition-all active:scale-95" style={{background:appearance.accentColor}}><Plus size={14}/> 追加</button>}
          </div>
        </div>
        <input ref={spreadsheetRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)importSpreadsheet(f);e.target.value="";}}/>
        <input ref={xlsxScheduleRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)importExcelSchedule(f);e.target.value="";}}/>
        {scheduleView==="calendar" ? <CalendarView tasks={tasks} availability={availability} onDayClick={setSelectedDate} selectedDate={selectedDate}/> : <GanttView tasks={tasks} onTaskClick={(id)=>{setTaskDetailId(id);setTaskEditDesc(tasks.find(t=>t.id===id)?.notes||"");setTaskEditPhoto(tasks.find(t=>t.id===id)?.photo||null);}} accentColor={appearance.accentColor}/>}
        {(()=>{
          const weekStart = new Date(selectedDate);
          weekStart.setDate(weekStart.getDate()-weekStart.getDay());
          const weekDays = Array.from({length:7},(_,i)=>{const d=new Date(weekStart);d.setDate(d.getDate()+i);return d.toISOString().split("T")[0];});
          const weekTasks = tasks.filter(t=>weekDays.includes(t.date));
          const weekDone = weekTasks.filter(t=>t.done).length;
          const weekRate = weekTasks.length>0?Math.round(weekDone/weekTasks.length*100):0;
          if(weekTasks.length===0) return null;
          return (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-black text-gray-700">今週の達成状況</p>
                <span className="text-xs font-bold" style={{color:weekRate>=70?"#22c55e":weekRate>=40?"#f59e0b":"#ef4444"}}>{weekRate}%</span>
              </div>
              <div className="flex gap-1 mb-2">
                {weekDays.map((day,i)=>{
                  const dayT=tasks.filter(t=>t.date===day);
                  const dayDone=dayT.filter(t=>t.done).length;
                  const isToday=day===new Date().toISOString().split("T")[0];
                  const isSel=day===selectedDate;
                  return <button key={day} onClick={()=>setSelectedDate(day)} className="flex-1 flex flex-col items-center gap-0.5">
                    <span className={`text-[9px] font-bold ${isToday?"text-blue-500":isSel?"text-gray-900":"text-gray-400"}`}>{"日月火水木金土"[i]}</span>
                    <div className="w-full h-5 rounded-lg flex items-center justify-center transition-all"
                      style={{background:dayT.length===0?"#f3f4f6":dayDone===dayT.length?"#22c55e":dayDone>0?"#fbbf24":"#3b82f644",outline:isSel?`2px solid ${appearance.accentColor}`:"none"}}>
                      <span className="text-[9px] font-black text-white">{dayT.length>0?dayT.length:""}</span>
                    </div>
                  </button>;
                })}
              </div>
              <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{width:`${weekRate}%`,background:weekRate>=70?"#22c55e":weekRate>=40?"#f59e0b":"#ef4444"}}/>
              </div>
            </div>
          );
        })()}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5"><Users size={14} className="text-blue-500"/> {selectedDate} の参加状況</h3>
          <div className="flex gap-2 mb-3">
            {(["available","maybe","unavailable"] as const).map(s=>(
              <button key={s} onClick={()=>setMyAvail(s)} style={{borderColor:AVAIL_COLORS[s]+(myAvailStatus===s?"":"44"),background:myAvailStatus===s?AVAIL_COLORS[s]+"22":"white",color:AVAIL_COLORS[s]}}
                className="flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-all active:scale-95">{AVAIL_LABELS[s]}</button>
            ))}
          </div>
          {myAvailStatus&&<div className="flex gap-2"><input value={availNote} onChange={e=>setAvailNote(e.target.value)} placeholder="コメント" className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"/><button onClick={async()=>{const sb=createClient();const{data:{user}}=await sb.auth.getUser();if(!user)return;setAvailability(p=>p.map(a=>a.userId===user.id&&a.date===selectedDate?{...a,note:availNote}:a));try{await sb.from('availability').update({note:availNote}).eq('user_id',user.id).eq('date',selectedDate);}catch(e){console.log('note sync err',e);}}} className="bg-blue-100 text-blue-700 text-xs font-bold px-3 rounded-xl">保存</button></div>}
          {selectedAvail.length>0&&<div className="mt-3 space-y-1.5">{selectedAvail.map(a=>{const m=members.find(x=>x.id===a.userId);const displayN=m?.display_name||a.name;return <div key={a.userId} className="flex items-center gap-2 text-xs"><div className="w-2 h-2 rounded-full" style={{background:AVAIL_COLORS[a.status]}}/>{m?.avatar_url?<img src={m.avatar_url} className="w-4 h-4 rounded-full" alt=""/>:<div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{background:AVAIL_COLORS[a.status]}}>{displayN.charAt(0).toUpperCase()}</div>}<span className="font-medium text-gray-700 truncate flex-1">{displayN}</span><span style={{color:AVAIL_COLORS[a.status]}} className="font-bold">{AVAIL_LABELS[a.status]}</span>{a.note&&<span className={`text-[9px] truncate max-w-[80px] ${a.note==="Discord経由"?"text-indigo-400 font-bold":"text-gray-400"}`}>{a.note==="Discord経由"?<><DiscordIcon/> Discord</>:a.note}</span>}</div>; })}</div>}

          {/* ── QR出欠パネル ── */}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
                <Smartphone size={12}/> QR出欠登録
              </span>
              <div className="flex gap-1.5">
                <button onClick={()=>{setShowQRScanner(true);}} className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-green-50 text-green-700 hover:bg-green-100 transition-all active:scale-95">
                  <Smartphone size={10}/> QRスキャン
                </button>
                {perms.manageTasks&&(
                  <button onClick={()=>{setShowQRModal(true);loadQRCode();}} className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all active:scale-95">
                    <Download size={10}/> QR表示/印刷
                  </button>
                )}
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">QRコードをスキャンして入室・退室を記録。管理者はQRを印刷して作業場に掲示できます。</p>
          </div>

          {/* ── 出席確認ログ ── */}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
                <CheckSquare size={12} className="text-teal-500"/> 出席確認ログ
              </span>
              <div className="flex gap-1.5">
                {discordBotToken&&(
                  <button
                    onClick={syncAttendanceToDiscord}
                    disabled={attendanceSyncing||attendanceLogs.length===0}
                    className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all active:scale-95 disabled:opacity-50">
                    {attendanceSyncing?<Loader2 size={9} className="animate-spin"/>:<DiscordIcon/>} 同期
                  </button>
                )}
                <button
                  onClick={()=>loadAttendanceLogs(selectedDate)}
                  className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 transition-all active:scale-95">
                  <RefreshCw size={9}/> 更新
                </button>
              </div>
            </div>
            {attendanceLoading?(
              <div className="flex justify-center py-3"><Loader2 size={14} className="animate-spin text-gray-300"/></div>
            ):attendanceLogs.length===0?(
              <p className="text-[10px] text-gray-300 text-center py-2">記録なし</p>
            ):(
              <div className="space-y-1.5">
                {attendanceLogs.map(log=>{
                  const inTime = new Date(log.checked_in_at);
                  const inStr = `${inTime.getHours().toString().padStart(2,"0")}:${inTime.getMinutes().toString().padStart(2,"0")}`;
                  const outStr = log.checked_out_at
                    ? (()=>{const t=new Date(log.checked_out_at);return `${t.getHours().toString().padStart(2,"0")}:${t.getMinutes().toString().padStart(2,"0")}`;})()
                    : null;
                  const durStr = log.duration_minutes != null
                    ? log.duration_minutes>=60
                      ? `${Math.floor(log.duration_minutes/60)}h${log.duration_minutes%60}m`
                      : `${log.duration_minutes}m`
                    : null;
                  const name = log.user_name || log.user_email || log.user_id;
                  return (
                    <div key={log.id} className="flex items-center gap-2 text-[11px] bg-gray-50 rounded-xl px-2.5 py-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${log.checked_out_at?"bg-blue-400":"bg-green-400 animate-pulse"}`}/>
                      <span className="font-medium text-gray-700 truncate flex-1 min-w-0">{name}</span>
                      <span className="text-gray-400 flex-shrink-0">{inStr}</span>
                      {outStr?(
                        <>
                          <span className="text-gray-300 flex-shrink-0">→</span>
                          <span className="text-gray-400 flex-shrink-0">{outStr}</span>
                          {durStr&&<span className="text-teal-600 font-bold bg-teal-50 px-1.5 py-0.5 rounded-lg flex-shrink-0">{durStr}</span>}
                        </>
                      ):(
                        <span className="text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded-lg flex-shrink-0">入室中</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Discord 集積パネル ── */}
          <div className="mt-3 pt-3 border-t border-indigo-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-indigo-600 flex items-center gap-1.5">
                <DiscordIcon/> Discord集積
              </span>
              <div className="flex items-center gap-1.5">
                {discordBotToken ? (
                  <>
                    <button
                      onClick={postDiscordPoll}
                      disabled={discordPosting}
                      className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-all active:scale-95 disabled:opacity-50">
                      {discordPosting ? <Loader2 size={10} className="animate-spin"/> : <Send size={10}/>}
                      {discordPolls[selectedDate] ? "投票を更新" : "投票を送信"}
                    </button>
                    {discordPolls[selectedDate] && (
                      <button
                        onClick={syncDiscordReactions}
                        disabled={discordSyncing}
                        className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-green-50 text-green-700 hover:bg-green-100 transition-all active:scale-95 disabled:opacity-50">
                        {discordSyncing ? <Loader2 size={10} className="animate-spin"/> : <RefreshCw size={10}/>}
                        反応を同期
                      </button>
                    )}
                  </>
                ) : (
                  <button onClick={()=>{setActiveTab("settings");setSettingsTab("notifications");}} className="text-[11px] font-bold text-indigo-400 hover:text-indigo-600 transition-colors">
                    Bot Token を設定 →
                  </button>
                )}
              </div>
            </div>
            {discordPolls[selectedDate] ? (
              <p className="text-[10px] text-indigo-400 flex items-center gap-1">
                <Check size={9} className="text-green-500"/> 投票送信済み（メッセージID末尾: …{discordPolls[selectedDate].slice(-6)}）
              </p>
            ) : (
              <p className="text-[10px] text-gray-400">Discordチャンネルにメンバーへのリアクションアンケートを送信し、回答を自動で取り込みます。</p>
            )}
          </div>
        </div>
        {tasks.filter(t=>t.date===selectedDate).length>0&&(
          <button onClick={async()=>{
            const dayTasks=tasks.filter(t=>t.date===selectedDate);
            const q=`${selectedDate}の予定: ${dayTasks.map(t=>`「${t.title}」(${t.priority}優先度${t.done?"・完了":""})`).join(", ")}。この予定に対してアドバイスや注意点を簡潔に教えてください。`;
            setChatInput(q);setChatOpen(true);
          }} className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-3 flex items-center gap-3 text-left hover:from-blue-100 hover:to-indigo-100 transition-all active:scale-[0.99]">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{background:appearance.accentColor}}><Sparkles size={14} className="text-white"/></div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-gray-800">AIに今日のアドバイスを聞く</p>
              <p className="text-[10px] text-gray-500 truncate">{tasks.filter(t=>t.date===selectedDate).length}件の予定を分析 →</p>
            </div>
          </button>
        )}

        <h3 className="text-sm font-bold text-gray-500">{selectedDate} のタスク</h3>
        {selectedTasks.length===0?<div className="text-center py-8 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">この日はタスクがありません</div>
          :<div className="space-y-2">{selectedTasks.map(task=>(
            <div key={task.id} onClick={()=>{setTaskDetailId(task.id);setTaskEditDesc(task.notes||"");setTaskEditPhoto(task.photo||null);}}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all cursor-pointer hover:shadow-md active:scale-[0.99] ${task.done?"opacity-60":""} ${fadeIn}`}
              style={{borderColor:task.color+"44",borderLeftWidth:3,borderLeftColor:task.color}}>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-sm font-bold ${task.done?"line-through text-gray-400":"text-gray-900"}`}>{task.title}</span>
                      <Pill color={task.color}>{task.priority==="high"?"🔥高":task.priority==="medium"?"⚡中":"🌿低"}</Pill>
                      {task.assignees.includes(currentUserEmail)&&<Pill color={task.color}>担当</Pill>}
                      {task.photo&&<span className="text-[10px]">📷</span>}
                      {task.recurrence&&task.recurrence!=="none"&&<span className="text-[10px]">🔁</span>}
                    </div>
                    {task.description&&<p className="text-xs text-gray-500 line-clamp-1">{task.description}</p>}
                    {task.notes&&<p className="text-xs line-clamp-1 mt-0.5" style={{color:task.color}}>📝 {task.notes}</p>}
                    {task.location&&<div className="flex items-center gap-1 mt-1"><MapPin size={10} className="text-gray-400"/><span className="text-[10px] text-gray-400">{task.location}</span></div>}
                    {task.assignees.length>0&&<p className="text-[10px] text-gray-400 mt-0.5">👤 {task.assignees.length}人担当</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={e=>e.stopPropagation()}>
                    <button onClick={async(e)=>{e.stopPropagation();const nd=!task.done;setTasks(p=>p.map(t=>t.id===task.id?{...t,done:nd}:t));try{const sb=createClient();await sb.from('tasks').update({done:nd}).eq('id',task.id);}catch(er){console.log('done err',er);}if(nd)logActivity("タスク完了","task",task.id,{title:task.title});}}
                      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${task.done?"":"border-gray-200 hover:border-green-400"}`}
                      style={task.done?{background:"#22c55e",borderColor:"#22c55e"}:{}}>
                      {task.done&&<Check size={13} className="text-white"/>}
                    </button>
                    {perms.manageTasks&&<button onClick={async(e)=>{e.stopPropagation();setTasks(p=>p.filter(t=>t.id!==task.id));try{const sb=createClient();await sb.from("tasks").delete().eq("id",task.id);}catch(er){console.log("del err",er);}}} className="p-1 text-gray-200 hover:text-red-400 transition-colors"><Trash2 size={13}/></button>}
                  </div>
                </div>
                {task.openJoin&&!task.assignees.includes(currentUserEmail)&&(
                  <button onClick={async(e)=>{e.stopPropagation();const na=[...task.assignees,currentUserEmail];setTasks(p=>p.map(t=>t.id===task.id?{...t,assignees:na}:t));try{const sb=createClient();await sb.from('tasks').update({assignees:na}).eq('id',task.id);}catch(er){console.log('join err',er);}}}
                    className="mt-2 w-full py-1.5 rounded-xl text-xs font-bold text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 transition-colors flex items-center justify-center gap-1">
                    <UserPlus size={12}/> タスクに参加
                  </button>
                )}
              </div>
            </div>
          ))}</div>
        }
        {taskDetailId&&(()=>{
          const task = tasks.find(t=>t.id===taskDetailId);
          if(!task) return null;
          // コメント・チェックリストをモーダル開いたとき初回ロード
          if(!taskComments.find(c=>c.task_id===task.id)&&taskCommentInput==="") { loadTaskComments(task.id); }
          return (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={()=>setTaskDetailId(null)}>
              <div className={`bg-white w-full rounded-t-3xl max-h-[90vh] overflow-y-auto ${slideUp}`} onClick={e=>e.stopPropagation()}>
                <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3"/>
                <div className="px-5 py-4 border-b border-gray-100" style={{borderLeftWidth:4,borderLeftColor:task.color}}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3 className="font-black text-gray-900 text-lg">{task.title}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Pill color={task.color}>{task.priority==="high"?"🔥 高優先度":task.priority==="medium"?"⚡ 中優先度":"🌿 低優先度"}</Pill>
                        {task.date&&<span className="text-xs text-gray-400">📅 {task.date}</span>}
                        {task.location&&<span className="text-xs text-gray-400">📍 {task.location}</span>}
                      </div>
                    </div>
                    <button onClick={async()=>{const nd=!task.done;setTasks(p=>p.map(t=>t.id===task.id?{...t,done:nd}:t));try{const sb=createClient();await sb.from('tasks').update({done:nd}).eq('id',task.id);}catch(er){console.log(er);}}}
                      className="w-10 h-10 rounded-2xl border-2 flex items-center justify-center transition-all shrink-0"
                      style={task.done?{background:"#22c55e",borderColor:"#22c55e"}:{borderColor:task.color}}>
                      {task.done?<Check size={18} className="text-white"/>:<span className="text-xs font-bold" style={{color:task.color}}>完了</span>}
                    </button>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  {task.description&&(
                    <div className="bg-gray-50 rounded-2xl p-3">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">説明</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{task.description}</p>
                    </div>
                  )}
                  {task.photo&&<img src={task.photo} alt="task" className="w-full rounded-2xl object-cover max-h-48"/>}
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">メモ・進捗報告</p>
                    <textarea value={taskEditDesc} onChange={e=>setTaskEditDesc(e.target.value)} rows={3} placeholder="ここに進捗・メモを書く..."
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 resize-none" style={{"--tw-ring-color":task.color} as any}/>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">写真を追加</p>
                    <button onClick={()=>taskPhotoRef.current?.click()}
                      className="w-full h-24 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-1.5 hover:border-blue-300 hover:bg-blue-50 transition-colors overflow-hidden">
                      {taskEditPhoto?<img src={taskEditPhoto} alt="" className="w-full h-full object-cover"/>:<><ImageIcon size={20} className="text-gray-300"/><span className="text-xs text-gray-400">写真を追加</span></>}
                    </button>
                    <input ref={taskPhotoRef} type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>setTaskEditPhoto(r.result as string);r.readAsDataURL(f);}}/>
                    {taskEditPhoto&&<button onClick={()=>setTaskEditPhoto(null)} className="text-xs text-red-500 mt-1">削除</button>}
                  </div>
                  {task.assignees.length>0&&(
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">担当メンバー</p>
                      <div className="flex flex-wrap gap-2">
                        {task.assignees.map(a=>{
                          const m=members.find(x=>x.email===a);
                          return <div key={a} className="flex items-center gap-1.5 bg-gray-100 rounded-xl px-2.5 py-1.5">
                            {m?.avatar_url?<img src={m.avatar_url} alt="" className="w-5 h-5 rounded-full"/>:<div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{background:task.color}}>{a.charAt(0).toUpperCase()}</div>}
                            <span className="text-xs font-medium text-gray-700">{m?.display_name||a.split("@")[0]}</span>
                          </div>;
                        })}
                      </div>
                    </div>
                  )}
                  {/* チェックリスト */}
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">チェックリスト</p>
                    <div className="space-y-1.5 mb-2">
                      {(task.checklist||[]).map(item=>(
                        <div key={item.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                          <button onClick={()=>{const cl=(task.checklist||[]).map(c=>c.id===item.id?{...c,done:!c.done}:c);updateChecklist(task.id,cl);}} className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${item.done?"bg-green-500 border-green-500":"border-gray-300"}`}>{item.done&&<Check size={9} className="text-white"/>}</button>
                          <span className={`text-xs flex-1 ${item.done?"line-through text-gray-400":"text-gray-700"}`}>{item.text}</span>
                          <button onClick={()=>{const cl=(task.checklist||[]).filter(c=>c.id!==item.id);updateChecklist(task.id,cl);}} className="text-gray-300 hover:text-red-400 transition-colors"><X size={11}/></button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input value={newChecklistText} onChange={e=>setNewChecklistText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&newChecklistText.trim()){const cl=[...(task.checklist||[]),{id:Date.now().toString(),text:newChecklistText.trim(),done:false}];updateChecklist(task.id,cl);setNewChecklistText("");}}} placeholder="新しい項目 (Enter で追加)" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"/>
                      <button onClick={()=>{if(!newChecklistText.trim())return;const cl=[...(task.checklist||[]),{id:Date.now().toString(),text:newChecklistText.trim(),done:false}];updateChecklist(task.id,cl);setNewChecklistText("");}} className="text-xs bg-blue-100 text-blue-700 font-bold px-3 rounded-xl hover:bg-blue-200 transition-colors">追加</button>
                    </div>
                  </div>

                  {/* コメント */}
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">コメント</p>
                    <div className="space-y-2 mb-2 max-h-40 overflow-y-auto">
                      {taskComments.filter(c=>c.task_id===task.id).map(c=>(
                        <div key={c.id} className="bg-gray-50 rounded-xl px-3 py-2">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="text-[10px] font-bold text-gray-500">{c.user_name}</span>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-gray-400">{new Date(c.created_at).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"})}</span>
                              {c.user_id===currentUserId&&<button onClick={()=>deleteTaskComment(c.id)} className="text-gray-300 hover:text-red-400 transition-colors"><X size={10}/></button>}
                            </div>
                          </div>
                          <p className="text-xs text-gray-700">{c.content}</p>
                        </div>
                      ))}
                      {taskComments.filter(c=>c.task_id===task.id).length===0&&<p className="text-[10px] text-gray-300 text-center py-2">コメントはありません</p>}
                    </div>
                    <div className="flex gap-2">
                      <input value={taskCommentInput} onChange={e=>setTaskCommentInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.nativeEvent.isComposing)addTaskComment(task.id);}} placeholder="コメントを追加..." className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"/>
                      <button onClick={()=>addTaskComment(task.id)} className="text-xs bg-blue-600 text-white font-bold px-3 rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-1"><Send size={10}/></button>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button onClick={async()=>{
                      setTasks(p=>p.map(t=>t.id===task.id?{...t,notes:taskEditDesc,photo:taskEditPhoto||undefined}:t));
                      setTaskDetailId(null); setTaskComments([]); setTaskCommentInput("");
                      try{const sb=createClient();await sb.from('tasks').update({notes:taskEditDesc,photo:taskEditPhoto}).eq('id',task.id);}catch(er){console.log('save err',er);}
                    }} className="flex-1 text-white font-bold py-3 rounded-2xl text-sm transition-all active:scale-[0.98]" style={{background:task.color}}>
                      保存して閉じる
                    </button>
                    {perms.manageTasks&&<button onClick={async()=>{setTasks(p=>p.filter(t=>t.id!==task.id));setTaskDetailId(null);setTaskComments([]);try{const sb=createClient();await sb.from("tasks").delete().eq("id",task.id);}catch(er){console.log(er);}}} className="w-12 bg-red-50 text-red-500 font-bold py-3 rounded-2xl text-sm hover:bg-red-100 transition-all flex items-center justify-center"><Trash2 size={15}/></button>}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {showTaskForm&&(
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={()=>setShowTaskForm(false)}>
            <div className={`bg-white w-full rounded-t-3xl p-6 space-y-3 max-h-[90vh] overflow-y-auto ${slideUp}`} onClick={e=>e.stopPropagation()}>
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto"/>
              <h3 className="font-black text-gray-900 text-base">タスクを追加 — {selectedDate}</h3>
              <input placeholder="タスク名 *" value={newTask.title} onChange={e=>setNewTask(p=>({...p,title:e.target.value}))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/>
              <textarea placeholder="説明（任意）" value={newTask.desc} onChange={e=>setNewTask(p=>({...p,desc:e.target.value}))} rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"/>
              <input placeholder="場所（任意）" value={newTask.location} onChange={e=>setNewTask(p=>({...p,location:e.target.value}))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/>
              <div><p className="text-xs font-bold text-gray-500 mb-2">優先度</p><div className="flex gap-2">{(["low","medium","high"] as const).map(p=><button key={p} onClick={()=>setNewTask(prev=>({...prev,priority:p}))} className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-all ${newTask.priority===p?"border-blue-500 bg-blue-50 text-blue-700":"border-gray-200 text-gray-500"}`}>{p==="low"?"🌿低":p==="medium"?"⚡中":"🔥高"}</button>)}</div></div>
              <div><p className="text-xs font-bold text-gray-500 mb-2">カラー</p><div className="flex gap-2 flex-wrap">{TASK_COLORS.map(c=><button key={c} onClick={()=>setNewTask(p=>({...p,color:c}))} style={{background:c}} className={`w-7 h-7 rounded-full transition-all ${newTask.color===c?"scale-125 ring-2 ring-offset-1 ring-gray-400":""}`}/>)}</div></div>
              <div className="flex items-center justify-between py-1"><span className="text-sm font-medium text-gray-700">誰でも参加可能</span><Toggle checked={newTask.open} onChange={v=>setNewTask(p=>({...p,open:v}))} activeColor={appearance.accentColor}/></div>
              <div className="flex gap-2 items-end">
                <div className="flex-1"><p className="text-xs font-bold text-gray-500 mb-2">繰り返し</p><select value={newTaskRecurrence} onChange={e=>setNewTaskRecurrence(e.target.value as "none"|"weekly"|"monthly")} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"><option value="none">なし</option><option value="weekly">毎週</option><option value="monthly">毎月</option></select></div>
                {newTaskRecurrence!=="none"&&<div className="w-24"><p className="text-xs font-bold text-gray-500 mb-2">回数</p><input type="number" min={1} max={12} value={newTaskRecurrenceCount} onChange={e=>setNewTaskRecurrenceCount(Math.max(1,Math.min(12,parseInt(e.target.value)||1)))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/></div>}
              </div>
              <div><p className="text-xs font-bold text-gray-500 mb-2">担当者</p><div className="flex gap-2"><input placeholder="メール or 名前" value={newAssignee} onChange={e=>setNewAssignee(e.target.value)} className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/><button onClick={()=>{if(newAssignee.trim()){setNewTask(p=>({...p,assignees:[...p.assignees,newAssignee.trim()]}));setNewAssignee("");}}} className="bg-blue-100 text-blue-700 font-bold text-xs px-3 rounded-xl hover:bg-blue-200 transition-colors">追加</button></div>{newTask.assignees.length>0&&<div className="flex flex-wrap gap-1.5 mt-2">{newTask.assignees.map(a=><span key={a} className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2 py-1 rounded-full">{a}<button onClick={()=>setNewTask(p=>({...p,assignees:p.assignees.filter(x=>x!==a)}))}><X size={10}/></button></span>)}</div>}</div>
              <button onClick={addTask} className="w-full text-white font-bold py-3 rounded-2xl text-sm transition-all active:scale-[0.98]" style={{background:appearance.accentColor}}>タスクを追加</button>
            </div>
          </div>
        )}
      </div>
    );

    if(activeTab==="inventory") return (
      <div className={`p-4 space-y-4 ${fadeIn}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-gray-900">在庫・設備</h2>
          <div className="flex gap-2">
            {perms.manageInventory&&(
              <>
                <button onClick={()=>xlsxImportRef.current?.click()} disabled={xlsxImporting} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all active:scale-95 disabled:opacity-50">
                  {xlsxImporting?<Loader2 size={12} className="animate-spin"/>:<Upload size={12}/>} Excel
                </button>
                <input ref={xlsxImportRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)handleXlsxImport(f);e.target.value="";}}/>
                <button onClick={()=>setShowInvForm(true)} className="flex items-center gap-1.5 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm transition-all active:scale-95" style={{background:appearance.accentColor}}><Plus size={14}/> 追加</button>
              </>
            )}
          </div>
        </div>
        {/* カテゴリフィルター */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 items-center">
          {["すべて",...invCats].map(cat=><button key={cat} className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${invFilter===cat?"text-white border-transparent":"bg-white text-gray-500 border-gray-200"}`} style={invFilter===cat?{background:appearance.accentColor}:{}} onClick={()=>setInvFilter(cat)}>{cat}</button>)}
          {perms.manageInventory&&(
            showInvCatForm
              ? <div className="flex gap-1 shrink-0">
                  <input autoFocus value={newInvCat} onChange={e=>setNewInvCat(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&newInvCat.trim()){const c=newInvCat.trim();const next=[...invCats,c];setInvCats(next);saveLS("as_inv_cats",next);setNewInvCat("");setShowInvCatForm(false);}if(e.key==="Escape"){setShowInvCatForm(false);}}} placeholder="カテゴリ名" className="text-xs border border-gray-300 rounded-full px-2.5 py-1 w-24 focus:outline-none focus:ring-1 focus:ring-blue-300"/>
                  <button onClick={()=>{if(newInvCat.trim()){const c=newInvCat.trim();const next=[...invCats,c];setInvCats(next);saveLS("as_inv_cats",next);setNewInvCat("");setShowInvCatForm(false);}}} className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full font-bold">追加</button>
                  <button onClick={()=>setShowInvCatForm(false)} className="text-xs text-gray-400 px-2 py-1 rounded-full">×</button>
                </div>
              : <button onClick={()=>setShowInvCatForm(true)} className="shrink-0 text-xs font-bold px-2.5 py-1.5 rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-all"><Plus size={10}/></button>
          )}
        </div>
        {/* 低在庫アラート */}
        {lowStock.length>0&&(
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2">
            <span className="text-amber-500 mt-0.5">⚠️</span>
            <div><p className="text-xs font-bold text-amber-700">在庫少：{lowStock.map(i=>i.name).join("、")}</p><p className="text-[10px] text-amber-500 mt-0.5">30%以下の在庫があります</p></div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          {(invFilter==="すべて"?inventory:inventory.filter(i=>i.category===invFilter)).map(item=>(
            <div key={item.id} className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all hover:shadow-md ${fadeIn}`}>
              <div className="relative">
                {item.isEmoji?<div className="h-24 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center text-5xl">{item.image}</div>:<img src={item.image} alt={item.name} className="w-full h-24 object-cover"/>}
                {perms.manageInventory&&<button onClick={async ()=>{if(!confirm(`「${item.name}」を削除しますか？`))return;setInventory(p=>p.filter(x=>x.id!==item.id));try{const sb=createClient();await sb.from('inventory').delete().eq('id',item.id);}catch(e){console.log('inv err',e);}}} className="absolute top-1.5 right-1.5 w-6 h-6 bg-white/90 rounded-full flex items-center justify-center text-gray-400 hover:text-red-400 shadow-sm transition-all"><Trash2 size={11}/></button>}
                <div className="absolute top-1.5 left-1.5"><Pill color={appearance.accentColor}>{item.category}</Pill></div>
                {item.stock===0&&<div className="absolute inset-0 bg-black/40 flex items-center justify-center"><span className="text-white font-black text-xs bg-red-500 px-2 py-0.5 rounded-full">在庫切れ</span></div>}
              </div>
              <div className="p-2.5">
                <p className="text-xs font-bold text-gray-800 truncate mb-1.5">{item.name}</p>
                <div className="flex items-center gap-1 mb-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{width:`${Math.min(100,(item.stock/Math.max(1,item.total))*100)}%`,background:item.stock===0?"#ef4444":item.stock<item.total*0.3?"#f59e0b":appearance.accentColor}}/></div>
                  <span className="text-[10px] font-bold text-gray-500 shrink-0">{item.stock}/{item.total}</span>
                </div>
                {perms.manageInventory&&<div className="flex gap-1"><button onClick={async()=>{const ns=Math.max(0,item.stock-1);setInventory(p=>p.map(x=>x.id===item.id?{...x,stock:ns}:x));try{const sb=createClient();await sb.from('inventory').update({stock:ns}).eq('id',item.id);}catch(e){console.log('inv err',e);}}} className="flex-1 py-1 bg-red-50 text-red-500 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors">−</button><button onClick={async()=>{const ns=Math.min(item.total,item.stock+1);setInventory(p=>p.map(x=>x.id===item.id?{...x,stock:ns}:x));try{const sb=createClient();await sb.from('inventory').update({stock:ns}).eq('id',item.id);}catch(e){console.log('inv err',e);}}} className="flex-1 py-1 bg-green-50 text-green-600 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors">＋</button></div>}
              </div>
            </div>
          ))}
        </div>
        {inventory.length===0&&<div className="text-center py-16 text-gray-300"><Package size={40} className="mx-auto mb-3"/><p className="text-sm font-bold">機材・在庫がありません</p><p className="text-xs mt-1">「追加」ボタンまたはExcelファイルでインポートできます</p></div>}
        {showInvForm&&(
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={()=>setShowInvForm(false)}>
            <div className={`bg-white w-full rounded-t-3xl p-6 space-y-4 ${slideUp}`} onClick={e=>e.stopPropagation()}>
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto"/>
              <h3 className="font-black text-gray-900 text-base">機材を追加</h3>
              <button onClick={()=>imgRef.current?.click()} className="w-full h-28 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-blue-300 hover:bg-blue-50 transition-colors overflow-hidden">
                {newInv.image?<img src={newInv.image} className="w-full h-full object-cover" alt="preview"/>:<><ImageIcon size={24} className="text-gray-300"/><span className="text-xs text-gray-400">写真をアップロード</span></>}
              </button>
              <input ref={imgRef} type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>setNewInv(p=>({...p,image:r.result as string}));r.readAsDataURL(f);}} className="hidden"/>
              {!newInv.image&&<><div className="flex items-center gap-3"><div className="flex-1 h-px bg-gray-200"/><span className="text-xs text-gray-400">または絵文字</span><div className="flex-1 h-px bg-gray-200"/></div><input placeholder="📷" value={newInv.emoji} onChange={e=>setNewInv(p=>({...p,emoji:e.target.value}))} className="w-20 mx-auto block text-center border border-gray-200 rounded-xl py-2 text-2xl focus:outline-none focus:ring-2 focus:ring-blue-300"/></>}
              {newInv.image&&<button onClick={()=>setNewInv(p=>({...p,image:null}))} className="text-xs text-red-500 font-medium">画像を削除</button>}
              <input placeholder="機材名 *" value={newInv.name} onChange={e=>setNewInv(p=>({...p,name:e.target.value}))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/>
              <input type="number" placeholder="総数 *" min={1} value={newInv.total} onChange={e=>setNewInv(p=>({...p,total:e.target.value}))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/>
              <select value={newInv.category} onChange={e=>setNewInv(p=>({...p,category:e.target.value}))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">{invCats.map(c=><option key={c}>{c}</option>)}</select>
              <button onClick={addInventory} className="w-full text-white font-bold py-3 rounded-2xl text-sm transition-all active:scale-[0.98]" style={{background:appearance.accentColor}}>追加</button>
            </div>
          </div>
        )}
      </div>
    );

    if(activeTab==="wiki"){
      if(activeWiki) return <WikiPageView page={activeWiki} canEdit={perms.manageWiki} onSave={async(updated)=>{setWikis(p=>p.map(w=>w.id===updated.id?updated:w));setActiveWiki(updated);try{const sb=createClient();await sb.from('wiki_pages').update({title:updated.title,content:updated.content,category:updated.category,updated_at:new Date().toISOString(),views:updated.views}).eq('id',updated.id);}catch(e){console.log('wiki save err',e);}}} onBack={()=>setActiveWiki(null)}/>;
      const fw=wikiFilter==="すべて"?wikis:wikis.filter(w=>w.category===wikiFilter);
      return (
        <div className={`p-4 space-y-4 ${fadeIn}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-gray-900">Wiki</h2>
            {perms.manageWiki&&<button onClick={()=>setShowWikiForm(true)} className="flex items-center gap-1.5 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm transition-all active:scale-95" style={{background:appearance.accentColor}}><Plus size={14}/> 新規ページ</button>}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {["すべて",...WIKI_CATS].map(cat=><button key={cat} onClick={()=>setWikiFilter(cat)} className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${wikiFilter===cat?"text-white border-transparent":"bg-white text-gray-500 border-gray-200"}`} style={wikiFilter===cat?{background:appearance.accentColor}:{}}>{cat}</button>)}
          </div>
          <div className="space-y-2">
            {fw.length===0?<div className="text-center py-8 text-sm text-gray-400 bg-white rounded-2xl border border-gray-100">ページがありません</div>
              :fw.map(w=>(
                <button key={w.id} onClick={async()=>{setWikis(p=>p.map(x=>x.id===w.id?{...x,views:x.views+1}:x));setActiveWiki({...w,views:w.views+1});try{const sb=createClient();await sb.from('wiki_pages').update({views:w.views+1}).eq('id',w.id);}catch(e){console.log(e);}}}
                  className={`w-full bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-left hover:border-blue-200 hover:shadow-md transition-all active:scale-[0.99] ${fadeIn}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1"><Hash size={13} className="text-blue-400 shrink-0"/><span className="font-bold text-sm text-gray-900 truncate">{w.title}</span></div>
                      <p className="text-xs text-gray-500 line-clamp-1 ml-5">{w.content.replace(/#+ /g,"").split("\n").find(l=>l.trim()&&!l.startsWith("#"))??"" }</p>
                      <div className="flex items-center gap-2 mt-1.5 ml-5"><Pill color={appearance.accentColor}>{w.category}</Pill><span className="text-[10px] text-gray-400">{w.updatedAt}</span><span className="text-[10px] text-gray-400">👁 {w.views}</span></div>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 shrink-0 mt-1"/>
                  </div>
                </button>
              ))
            }
          </div>
          {showWikiForm&&<div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={()=>setShowWikiForm(false)}><div className={`bg-white w-full rounded-t-3xl p-6 space-y-4 ${slideUp}`} onClick={e=>e.stopPropagation()}><div className="w-10 h-1 bg-gray-200 rounded-full mx-auto"/><h3 className="font-black text-gray-900 text-base">新規Wikiページ</h3><input placeholder="タイトル" value={newWiki.title} onChange={e=>setNewWiki(p=>({...p,title:e.target.value}))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/><select value={newWiki.cat} onChange={e=>setNewWiki(p=>({...p,cat:e.target.value}))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-white">{WIKI_CATS.map(c=><option key={c}>{c}</option>)}</select><button onClick={addWiki} className="w-full text-white font-bold py-3 rounded-2xl text-sm" style={{background:appearance.accentColor}}>作成して編集</button></div></div>}

          {/* ⑧ 共有ファイルセクション */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-black text-gray-900 flex items-center gap-1.5">📎 共有ファイル</h3>
              <button onClick={()=>fileUploadRef.current?.click()} disabled={fileUploading} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl text-white transition-all active:scale-95 disabled:opacity-50" style={{background:appearance.accentColor}}>
                {fileUploading?<Loader2 size={12} className="animate-spin"/>:<Upload size={12}/>} アップロード
              </button>
              <input ref={fileUploadRef} type="file" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)uploadSharedFile(f);e.target.value="";}}/>
            </div>
            <div className="flex gap-1.5 overflow-x-auto px-4 py-2 border-b border-gray-50">
              {["すべて","ドキュメント","画像","動画","その他"].map(cat=>(
                <button key={cat} onClick={()=>setFileFilter(cat)} className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full border transition-all ${fileFilter===cat?"text-white border-transparent":"bg-white text-gray-500 border-gray-200"}`} style={fileFilter===cat?{background:appearance.accentColor}:{}}>{cat}</button>
              ))}
            </div>
            {sharedFilesLoading?(
              <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-gray-300"/></div>
            ):(
              <div className="divide-y divide-gray-50">
                {(fileFilter==="すべて"?sharedFiles:sharedFiles.filter(f=>f.category===fileFilter)).length===0?(
                  <p className="text-xs text-gray-400 text-center py-6">ファイルがありません</p>
                ):(fileFilter==="すべて"?sharedFiles:sharedFiles.filter(f=>f.category===fileFilter)).map(file=>(
                  <div key={file.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base" style={{background:appearance.accentColor+"15"}}>
                      {file.category==="画像"?"🖼️":file.category==="動画"?"🎬":file.category==="ドキュメント"?"📄":"📎"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">{file.name}</p>
                      <p className="text-[10px] text-gray-400">{file.uploaded_by_name} · {Math.round(file.size/1024)}KB</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <a href={file.url} target="_blank" rel="noreferrer" className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"><Download size={12}/></a>
                      {file.uploaded_by===currentUserId&&<button onClick={()=>deleteSharedFile(file)} className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-50 text-red-500 hover:bg-red-100 transition-colors"><Trash2 size={12}/></button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    if(activeTab==="members") return (
      <div className={`p-4 space-y-4 ${fadeIn}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2"><Users size={20} style={{color:appearance.accentColor}}/> メンバー</h2>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full text-white" style={{background:appearance.accentColor}}>{members.length}人</span>
        </div>

        <button onClick={()=>setGroupOpen(true)} className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 flex items-center gap-3 hover:shadow-md transition-all active:scale-[0.99]">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{background:appearance.accentColor+"22"}}>💬</div>
          <div className="flex-1 text-left">
            <p className="text-sm font-black text-gray-900">グループチャット</p>
            <p className="text-xs text-gray-500">全員へのメッセージ・メンション</p>
          </div>
          <ChevronRight size={16} className="text-gray-300"/>
        </button>

        <div className="space-y-2">
          {(()=>{
            const dbEmails = new Set(members.map(m=>m.email));
            const extraFromRoles: Member[] = memberRoles
              .filter(mr=>!dbEmails.has(mr.email))
              .map(mr=>({id:mr.email,email:mr.email,display_name:mr.email.split("@")[0],role_id:mr.roleId,visual_effect:"none",online_at:undefined}));
            const allMembers = [...members,...extraFromRoles];
            if(allMembers.length===0) return (
              <div className="text-center py-8 bg-white rounded-2xl border border-gray-100">
                <p className="text-2xl mb-2">👥</p>
                <p className="text-sm font-bold text-gray-700">まだメンバーがいません</p>
                <p className="text-xs text-gray-400 mt-1">メンバーがログインすると自動で表示されます</p>
              </div>
            );
            return allMembers.map(member=>{
              const effectiveRoleId = member.role_id ?? "member";
              const role = roles.find(r=>r.id===effectiveRoleId) ?? roles.find(r=>r.id==="member")!;
              const isOnline = member.online_at && (Date.now()-new Date(member.online_at).getTime()) < 5*60*1000;
              const isMe = member.email === currentUserEmail;
              return (
              <div key={member.id} className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 ${fadeIn}`}>
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    {member.avatar_url
                      ?<img src={member.avatar_url} alt="" className="w-11 h-11 rounded-xl object-cover"/>
                      :<div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-white text-base" style={{background:role.color}}>{(member.display_name||member.email||"?").charAt(0).toUpperCase()}</div>
                    }
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${isOnline?"bg-green-400":"bg-gray-300"}`}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <VisualEffectWrapper effect={member.visual_effect||"none"}>
                        <span className="text-sm font-black text-gray-900 truncate">
                          {member.display_name||member.email?.split("@")[0]||"Unknown"}
                          {isMe&&<span className="ml-1 text-[10px] text-gray-400 font-normal">（あなた）</span>}
                        </span>
                      </VisualEffectWrapper>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <VisualEffectWrapper effect={role.visualEffect||"none"}>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{background:role.color+"22",color:role.color}}>{role.icon} {role.name}</span>
                      </VisualEffectWrapper>
                      {member.discord_id&&<span className="text-[10px] text-indigo-500 font-bold bg-indigo-50 px-1.5 py-0.5 rounded-full">Discord連携</span>}
                      <span className={`text-[10px] font-bold ${isOnline?"text-green-500":"text-gray-400"}`}>{isOnline?"オンライン":"オフライン"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={()=>{setAttendanceHistoryMember(member);loadMemberAttendance(member.id);}} className="w-8 h-8 rounded-xl flex items-center justify-center bg-teal-50 text-teal-600 transition-all hover:scale-110 active:scale-90">
                      <CheckSquare size={14}/>
                    </button>
                    {!isMe&&(
                      <button onClick={()=>setDmOpen(member)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-110 active:scale-90"
                        style={{background:appearance.accentColor+"22",color:appearance.accentColor}}>
                        <MessageCircle size={14}/>
                      </button>
                    )}
                    {!isMe&&perms.manageMembers&&(
                      <button onClick={()=>{
                        const msg=prompt(`@${member.display_name||member.email} へのメンション内容:`);
                        if(msg) sendMentionToDiscord(member,msg);
                      }} className="w-8 h-8 rounded-xl flex items-center justify-center bg-purple-50 text-purple-600 transition-all hover:scale-110 active:scale-90">
                        <AtSign size={14}/>
                      </button>
                    )}
                    {canManageRoles&&(
                      <button onClick={()=>setRoleChangeTarget(roleChangeTarget===member.id?null:member.id)}
                        className="w-8 h-8 rounded-xl flex items-center justify-center bg-amber-50 text-amber-600 transition-all hover:scale-110 active:scale-90">
                        <Shield size={14}/>
                      </button>
                    )}
                  </div>
                </div>
                {canManageRoles && roleChangeTarget===member.id&&(
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">ロールを変更</p>
                    <div className="flex flex-wrap gap-1.5">
                      {roles.map(r=>(
                        <button key={r.id} onClick={() => updateMemberRole(member.id, r.id)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border-2 transition-all active:scale-95 ${effectiveRoleId===r.id?"border-opacity-100":"border-opacity-20 opacity-60 hover:opacity-100"}`}
                          style={{borderColor:r.color,background:effectiveRoleId===r.id?r.color+"22":"transparent",color:r.color}}>
                          {r.icon} {r.name}
                          {effectiveRoleId===r.id&&<Check size={10}/>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              );
            });
          })()}
        </div>

        {dmOpen&&(
          <div className="fixed inset-0 bg-black/50 z-50 flex flex-col" onClick={()=>setDmOpen(null)}>
            <div className="flex-1"/>
            <div className={`bg-white rounded-t-3xl flex flex-col overflow-hidden ${slideUp}`} style={{height:"75vh"}} onClick={e=>e.stopPropagation()}>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 shrink-0" style={{background:`linear-gradient(135deg,${appearance.accentColor},${appearance.accentColor}bb)`}}>
                {dmOpen.avatar_url
                  ?<img src={dmOpen.avatar_url} alt="" className="w-8 h-8 rounded-xl object-cover"/>
                  :<div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-white text-sm" style={{background:"rgba(255,255,255,0.2)"}}>{(dmOpen.display_name||dmOpen.email||"?").charAt(0).toUpperCase()}</div>
                }
                <div className="flex-1">
                  <p className="text-sm font-black text-white">{dmOpen.display_name||dmOpen.email?.split("@")[0]}</p>
                  <p className="text-[10px] text-white/70">{dmOpen.discord_id?"Discord連携済み":"メール連携"}</p>
                </div>
                <button onClick={()=>setDmOpen(null)} className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center"><X size={14} className="text-white"/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-gray-50">
                {dmMessages.length===0&&<div className="text-center py-8"><p className="text-sm text-gray-400">まだメッセージはありません</p></div>}
                {dmMessages.map((m,i)=>{
                  const isMe=m.sender_email===currentUserEmail;
                  return (
                    <div key={i} className={`flex gap-2 ${isMe?"flex-row-reverse":""}`}>
                      <div className="w-6 h-6 rounded-lg bg-gray-200 flex items-center justify-center shrink-0 text-xs font-bold text-gray-600">{(m.sender_name||"?").charAt(0).toUpperCase()}</div>
                      <div>
                        <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${isMe?"rounded-tr-sm":"bg-white border border-gray-100 text-gray-800 shadow-sm rounded-tl-sm"}`}
                          style={isMe?{background:appearance.accentColor,color:"#ffffff"}:{color:"#1f2937"}}>
                          {m.content}
                        </div>
                        <p className={`text-[9px] text-gray-400 mt-0.5 ${isMe?"text-right":"text-left"} px-1`}>
                          {new Date(m.created_at).toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"})}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={dmEndRef}/>
              </div>
              <div className="p-3 bg-white border-t border-gray-100 flex gap-2 shrink-0">
                <textarea value={dmInput} onChange={e=>setDmInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();sendDm();}}} placeholder="メッセージを送信... (Enterで送信 / Shift+Enterで改行)" rows={1} className="flex-1 bg-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:bg-white transition resize-none" style={{maxHeight:"80px",overflowY:"auto"}}/>
                <button onClick={sendDm} disabled={!dmInput.trim()} className="w-9 h-9 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-all active:scale-95" style={{background:appearance.accentColor}}><Send size={14}/></button>
              </div>
            </div>
          </div>
        )}

        {/* ⑩ メンバー出席履歴モーダル */}
        {attendanceHistoryMember&&(
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={()=>setAttendanceHistoryMember(null)}>
            <div className={`bg-white w-full rounded-t-3xl max-h-[85vh] overflow-y-auto ${slideUp}`} onClick={e=>e.stopPropagation()}>
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3"/>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                {attendanceHistoryMember.avatar_url
                  ?<img src={attendanceHistoryMember.avatar_url} alt="" className="w-10 h-10 rounded-xl object-cover"/>
                  :<div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-base" style={{background:appearance.accentColor}}>{(attendanceHistoryMember.display_name||"?").charAt(0).toUpperCase()}</div>
                }
                <div className="flex-1">
                  <h3 className="font-black text-gray-900">{attendanceHistoryMember.display_name || attendanceHistoryMember.email}</h3>
                  <p className="text-xs text-gray-400">出席履歴（最新30件）</p>
                </div>
                <button onClick={()=>setAttendanceHistoryMember(null)} className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center"><X size={13} className="text-gray-500"/></button>
              </div>
              <div className="p-4 space-y-3">
                {memberAttendanceLoading ? (
                  <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-gray-300"/></div>
                ) : memberAttendanceLogs.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">出席記録がありません</p>
                ) : (
                  <>
                    {/* 累計統計 */}
                    {(()=>{
                      const total = memberAttendanceLogs.length;
                      const completed = memberAttendanceLogs.filter(l=>l.duration_minutes!=null);
                      const totalMin = completed.reduce((s,l)=>s+(l.duration_minutes||0),0);
                      const avgMin = completed.length>0?Math.round(totalMin/completed.length):0;
                      return (
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-blue-50 rounded-xl p-2.5 text-center"><p className="text-lg font-black text-blue-700">{total}</p><p className="text-[10px] text-blue-500 font-bold">総入室回数</p></div>
                          <div className="bg-green-50 rounded-xl p-2.5 text-center"><p className="text-base font-black text-green-700">{totalMin>=60?`${Math.floor(totalMin/60)}h${totalMin%60}m`:`${totalMin}m`}</p><p className="text-[10px] text-green-500 font-bold">合計滞在時間</p></div>
                          <div className="bg-purple-50 rounded-xl p-2.5 text-center"><p className="text-base font-black text-purple-700">{avgMin}分</p><p className="text-[10px] text-purple-500 font-bold">平均滞在時間</p></div>
                        </div>
                      );
                    })()}
                    <div className="space-y-1.5">
                      {memberAttendanceLogs.map(log=>{
                        const inTime = new Date(log.checked_in_at);
                        const inStr = `${inTime.getHours().toString().padStart(2,"0")}:${inTime.getMinutes().toString().padStart(2,"0")}`;
                        const dateStr = inTime.toLocaleDateString("ja-JP",{month:"short",day:"numeric",weekday:"short"});
                        const outStr = log.checked_out_at?(()=>{const t=new Date(log.checked_out_at);return `${t.getHours().toString().padStart(2,"0")}:${t.getMinutes().toString().padStart(2,"0")}`;})():null;
                        const durStr = log.duration_minutes!=null?(log.duration_minutes>=60?`${Math.floor(log.duration_minutes/60)}h${log.duration_minutes%60}m`:`${log.duration_minutes}m`):null;
                        return (
                          <div key={log.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                            <div className="text-[10px] font-bold text-gray-500 w-16 shrink-0">{dateStr}</div>
                            <span className="text-xs text-gray-600">{inStr}</span>
                            {outStr&&<><span className="text-gray-300 text-[10px]">→</span><span className="text-xs text-gray-600">{outStr}</span></>}
                            <div className="flex-1"/>
                            {durStr&&<span className="text-[11px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-lg">{durStr}</span>}
                            {!log.checked_out_at&&<span className="text-[11px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-lg">入室中</span>}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {groupOpen&&(
          <div className="fixed inset-0 bg-black/50 z-50 flex flex-col" onClick={()=>setGroupOpen(false)}>
            <div className="flex-1"/>
            <div className={`bg-white rounded-t-3xl flex flex-col overflow-hidden ${slideUp}`} style={{height:"75vh"}} onClick={e=>e.stopPropagation()}>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 shrink-0" style={{background:`linear-gradient(135deg,${appearance.accentColor},${appearance.accentColor}bb)`}}>
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-base">💬</div>
                <div className="flex-1"><p className="text-sm font-black text-white">グループチャット</p><p className="text-[10px] text-white/70">{members.length}人のメンバー</p></div>
                <button onClick={()=>setGroupOpen(false)} className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center"><X size={14} className="text-white"/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-gray-50">
                {groupMessages.length===0&&<div className="text-center py-8"><p className="text-sm text-gray-400">まだメッセージはありません</p><p className="text-xs text-gray-400 mt-1">@で始めてメンバーをメンション</p></div>}
                {groupMessages.map((m,i)=>{
                  const isMe=m.sender_email===currentUserEmail;
                  return (
                    <div key={i} className={`flex gap-2 ${isMe?"flex-row-reverse":""}`}>
                      <div className="w-6 h-6 rounded-lg bg-gray-200 flex items-center justify-center shrink-0 text-xs font-bold text-gray-600">{(m.sender_name||"?").charAt(0).toUpperCase()}</div>
                      <div>
                        {!isMe&&<p className="text-[10px] text-gray-400 mb-0.5 ml-1">{m.sender_name}</p>}
                        <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${isMe?"rounded-tr-sm":"bg-white border border-gray-100 shadow-sm rounded-tl-sm"}`}
                          style={isMe?{background:appearance.accentColor,color:"#ffffff"}:{color:"#1f2937"}}>
                          {m.content}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {mentionTarget&&(
                <div className="px-4 py-2 bg-blue-50 border-t border-blue-100 flex items-center gap-2">
                  <AtSign size={12} className="text-blue-500"/><span className="text-xs font-bold text-blue-700">@{mentionTarget.display_name||mentionTarget.email}</span>
                  <button onClick={()=>setMentionTarget(null)}><X size={12} className="text-blue-400"/></button>
                </div>
              )}
              <div className="p-3 bg-white border-t border-gray-100 flex gap-2 shrink-0">
                {perms.manageMembers&&(
                  <button onClick={()=>{
                    const m=members.filter(x=>x.email!==currentUserEmail);
                    if(m.length===0)return;
                    setMentionTarget(m[0]);
                    setGroupInput(`@${m[0].display_name||m[0].email} `);
                  }} className="w-9 h-9 rounded-xl flex items-center justify-center bg-purple-50 text-purple-600 shrink-0 hover:bg-purple-100 transition-all">
                    <AtSign size={14}/>
                  </button>
                )}
                <textarea value={groupInput} onChange={e=>setGroupInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();sendGroupMessage(mentionTarget??undefined);}}} placeholder="全員へメッセージ... (Enterで送信 / Shift+Enterで改行)" rows={1} className="flex-1 bg-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:bg-white transition resize-none" style={{maxHeight:"80px",overflowY:"auto"}}/>
                <button onClick={()=>sendGroupMessage(mentionTarget??undefined)} disabled={!groupInput.trim()} className="w-9 h-9 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-all active:scale-95" style={{background:appearance.accentColor}}><Send size={14}/></button>
              </div>
            </div>
          </div>
        )}
      </div>
    );

    if(activeTab==="discord") {
      // チャンネルをカテゴリ別にグループ化
      const categories = discordChannels.filter(c=>c.type===4).sort((a,b)=>a.position-b.position);
      const textChannels = discordChannels.filter(c=>c.type===0||c.type===5);
      const getChannelsByCategory = (catId: string|null) =>
        textChannels.filter(c=>c.parent_id===catId).sort((a,b)=>a.position-b.position);
      const uncategorized = getChannelsByCategory(null);

      const fmtTime = (ts: string) => {
        const d = new Date(ts);
        return `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
      };
      const isAeroSyncMsg = (m: DiscordMessage) => m.content.startsWith("**[AeroSync]");

      if (!discordBotToken || !discordGuildId) {
        return (
          <div className={`${fadeIn} flex flex-col items-center justify-center h-full py-20 px-6 text-center gap-4`}>
            <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center">
              <DiscordIcon size={32}/>
            </div>
            <h2 className="font-black text-gray-800 text-lg">Discord連携</h2>
            <p className="text-sm text-gray-500 max-w-xs">設定 → 通知 から Bot Token と Guild ID を入力すると、Discordのチャンネルが一覧表示されます。</p>
            <button onClick={()=>{setActiveTab("settings");setSettingsTab("notifications");}}
              className="px-6 py-3 rounded-2xl font-bold text-white text-sm shadow-lg"
              style={{background:appearance.accentColor}}>
              設定を開く
            </button>
          </div>
        );
      }

      return (
        <div className={`${fadeIn} flex h-full`} style={{height:"calc(100vh - 140px)"}}>
          {/* ── サイドバー: チャンネル一覧 ── */}
          <div className="w-[200px] shrink-0 bg-gray-900 flex flex-col overflow-hidden" style={{borderRight:"1px solid rgba(255,255,255,0.06)"}}>
            <div className="px-3 pt-4 pb-2 flex items-center justify-between">
              <p className="text-xs font-black text-white/80 truncate">サーバー</p>
              <button onClick={fetchDiscordChannels} disabled={discordChannelsLoading}
                className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                <RefreshCw size={10} className={`text-white/70 ${discordChannelsLoading?"animate-spin":""}`}/>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {discordChannelsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={18} className="text-white/40 animate-spin"/>
                </div>
              ) : discordChannels.length === 0 ? (
                <div className="px-3 py-4 text-center">
                  <p className="text-xs text-white/30">チャンネルなし</p>
                  <button onClick={fetchDiscordChannels} className="mt-2 text-[10px] text-indigo-400 hover:text-indigo-300">再取得</button>
                </div>
              ) : (
                <>
                  {/* カテゴリなしチャンネル */}
                  {uncategorized.map(ch=>(
                    <button key={ch.id} onClick={()=>selectDiscordChannel(ch)}
                      className={`w-full flex items-center gap-1.5 px-2 py-1.5 mx-1 rounded-lg text-left transition-all ${activeDiscordChannel?.id===ch.id?"bg-white/20 text-white":"text-white/40 hover:text-white/70 hover:bg-white/10"}`}
                      style={{width:"calc(100% - 8px)"}}>
                      <Hash size={13} className="shrink-0"/>
                      <span className="text-xs font-medium truncate">{ch.name}</span>
                    </button>
                  ))}
                  {/* カテゴリ別チャンネル */}
                  {categories.map(cat=>{
                    const chs = getChannelsByCategory(cat.id);
                    if(chs.length===0) return null;
                    return (
                      <div key={cat.id} className="mt-2">
                        <p className="px-2 py-1 text-[10px] font-black text-white/30 uppercase tracking-wider truncate">{cat.name}</p>
                        {chs.map(ch=>(
                          <button key={ch.id} onClick={()=>selectDiscordChannel(ch)}
                            className={`w-full flex items-center gap-1.5 px-2 py-1.5 mx-1 rounded-lg text-left transition-all ${activeDiscordChannel?.id===ch.id?"bg-white/20 text-white":"text-white/40 hover:text-white/70 hover:bg-white/10"}`}
                            style={{width:"calc(100% - 8px)"}}>
                            <Hash size={13} className="shrink-0"/>
                            <span className="text-xs font-medium truncate">{ch.name}</span>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          {/* ── メインエリア: メッセージ表示 ── */}
          <div className="flex-1 flex flex-col overflow-hidden bg-gray-800">
            {!activeDiscordChannel ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 px-6">
                <Hash size={40} className="text-white/20"/>
                <p className="text-white/40 text-sm font-bold">チャンネルを選択してください</p>
                <p className="text-white/20 text-xs">左側のリストからテキストチャンネルを選ぶと<br/>メッセージが表示されます</p>
              </div>
            ) : (
              <>
                {/* チャンネルヘッダー */}
                <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2 shrink-0 bg-gray-800/80 backdrop-blur-md">
                  <Hash size={16} className="text-white/60"/>
                  <p className="font-black text-white text-sm">{activeDiscordChannel.name}</p>
                  {activeDiscordChannel.topic && <p className="text-white/30 text-xs ml-1 truncate">— {activeDiscordChannel.topic}</p>}
                  <button onClick={()=>fetchDiscordMessages(activeDiscordChannel.id)}
                    className="ml-auto w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                    <RefreshCw size={12} className="text-white/60"/>
                  </button>
                </div>

                {/* メッセージリスト */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                  {discordMessagesLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 size={22} className="text-white/40 animate-spin"/>
                    </div>
                  ) : discordMessages.length===0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2">
                      <MessageCircle size={32} className="text-white/20"/>
                      <p className="text-white/30 text-sm">メッセージがありません</p>
                    </div>
                  ) : (
                    discordMessages.map(msg=>{
                      const isOwn = isAeroSyncMsg(msg);
                      const avatarUrl = msg.author.avatar
                        ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png?size=40`
                        : null;
                      return (
                        <div key={msg.id} className={`flex gap-2.5 group ${isOwn?"opacity-90":""}`}>
                          {/* アバター */}
                          <div className="w-8 h-8 rounded-full shrink-0 overflow-hidden bg-indigo-600 flex items-center justify-center mt-0.5">
                            {avatarUrl
                              ? <img src={avatarUrl} alt={msg.author.username} className="w-full h-full object-cover"/>
                              : <span className="text-white text-xs font-bold">{msg.author.username.charAt(0).toUpperCase()}</span>
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className={`text-xs font-black ${isOwn?"text-indigo-300":"text-white/80"}`}>
                                {isOwn?"[AeroSync]":msg.author.username}
                              </span>
                              <span className="text-[10px] text-white/20">{fmtTime(msg.timestamp)}</span>
                            </div>
                            <p className="text-sm text-white/70 leading-relaxed break-words">{msg.content}</p>
                            {msg.embeds && msg.embeds.length>0 && msg.embeds[0].title && (
                              <div className="mt-1 bg-white/10 rounded-lg px-3 py-2 border-l-2 border-indigo-400">
                                <p className="text-xs font-bold text-white/80">{msg.embeds[0].title}</p>
                                {msg.embeds[0].description&&<p className="text-xs text-white/50 mt-0.5 whitespace-pre-wrap">{msg.embeds[0].description}</p>}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={discordMsgEndRef}/>
                </div>

                {/* 入力エリア */}
                <div className="p-3 bg-gray-800 border-t border-white/10 shrink-0">
                  <div className="flex gap-2 bg-gray-700 rounded-xl px-3 py-2 items-end">
                    <input
                      value={discordChatInput}
                      onChange={e=>setDiscordChatInput(e.target.value)}
                      onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();sendDiscordMessage();}}}
                      placeholder={`#${activeDiscordChannel.name} にメッセージを送信`}
                      className="flex-1 bg-transparent text-white text-sm placeholder-white/30 focus:outline-none resize-none"
                    />
                    <button onClick={sendDiscordMessage} disabled={!discordChatInput.trim()||discordChatSending}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0"
                      style={{background:discordChatInput.trim()&&!discordChatSending?appearance.accentColor:"rgba(255,255,255,0.1)"}}>
                      {discordChatSending
                        ? <Loader2 size={14} className="text-white animate-spin"/>
                        : <Send size={14} className={discordChatInput.trim()?"text-white":"text-white/30"}/>
                      }
                    </button>
                  </div>
                  <p className="text-[10px] text-white/20 mt-1 pl-1">AeroSyncユーザー「{displayName}」として送信されます</p>
                </div>
              </>
            )}
          </div>
        </div>
      );
    }

    if(activeTab==="settings") {
      const SETTINGS_TABS: {id:SettingsTab; label:string; icon:React.ReactNode}[] = [
        {id:"profile",label:"プロフィール",icon:<User size={14}/>},
        {id:"roles",label:"ロール",icon:<Shield size={14}/>},
        {id:"appearance",label:"外観",icon:<Palette size={14}/>},
        {id:"notifications",label:"通知",icon:<Bell size={14}/>},
        {id:"privacy",label:"プライバシー",icon:<EyeIcon size={14}/>},
        {id:"data",label:"データ",icon:<Download size={14}/>},
        {id:"budget",label:"予算",icon:<span className="text-sm">💰</span>},
        {id:"about",label:"アプリ情報",icon:<HelpCircle size={14}/>},
      ];

      return (
        <div className={`${fadeIn}`}>
          <div className="flex gap-1.5 overflow-x-auto px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
            {SETTINGS_TABS.map(t=>(
              <button key={t.id} onClick={()=>setSettingsTab(t.id)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${settingsTab===t.id?"text-white shadow-sm":"text-gray-500 hover:bg-gray-100"}`}
                style={settingsTab===t.id?{background:appearance.accentColor}:{}}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          <div className="p-4 space-y-4 pb-10">
            {settingsTab==="profile"&&(
              <>
                <div className="rounded-2xl p-5 flex items-center gap-4" style={{background:`linear-gradient(135deg, ${appearance.accentColor}, ${appearance.accentColor}dd)`}}>
                  {userProfile?.avatar_url
                    ?<img src={userProfile.avatar_url} alt="Avatar" className="w-16 h-16 rounded-2xl ring-2 ring-white/30"/>
                    :<div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center font-black text-white text-2xl">{displayName.charAt(0).toUpperCase()}</div>}
                  <div className="flex-1 min-w-0">
                    <VisualEffectWrapper effect={myVisualEffect}>
                      <p className="font-black text-white text-lg truncate">{displayName}</p>
                    </VisualEffectWrapper>
                    <p className="text-white/70 text-xs truncate">{session.user?.email}</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className="text-lg">{myRoleData?.icon}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{background:"rgba(255,255,255,0.2)",color:"white"}}>{myRoleData?.name}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
                  <SectionHeader title="ユーザー名"/>
                  <div className="p-4 space-y-3">
                    <p className="text-xs text-gray-500">現在：<span className="font-bold text-gray-700">{displayName}</span></p>
                    <div className="flex gap-2">
                      <input
                        value={displayNameEdit}
                        onChange={e=>setDisplayNameEdit(e.target.value)}
                        onKeyDown={e=>{if(e.key==="Enter")saveDisplayName();}}
                        placeholder="新しいユーザー名"
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/>
                      <button
                        onClick={saveDisplayName}
                        disabled={displayNameSaving||!displayNameEdit.trim()}
                        className="flex items-center gap-1 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                        style={{background:appearance.accentColor}}>
                        {displayNameSaving?<Loader2 size={12} className="animate-spin"/>:<Save size={12}/>} 保存
                      </button>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
                  <SectionHeader title="ビジュアルエフェクト"/>
                  <div className="p-4">
                    <p className="text-xs text-gray-500 mb-3">自分の名前に表示されるエフェクトを選択</p>
                    <div className="grid grid-cols-2 gap-2">
                      {VISUAL_EFFECTS.map(ef=>(
                        <button key={ef.id} onClick={async ()=>{
                          setMyVisualEffect(ef.id);
                          try {
                            const sb = createClient();
                            const { data: { user } } = await sb.auth.getUser();
                            if(user) await sb.from("members").update({ visual_effect: ef.id }).eq("id", user.id);
                          } catch(e) { console.error("effect sync error", e); }
                        }}
                          className={`py-2.5 px-3 rounded-xl text-xs font-bold border-2 text-left transition-all ${myVisualEffect===ef.id?"border-blue-500 bg-blue-50 text-blue-700":"border-gray-200 text-gray-600"}`}>
                          {ef.id==="none"?"🚫 なし":ef.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
                  <SectionHeader title="AI設定"/>
                  <div className="p-4 space-y-3">
                    <p className="text-xs text-gray-500">Gemini APIキーを設定するとAI機能が使えます（<a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-blue-500 underline">Google AI Studio</a>で取得）</p>
                    <div className="relative">
                      <input type="password" placeholder="AIzaSy..." value={geminiApiKey} onChange={e=>setGeminiApiKey(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 pr-20"/>
                      {geminiApiKey && <button onClick={()=>setGeminiApiKey("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-red-400 font-bold">削除</button>}
                    </div>
                    <p className="text-[10px] text-gray-400">※ APIキーはこのデバイスのみに保存されます</p>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
                  <SectionHeader title="アクティビティ"/>
                  <div className="grid grid-cols-3 gap-0 divide-x divide-gray-100">
                    {[{v:tasks.length,l:"タスク"},{v:completedTasks,l:"完了"},{v:wikis.length,l:"Wiki"}].map(s=>(
                      <div key={s.l} className="p-4 text-center"><p className="text-2xl font-black text-gray-900">{s.v}</p><p className="text-[10px] text-gray-400 mt-0.5">{s.l}</p></div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {settingsTab==="roles"&&(
              <>
                <div className="space-y-2">
                  {roles.map(role=>(
                    <div key={role.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="flex items-center gap-3 p-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{background:role.color+"22"}}>{role.icon}</div>
                        <div className="flex-1 min-w-0">
                          <VisualEffectWrapper effect={role.visualEffect}>
                            <span className="font-bold text-sm" style={{color:role.color}}>{role.name}</span>
                          </VisualEffectWrapper>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {Object.entries(role.permissions).filter(([,v])=>v).map(([k])=>({manageTasks:"タスク",manageInventory:"在庫",manageWiki:"Wiki",manageMembers:"メンバー",manageRoles:"ロール",viewStats:"統計",exportData:"出力"}[k]||k)).join(" · ")||"権限なし"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-gray-400">{memberRoles.filter(m=>m.roleId===role.id).length}人</span>
                          {(canManageRoles||role.id===myRoleData?.id)&&(
                            <button onClick={()=>setEditingRole(role)} className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors"><Edit2 size={12} className="text-gray-500"/></button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {canManageRoles&&(
                  <button onClick={()=>setShowNewRoleForm(true)} className="w-full border-2 border-dashed border-gray-200 rounded-2xl py-3 flex items-center justify-center gap-2 text-sm font-bold text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-all">
                    <Plus size={16}/> 新しいロールを作成
                  </button>
                )}
                {canManageRoles&&(
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mt-4">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-800">チーム管理</p>
                        <p className="text-xs text-gray-500 mt-0.5">チームを作成してメンバーをグループ化</p>
                      </div>
                      <button onClick={()=>setShowTeamForm(true)} className="text-xs font-bold px-2.5 py-1.5 rounded-xl text-white" style={{background:appearance.accentColor}}><Plus size={12} className="inline mr-1"/>作成</button>
                    </div>
                    {teams.length > 0 && (
                      <div className="p-4 flex flex-wrap gap-2">
                        {teams.map(t=>(
                          <div key={t.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-bold" style={{borderColor:t.color,background:t.color+"11",color:t.color}}>
                            <span>{t.icon}</span><span>{t.name}</span>
                            <button onClick={()=>setTeams(p=>p.filter(x=>x.id!==t.id))} className="ml-1 opacity-60 hover:opacity-100"><X size={10}/></button>
                          </div>
                        ))}
                      </div>
                    )}
                    {teams.length === 0 && <p className="text-xs text-gray-400 px-4 py-3">チームがありません</p>}
                  </div>
                )}
                {showTeamForm && (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={()=>setShowTeamForm(false)}>
                    <div className={`bg-white w-full rounded-t-3xl p-6 space-y-4 ${slideUp}`} onClick={e=>e.stopPropagation()}>
                      <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto"/>
                      <h3 className="font-black text-gray-900">チームを作成</h3>
                      <input placeholder="チーム名 *" value={newTeam.name} onChange={e=>setNewTeam(p=>({...p,name:e.target.value}))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/>
                      <input placeholder="説明" value={newTeam.description} onChange={e=>setNewTeam(p=>({...p,description:e.target.value}))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/>
                      <div><p className="text-xs font-bold text-gray-500 mb-2">カラー</p><div className="flex gap-2 flex-wrap">{ROLE_COLORS.map(c=><button key={c} onClick={()=>setNewTeam(p=>({...p,color:c}))} style={{background:c}} className={`w-8 h-8 rounded-full transition-all ${newTeam.color===c?"scale-125 ring-2 ring-offset-1 ring-gray-400":""}`}/>)}</div></div>
                      <div><p className="text-xs font-bold text-gray-500 mb-2">アイコン</p><div className="flex flex-wrap gap-2">{["👥","🎬","🎵","💡","🎨","⚡","🛠️","📸","🎙️","🎭"].map(ic=><button key={ic} onClick={()=>setNewTeam(p=>({...p,icon:ic}))} className={`w-9 h-9 rounded-xl text-xl flex items-center justify-center transition-all ${newTeam.icon===ic?"bg-blue-100 ring-2 ring-blue-400":"bg-gray-100"}`}>{ic}</button>)}</div></div>
                      <button onClick={()=>{if(!newTeam.name.trim())return;setTeams(p=>[...p,{id:Date.now().toString(),...newTeam}]);setNewTeam({name:"",color:"#3b82f6",icon:"👥",description:""});setShowTeamForm(false);}} className="w-full text-white font-bold py-3 rounded-2xl text-sm" style={{background:appearance.accentColor}}>作成</button>
                    </div>
                  </div>
                )}
                {canManageRoles&&(
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-bold text-gray-800">メンバーにロールを割り当て</p>
                      <p className="text-xs text-gray-500 mt-0.5">メールアドレスとロールを指定</p>
                    </div>
                    <div className="p-4 space-y-3">
                      <input placeholder="メールアドレス" value={assignEmail} onChange={e=>setAssignEmail(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/>
                      <select value={assignRoleId} onChange={e=>setAssignRoleId(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
                        <option value="">ロールを選択</option>
                        {roles.map(r=><option key={r.id} value={r.id}>{r.icon} {r.name}</option>)}
                      </select>
                      <button onClick={async()=>{
                        if(!assignEmail.trim()||!assignRoleId)return;
                        const targetEmail = assignEmail.trim();

                        const existingMember = members.find(m => m.email === targetEmail);
                        if (existingMember) {
                          try {
                            const sb = createClient();
                            const { data, error } = await sb.from("members").update({ role_id: assignRoleId }).eq("id", existingMember.id).select();
                            if(error) { alert(`エラー: ${error.message}`); return; }
                            if(!data || data.length===0) { alert("データベースの更新がブロックされました。RLSポリシーを確認してください。"); return; }
                          } catch (e) {
                            console.error("Assign role db error:", e);
                            return;
                          }
                        }

                        setMemberRoles(p=>[...p.filter(m=>m.email!==targetEmail),{email:targetEmail,roleId:assignRoleId,assignedAt:new Date().toISOString().split("T")[0],assignedBy:currentUserEmail}]);
                        setAssignEmail("");
                        setAssignRoleId("");
                        alert("割り当てました");
                      }} className="w-full text-white font-bold py-2.5 rounded-xl text-sm transition-all" style={{background:appearance.accentColor}}>割り当て</button>
                    </div>
                    {memberRoles.length>0&&(
                      <div className="border-t border-gray-100 p-4 space-y-2">
                        <p className="text-xs font-bold text-gray-500 mb-2">割り当て済み</p>
                        {memberRoles.map(m=>{
                          const r=roles.find(x=>x.id===m.roleId);
                          return (
                            <div key={m.email} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-base">{r?.icon}</span>
                                <div><p className="text-xs font-bold text-gray-800 truncate max-w-[160px]">{m.email}</p><p className="text-[10px] text-gray-400">{r?.name}</p></div>
                              </div>
                              <button onClick={async()=>{
                                const existingMember = members.find(x => x.email === m.email);
                                if (existingMember) {
                                  try {
                                    const sb = createClient();
                                    const { data, error } = await sb.from("members").update({ role_id: "member" }).eq("id", existingMember.id).select();
                                    if(error || !data || data.length===0) { alert("権限の解除に失敗しました。"); return; }
                                  } catch (e) { console.error(e); return; }
                                }
                                setMemberRoles(p=>p.filter(x=>x.email!==m.email));
                              }} className="text-gray-300 hover:text-red-400 transition-colors p-1"><X size={13}/></button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {settingsTab==="appearance"&&(
              <>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
                  <SectionHeader title="テーマ"/>
                  <div className="p-4">
                    <div className="flex gap-2">
                      {([{id:"system",label:"自動",icon:<RefreshCw size={14}/>},{id:"light",label:"ライト",icon:<Sun size={14}/>},{id:"dark",label:"ダーク",icon:<Moon size={14}/>}] as const).map(t=>(
                        <button key={t.id} onClick={()=>setAppearance(p=>({...p,theme:t.id}))}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${appearance.theme===t.id?"border-blue-500 bg-blue-50 text-blue-700":"border-gray-200 text-gray-500"}`}>
                          {t.icon}{t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
                  <SectionHeader title="アクセントカラー"/>
                  <div className="p-4">
                    <div className="flex gap-3 flex-wrap">
                      {ACCENT_COLORS.map(c=>(
                        <button key={c} onClick={()=>setAppearance(p=>({...p,accentColor:c}))} style={{background:c}}
                          className={`w-9 h-9 rounded-full transition-all ${appearance.accentColor===c?"scale-125 ring-2 ring-offset-2 ring-gray-400":""}`}/>
                      ))}
                      <input type="color" value={appearance.accentColor} onChange={e=>setAppearance(p=>({...p,accentColor:e.target.value}))} className="w-9 h-9 rounded-full cursor-pointer border-0 p-0"/>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
                  <SectionHeader title="文字サイズ"/>
                  <div className="p-4"><div className="flex gap-2">{([{id:"sm",label:"小"},{id:"md",label:"中"},{id:"lg",label:"大"}] as const).map(t=><button key={t.id} onClick={()=>setAppearance(p=>({...p,fontSize:t.id}))} className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${appearance.fontSize===t.id?"border-blue-500 bg-blue-50 text-blue-700":"border-gray-200 text-gray-500"}`}>{t.label}</button>)}</div></div>
                  <SettingsRow icon={<Wand2 size={15} className="text-purple-600"/>} iconBg="bg-purple-100" title="モーション削減" subtitle="アニメーションを減らす" right={<Toggle checked={appearance.reduceMotion} onChange={v=>setAppearance(p=>({...p,reduceMotion:v}))} activeColor={appearance.accentColor}/>}/>
                  <SettingsRow icon={<Globe size={15} className="text-blue-600"/>} iconBg="bg-blue-100" title="コンパクトモード" subtitle="より多くの情報を表示" right={<Toggle checked={appearance.compactMode} onChange={v=>setAppearance(p=>({...p,compactMode:v}))} activeColor={appearance.accentColor}/>}/>
                </div>
              </>
            )}

            {settingsTab==="notifications"&&(
              <>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
                  <SectionHeader title="通知設定"/>
                  <SettingsRow icon={notifEnabled?<Bell size={15} className="text-blue-600"/>:<BellOff size={15} className="text-gray-400"/>} iconBg={notifEnabled?"bg-blue-100":"bg-gray-100"} title="プッシュ通知" subtitle={notifEnabled?"通知が有効です":"タップして有効化"} right={<Toggle checked={notifEnabled} onChange={async()=>toggleNotif()} activeColor={appearance.accentColor}/>}/>
                  <SettingsRow icon={<Volume2 size={15} className={soundEnabled?"text-green-600":"text-gray-400"}/>} iconBg={soundEnabled?"bg-green-100":"bg-gray-100"} title="サウンド" subtitle="通知音を再生" right={<Toggle checked={soundEnabled} onChange={setSoundEnabled} activeColor={appearance.accentColor}/>}/>
                  <SettingsRow icon={<Vibrate size={15} className={hapticsEnabled?"text-orange-600":"text-gray-400"}/>} iconBg={hapticsEnabled?"bg-orange-100":"bg-gray-100"} title="バイブレーション" subtitle="触覚フィードバック" right={<Toggle checked={hapticsEnabled} onChange={setHapticsEnabled} activeColor={appearance.accentColor}/>}/>
                  <SettingsRow icon={<Smartphone size={15} className="text-indigo-600"/>} iconBg="bg-indigo-100" title="アプリをインストール" subtitle="ホーム画面に追加してネイティブ体験"/>
                </div>

                {/* ── Discord 集積設定（共有） ── */}
                <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden divide-y divide-indigo-50">
                  <div className="px-4 py-3 bg-indigo-50 flex items-center gap-2">
                    <DiscordIcon/>
                    <div className="flex-1">
                      <p className="text-sm font-black text-indigo-800">Discord 設定</p>
                      <p className="text-xs text-indigo-500">管理者が設定するとメンバー全員に適用されます</p>
                    </div>
                    {/* 管理者バッジ */}
                    {canManageRoles
                      ? <span className="text-[10px] font-black text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">管理者</span>
                      : <span className="text-[10px] font-black text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">閲覧のみ</span>
                    }
                  </div>

                  {canManageRoles ? (
                    /* ── 管理者: 編集可能フォーム ── */
                    <div className="p-4 space-y-4">
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1.5">Bot Token <span className="text-red-400">*</span></label>
                        <div className="relative">
                          <input
                            type="password"
                            placeholder="Bot Token を入力..."
                            value={discordBotToken}
                            onChange={e=>setDiscordBotToken(e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 pr-16"
                          />
                          {discordBotToken && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-green-500 flex items-center gap-0.5"><Check size={10}/> 設定済み</span>}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">Discord Developer Portal → Bot → Token をコピー</p>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1.5">Guild ID（サーバーID） <span className="text-red-400">*</span></label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="サーバーIDを入力 (例: 1234567890)"
                            value={discordGuildId}
                            onChange={e=>setDiscordGuildId(e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 pr-16"
                          />
                          {discordGuildId && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-green-500 flex items-center gap-0.5"><Check size={10}/> 設定済み</span>}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">サーバー右クリック → IDをコピー（開発者モード必要）</p>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1.5">投票チャンネル ID</label>
                        <input
                          type="text"
                          placeholder="チャンネルIDを入力 (例: 1234567890)"
                          value={discordPollChannelId}
                          onChange={e=>setDiscordPollChannelId(e.target.value)}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">チャンネル右クリック → IDをコピー（開発者モード必要）</p>
                      </div>
                      <div className="bg-green-50 rounded-xl p-3">
                        <p className="text-[11px] text-green-700 font-bold">🌐 全メンバーに共有</p>
                        <p className="text-[10px] text-green-600 mt-0.5">「保存して全員に適用」を押すと、Supabaseに保存されログイン中の全メンバーに自動反映されます。</p>
                      </div>
                      <div className="flex gap-2">
                        {discordBotToken && discordGuildId && (
                          <button
                            onClick={async()=>{
                              try {
                                const res = await fetch(`/api/discord/channels?guildId=${discordGuildId}`, { headers: { "x-bot-token": discordBotToken } });
                                const d = await res.json();
                                if(d.channels) alert(`接続成功 ✅\nチャンネル数: ${d.channels.length}個`);
                                else alert(`接続失敗 ❌\n${JSON.stringify(d.error)}`);
                              } catch(e:any) { alert(`エラー: ${e.message}`); }
                            }}
                            className="flex-1 border border-indigo-200 text-indigo-700 font-bold py-2.5 rounded-xl text-sm hover:bg-indigo-50 transition-colors flex items-center justify-center gap-1.5">
                            <Check size={13}/> 接続テスト
                          </button>
                        )}
                        <button
                          onClick={saveDiscordSettings}
                          disabled={discordSettingsSaving}
                          className="flex-1 font-bold py-2.5 rounded-xl text-sm text-white flex items-center justify-center gap-1.5 shadow-sm transition-all"
                          style={{background:appearance.accentColor}}>
                          {discordSettingsSaving ? <Loader2 size={13} className="animate-spin"/> : <Save size={13}/>}
                          保存して全員に適用
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── 一般メンバー: 読み取り専用表示 ── */
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-3 py-1">
                        <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0"><DiscordIcon/></div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-gray-700">Bot Token</p>
                          <p className="text-xs text-gray-400">{discordBotToken ? "●●●●●●●●●●●● (設定済み)" : "未設定"}</p>
                        </div>
                        {discordBotToken && <span className="text-[10px] font-bold text-green-500 flex items-center gap-0.5"><Check size={10}/> OK</span>}
                      </div>
                      <div className="flex items-center gap-3 py-1">
                        <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0"><Hash size={14} className="text-indigo-500"/></div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-gray-700">Guild ID</p>
                          <p className="text-xs text-gray-400">{discordGuildId || "未設定"}</p>
                        </div>
                        {discordGuildId && <span className="text-[10px] font-bold text-green-500 flex items-center gap-0.5"><Check size={10}/> OK</span>}
                      </div>
                      <div className="bg-indigo-50 rounded-xl p-3">
                        <p className="text-[11px] text-indigo-600">設定の変更は管理者・オーナーのみ行えます。<br/>設定が完了すると自動的に反映されます。</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {settingsTab==="privacy"&&(
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
                <SectionHeader title="プライバシー設定"/>
                <SettingsRow icon={<EyeOffIcon size={15} className="text-gray-600"/>} iconBg="bg-gray-100" title="プライベートモード" subtitle="他のメンバーからプロフィールを隠す" right={<Toggle checked={privateMode} onChange={setPrivateMode} activeColor={appearance.accentColor}/>}/>
                <SettingsRow icon={<Users size={15} className="text-blue-600"/>} iconBg="bg-blue-100" title="オンラインステータスを表示" subtitle="他のメンバーにオンライン状態を表示" right={<Toggle checked={showOnlineStatus} onChange={setShowOnlineStatus} activeColor={appearance.accentColor}/>}/>
                <SettingsRow icon={<Star size={15} className="text-yellow-600"/>} iconBg="bg-yellow-100" title="参加状況を公開" subtitle="スケジュールの参加状況を全員に表示" right={<Toggle checked={true} onChange={()=>{}} activeColor={appearance.accentColor}/>}/>
              </div>
            )}

            {settingsTab==="data"&&(
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
                <SectionHeader title="データ管理"/>
                <SettingsRow icon={<Download size={15} className="text-blue-600"/>} iconBg="bg-blue-100" title="データをエクスポート" subtitle="JSON形式でダウンロード" onClick={()=>{
                  const data=JSON.stringify({tasks,inventory,wikis,roles,memberRoles},null,2);
                  const a=document.createElement("a"); a.href="data:text/json;charset=utf-8,"+encodeURIComponent(data); a.download="aerosync-export.json"; a.click();
                }}/>
                <SettingsRow icon={<Upload size={15} className="text-green-600"/>} iconBg="bg-green-100" title="データをインポート" subtitle="JSONファイルから復元" onClick={()=>importDataRef.current?.click()}/>
                <input ref={importDataRef} type="file" accept=".json" className="hidden" onChange={e=>{
                  const f=e.target.files?.[0];if(!f)return;
                  const r=new FileReader();
                  r.onload=()=>{
                    try {
                      const d=JSON.parse(r.result as string);
                      if(d.tasks&&Array.isArray(d.tasks)) setTasks(d.tasks);
                      if(d.inventory&&Array.isArray(d.inventory)) setInventory(d.inventory);
                      if(d.wikis&&Array.isArray(d.wikis)) setWikis(d.wikis);
                      if(d.roles&&Array.isArray(d.roles)) setRoles(d.roles);
                      if(d.memberRoles&&Array.isArray(d.memberRoles)) setMemberRoles(d.memberRoles);
                      alert('インポートが完了しました');
                    } catch {
                      alert('JSONファイルの解析に失敗しました');
                    }
                  };
                  r.readAsText(f);
                  e.target.value="";
                }}/>
                <SettingsRow icon={<Copy size={15} className="text-purple-600"/>} iconBg="bg-purple-100" title="データをコピー" subtitle="クリップボードにコピー" onClick={()=>{navigator.clipboard.writeText(JSON.stringify({tasks,inventory,wikis},null,2)).catch(()=>{});}}/>
                {perms.manageTasks&&<SettingsRow icon={<Trash2 size={15} className="text-red-500"/>} iconBg="bg-red-100" title="全データをリセット" subtitle="削除されたデータは復元できません" danger onClick={()=>{if(confirm("全データをリセットしますか？")){setTasks([]);setInventory([]);setWikis([]);}}}/>}
              </div>
            )}

            {/* ⑤ 予算・費用管理 */}
            {settingsTab==="budget"&&(
              <>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <h3 className="text-sm font-black text-gray-900">費用を追加</h3>
                  </div>
                  <div className="p-4 space-y-3">
                    <input placeholder="タイトル *" value={newExpense.title} onChange={e=>setNewExpense(p=>({...p,title:e.target.value}))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/>
                    <input type="number" placeholder="金額 *" value={newExpense.amount} onChange={e=>setNewExpense(p=>({...p,amount:e.target.value}))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/>
                    <select value={newExpense.category} onChange={e=>setNewExpense(p=>({...p,category:e.target.value}))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-white">
                      {EXPENSE_CATS.map(c=><option key={c}>{c}</option>)}
                    </select>
                    <input type="date" value={newExpense.date} onChange={e=>setNewExpense(p=>({...p,date:e.target.value}))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/>
                    <input placeholder="メモ（任意）" value={newExpense.note} onChange={e=>setNewExpense(p=>({...p,note:e.target.value}))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/>
                    <button onClick={addExpense} className="w-full text-white font-bold py-3 rounded-2xl text-sm transition-all active:scale-[0.98]" style={{background:appearance.accentColor}}>追加</button>
                  </div>
                </div>
                {/* カテゴリ別バー */}
                {expenses.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-black text-gray-900">合計支出</h3>
                      <p className="text-2xl font-black text-gray-900">¥{expenses.reduce((s,e)=>s+e.amount,0).toLocaleString()}</p>
                    </div>
                    <div className="space-y-2">
                      {EXPENSE_CATS.map(cat=>{
                        const total = expenses.filter(e=>e.category===cat).reduce((s,e)=>s+e.amount,0);
                        if(total===0) return null;
                        const max = Math.max(...EXPENSE_CATS.map(c=>expenses.filter(e=>e.category===c).reduce((s,e)=>s+e.amount,0)));
                        return (
                          <div key={cat} className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 w-16 shrink-0">{cat}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                              <div className="h-full rounded-full" style={{width:`${(total/max)*100}%`,background:appearance.accentColor}}/>
                            </div>
                            <span className="text-xs font-bold text-gray-700 w-20 text-right">¥{total.toLocaleString()}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* 費用一覧 */}
                {expensesLoading ? (
                  <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-gray-300"/></div>
                ) : (
                  <div className="space-y-2">
                    {expenses.map(expense=>(
                      <div key={expense.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{expense.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Pill color={appearance.accentColor}>{expense.category}</Pill>
                            <span className="text-[10px] text-gray-400">{expense.date}</span>
                            {expense.note&&<span className="text-[10px] text-gray-400 truncate">{expense.note}</span>}
                          </div>
                        </div>
                        <p className="text-sm font-black text-gray-900 shrink-0">¥{expense.amount.toLocaleString()}</p>
                        {expense.created_by===currentUserId&&<button onClick={()=>deleteExpense(expense.id)} className="text-gray-300 hover:text-red-400 transition-colors p-1 shrink-0"><Trash2 size={13}/></button>}
                      </div>
                    ))}
                    {expenses.length===0&&<div className="text-center py-8 text-sm text-gray-400 bg-white rounded-2xl border border-gray-100">費用がありません</div>}
                  </div>
                )}
              </>
            )}

            {settingsTab==="about"&&(
              <>
                {/* ⑨ アクティビティログ */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-sm font-black text-gray-900 flex items-center gap-1.5">⚡ アクティビティ</h3>
                    <button onClick={loadActivityLogs} className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center"><RefreshCw size={12} className="text-gray-500"/></button>
                  </div>
                  {activityLogsLoading ? (
                    <div className="flex justify-center py-4"><Loader2 size={14} className="animate-spin text-gray-300"/></div>
                  ) : activityLogs.length===0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">アクティビティがありません</p>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {activityLogs.map(log=>{
                        const now = Date.now();
                        const created = new Date(log.created_at).getTime();
                        const diff = Math.floor((now - created) / 1000);
                        const relTime = diff < 60 ? "今" : diff < 3600 ? `${Math.floor(diff/60)}分前` : diff < 86400 ? `${Math.floor(diff/3600)}時間前` : `${Math.floor(diff/86400)}日前`;
                        const icon = log.action.includes("作成")?"➕":log.action.includes("完了")?"✅":log.action.includes("追加")?"📦":log.action.includes("入室")?"🚪":"⚡";
                        return (
                          <div key={log.id} className="flex items-center gap-3 px-4 py-2.5">
                            <span className="text-base shrink-0">{icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-gray-700 truncate">{log.user_name} · {log.action}</p>
                              {log.details?.title&&<p className="text-[10px] text-gray-400 truncate">「{log.details.title}」</p>}
                              {log.details?.name&&<p className="text-[10px] text-gray-400 truncate">「{log.details.name}」</p>}
                            </div>
                            <span className="text-[10px] text-gray-400 shrink-0">{relTime}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
                  <SectionHeader title="アプリ情報"/>
                  <SettingsRow icon={<Star size={15} className="text-yellow-500"/>} iconBg="bg-yellow-100" title="バージョン" subtitle="AeroSync v2.0.0"/>
                  <SettingsRow icon={<Globe size={15} className="text-blue-600"/>} iconBg="bg-blue-100" title="Webサイト" subtitle="aerosync.soarahpa.com" onClick={()=>window.open("https://aerosync.soarahpa.com")}/>
                  <SettingsRow icon={<HelpCircle size={15} className="text-purple-600"/>} iconBg="bg-purple-100" title="ヘルプ & サポート" subtitle="Wikiのガイドを参照" onClick={()=>{setActiveTab("wiki");const guide=wikis.find(w=>w.title.includes("ガイド"));if(guide)setActiveWiki(guide);}}/>
                  <SettingsRow icon={<RotateCcw size={15} className="text-orange-600"/>} iconBg="bg-orange-100" title="キャッシュをクリア" subtitle="サービスワーカーを更新" onClick={()=>{navigator.serviceWorker.getRegistrations().then(regs=>regs.forEach(r=>r.unregister())); window.location.reload();}}/>
                </div>
                <button onClick={handleLogout} className="w-full bg-white border border-gray-200 rounded-2xl py-3.5 flex items-center justify-center gap-2 text-red-500 font-bold text-sm hover:bg-red-50 transition-colors shadow-sm">
                  <LogOut size={16}/> ログアウト
                </button>
              </>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(40px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes scaleIn { from{opacity:0;transform:scale(0.85) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes floatPulse { 0%,100%{transform:scale(1) translateY(0);box-shadow:0 8px 32px rgba(37,99,235,0.4)} 50%{transform:scale(1.06) translateY(-2px);box-shadow:0 12px 40px rgba(37,99,235,0.55)} }
        @keyframes tooltipIn { from{opacity:0;transform:translateX(-50%) translateY(4px) scale(0.95)} to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)} }
        @keyframes ripple { from{transform:scale(0.8);opacity:1} to{transform:scale(2.2);opacity:0} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes taskGlow { 0%,100%{opacity:0.6} 50%{opacity:1} }
      `}</style>

      <ParticleEffect effect={myVisualEffect}/>

      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shadow-sm" style={{background:appearance.accentColor}}><span className="text-white text-[10px] font-black">AS</span></div>
          <h1 className="text-base font-black tracking-tight">Aero<span style={{color:appearance.accentColor}}>Sync</span></h1>
        </div>
        <div className="flex items-center gap-1.5">
          <VisualEffectWrapper effect={myRoleData?.visualEffect||"none"}>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{background:myRoleData?.color+"22",color:myRoleData?.color,border:`1px solid ${myRoleData?.color}44`}}>
              {myRoleData?.icon} {myRoleData?.name}
            </span>
          </VisualEffectWrapper>
          <button onClick={()=>setNotifOpen(true)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-all active:scale-90 relative">
            <BellRing size={18} className="text-gray-500"/>
            {unreadCount>0&&<span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full text-[9px] font-black text-white flex items-center justify-center" style={{background:appearance.accentColor}}>{unreadCount>9?"9+":unreadCount}</span>}
          </button>
          <button onClick={()=>setSearchOpen(true)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-all active:scale-90">
            <Search size={18} className="text-gray-500"/>
          </button>
        </div>
      </header>

      {updateAvailable&&(
        <div className="px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b z-40 relative" style={{background:appearance.accentColor,color:"white"}}>
          <RefreshCw size={13} className="shrink-0 animate-spin"/>
          <span className="flex-1">新しいバージョンが利用可能です</span>
          <button onClick={()=>window.location.reload()} className="bg-white rounded-lg px-2.5 py-1 font-black text-xs transition-all active:scale-95" style={{color:appearance.accentColor}}>今すぐ更新</button>
          <button onClick={()=>setUpdateAvailable(false)} className="opacity-70 hover:opacity-100"><X size={13}/></button>
        </div>
      )}

      {errorMessage&&(
        <div className="bg-red-50 text-red-700 px-4 py-2.5 text-xs font-medium flex items-start gap-2 border-b border-red-100">
          <ShieldAlert size={14} className="shrink-0 mt-0.5"/><span className="flex-1 break-all">{errorMessage}</span>
          <button onClick={()=>setErrorMessage(null)}><X size={14}/></button>
        </div>
      )}

      <main className="flex-1 overflow-y-auto pb-20 overscroll-none">{renderContent()}</main>

      <nav className="fixed bottom-0 w-full bg-white/90 backdrop-blur-md border-t border-gray-100 z-30" style={{paddingBottom:"env(safe-area-inset-bottom)"}}>
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
          {([
            {id:"home" as Tab, label:"ホーム", icon:(active:boolean)=><Home size={20} strokeWidth={active?2.5:1.8}/>},
            {id:"schedule" as Tab, label:"予定", icon:(active:boolean)=><Calendar size={20} strokeWidth={active?2.5:1.8}/>},
            {id:"inventory" as Tab, label:"在庫", icon:(active:boolean)=><Package size={20} strokeWidth={active?2.5:1.8}/>},
            {id:"members" as Tab, label:"メンバー", icon:(active:boolean)=><Users size={20} strokeWidth={active?2.5:1.8}/>},
            {id:"discord" as Tab, label:"Discord", icon:(_active:boolean)=><DiscordIcon size={20}/>},
            {id:"settings" as Tab, label:"設定", icon:(active:boolean)=><Settings size={20} strokeWidth={active?2.5:1.8}/>},
          ]).map(({id,label,icon})=>(
            <button key={id} onClick={()=>{setActiveTab(id);setActiveWiki(null);}} className="flex flex-col items-center justify-center w-full h-full gap-0.5 transition-all duration-200" style={{color:activeTab===id?appearance.accentColor:"#9ca3af"}}>
              <div className="p-1.5 rounded-xl transition-all duration-200" style={activeTab===id?{background:appearance.accentColor+"22"}:{}}>
                {icon(activeTab===id)}
              </div>
              <span className="text-[10px] font-bold">{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {!chatOpen&&(
        <button
          aria-label="AI"
          style={{
            bottom: aiIconPos.y,
            right: aiIconPos.x,
            animation: aiIconDragging.current ? "none" : "floatPulse 3s ease-in-out infinite",
            background: appearance.accentColor,
            touchAction: "none",
          }}
          className="fixed z-40 w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-shadow select-none cursor-grab active:cursor-grabbing"
          onPointerDown={e => {
            e.currentTarget.setPointerCapture(e.pointerId);
            aiIconDragging.current = true;
            aiIconDragOffset.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerMove={e => {
            if (!aiIconDragging.current) return;
            const dx = aiIconDragOffset.current.x - e.clientX;
            const dy = aiIconDragOffset.current.y - e.clientY;
            aiIconDragOffset.current = { x: e.clientX, y: e.clientY };
            setAiIconPos(p => ({
              x: Math.max(8, Math.min(window.innerWidth - 64, p.x + dx)),
              y: Math.max(8, Math.min(window.innerHeight - 64, p.y + dy)),
            }));
          }}
          onPointerUp={e => {
            const moved = Math.abs(e.clientX - aiIconDragOffset.current.x) + Math.abs(e.clientY - aiIconDragOffset.current.y);
            aiIconDragging.current = false;
            saveLS("as_ai_pos", aiIconPos);
            if (moved < 5) setChatOpen(true);
          }}
        >
          <div className="absolute inset-0 rounded-2xl opacity-30" style={{background:appearance.accentColor,animation:"ripple 2.5s ease-out infinite"}}/>
          <Sparkles size={22} className="text-white relative z-10"/>
        </button>
      )}

      {chatOpen&&(
        <div className="fixed inset-0 z-50 flex items-end justify-end pointer-events-none">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={()=>setChatOpen(false)}/>
          <div className="relative pointer-events-auto w-full max-w-sm mx-auto mb-0 sm:mb-6 sm:mr-6 bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-blue-100" style={{height:"72vh",maxHeight:"600px",animation:"scaleIn 0.3s cubic-bezier(0.34,1.56,0.64,1)"}}>
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 shrink-0" style={{background:`linear-gradient(135deg, ${appearance.accentColor}, ${appearance.accentColor}cc)`}}>
              <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center"><Sparkles size={16} className="text-white"/></div>
              <div className="flex-1"><p className="text-sm font-black text-white">AeroSync AI</p><p className="text-[10px] text-white/70">Gemini 2.5 Pro ✦ 検索対応</p></div>
              <button onClick={()=>setChatOpen(false)} className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center hover:bg-white/30 transition-colors"><X size={14} className="text-white"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
              {chatMessages.length===0&&(
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-6">
                  <p className="font-bold text-gray-700 text-sm">何でも聞いてください</p>
                  <p className="text-xs text-gray-400 max-w-[200px]">テキストを選択して「AIに聞く」も使えます</p>
                  <div className="space-y-2 w-full mt-2">
                    {["今日のタスクを教えて","在庫が少ないものは？","ロールの使い方は？"].map(q=>(
                      <button key={q} onClick={()=>setChatInput(q)} className="w-full text-xs bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-600 hover:border-blue-300 hover:bg-blue-50 transition-all text-left flex items-center gap-2 shadow-sm">
                        <MessageCircle size={12} className="shrink-0" style={{color:appearance.accentColor}}/>{q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {chatMessages.map((m,i)=>(
                <div key={i} className={`flex gap-2 ${m.role==="user"?"flex-row-reverse":""}`} style={{animation:"fadeIn 0.25s ease-out"}}>
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={m.role==="assistant"?{background:appearance.accentColor}:{background:"#e5e7eb"}}>
                    {m.role==="assistant"?<Bot size={12} className="text-white"/>:<span className="text-[10px] font-bold text-gray-600">{displayName.charAt(0).toUpperCase()}</span>}
                  </div>
                  <div className={`max-w-[82%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${m.role==="user"?"rounded-tr-sm":"bg-white border border-gray-100 shadow-sm rounded-tl-sm"}`} style={m.role==="user"?{background:appearance.accentColor,color:"#ffffff"}:{color:"#1f2937"}}>
                    {m.content}
                  </div>
                </div>
              ))}
              {chatLoading&&(
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{background:appearance.accentColor}}><Bot size={12} className="text-white"/></div>
                  <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-3 py-2.5 shadow-sm flex gap-1 items-center">
                    {[0,1,2].map(i=><div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{animationDelay:`${i*0.15}s`,background:appearance.accentColor}}/>)}
                  </div>
                </div>
              )}
              <div ref={chatEndRef}/>
            </div>
            <div className="p-3 bg-white border-t border-gray-100 flex gap-2 shrink-0">
              <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();sendChat();}}} placeholder="メッセージを入力..." className="flex-1 bg-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:bg-white transition resize-none" style={{"--tw-ring-color":appearance.accentColor} as any}/>
              <button onClick={sendChat} disabled={chatLoading||!chatInput.trim()} className="w-9 h-9 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-all active:scale-95 shadow-sm" style={{background:appearance.accentColor}}>
                <Send size={14}/>
              </button>
            </div>
          </div>
        </div>
      )}

      {selectionTooltip&&(
        <div data-selection-tooltip="true" style={{position:"fixed",left:selectionTooltip.x,top:selectionTooltip.y,transform:"translateX(-50%) translateY(-100%)",zIndex:60,animation:"tooltipIn 0.2s ease-out",pointerEvents:"auto"}}>
          <button onMouseDown={e=>{e.preventDefault(); const q=`次のテキストについて教えてください: "${selectionTooltip.text.slice(0,200)}"`; pendingSendRef.current=true; setChatInput(q); setChatOpen(true); setSelectionTooltip(null); window.getSelection()?.removeAllRanges();}}
            className="flex items-center gap-1.5 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-xl whitespace-nowrap transition-colors" style={{background:"#111827"}}>
            <Sparkles size={11}/> AIに聞く
          </button>
          <div className="w-2.5 h-2.5 rotate-45 mx-auto -mt-1.5 rounded-sm" style={{background:"#111827"}}/>
        </div>
      )}

      {notifOpen&&(
        <div className="fixed inset-0 bg-black/50 z-50 flex flex-col" onClick={()=>setNotifOpen(false)}>
          <div className="flex-1"/>
          <div className={`bg-white rounded-t-3xl max-h-[70vh] overflow-y-auto ${slideUp}`} onClick={e=>e.stopPropagation()}>
            <div className="sticky top-0 bg-white flex items-center justify-between px-4 py-3.5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <BellRing size={16} style={{color:appearance.accentColor}}/>
                <h3 className="font-black text-gray-900">通知</h3>
                {unreadCount>0&&<span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{background:appearance.accentColor}}>{unreadCount}</span>}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount>0&&<button onClick={()=>setNotifications(p=>p.map(n=>({...n,read:true})))} className="text-xs font-bold" style={{color:appearance.accentColor}}>すべて既読</button>}
                <button onClick={()=>setNotifOpen(false)} className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center"><X size={13} className="text-gray-500"/></button>
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {notifications.length===0&&<div className="text-center py-10"><p className="text-2xl mb-2">🔔</p><p className="text-sm text-gray-400">通知はありません</p></div>}
              {notifications.map(n=>(
                <div key={n.id} onClick={()=>setNotifications(p=>p.map(x=>x.id===n.id?{...x,read:true}:x))}
                  className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors ${n.read?"":"bg-blue-50/50"}`}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-lg mt-0.5" style={{background:appearance.accentColor+"22"}}>
                    {n.type==="mention"?"@":n.type==="message"?"💬":n.type==="task_assigned"?"📋":"🔔"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${n.read?"text-gray-600":"text-gray-900"}`}>{n.title}</p>
                    {n.body&&<p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>}
                    <p className="text-[10px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleString("ja-JP",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</p>
                  </div>
                  {!n.read&&<div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{background:appearance.accentColor}}/>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {searchOpen&&(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col" onClick={()=>setSearchOpen(false)}>
          <div className="bg-white w-full p-4 shadow-2xl" style={{animation:"slideUp 0.3s ease-out"}} onClick={e=>e.stopPropagation()}>
            <div className="flex items-center gap-3 bg-gray-100 rounded-2xl px-4 py-2.5">
              <Search size={18} className="text-gray-400 shrink-0"/>
              <input ref={searchRef} value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="タスク、機材、Wikiを検索..." className="flex-1 bg-transparent text-sm focus:outline-none text-gray-800 placeholder-gray-400"/>
              <button onClick={()=>{setSearchOpen(false);setSearchQuery("");}}><X size={18} className="text-gray-400"/></button>
            </div>
            {searchResults.length>0&&(
              <div className="mt-3 space-y-1 max-h-72 overflow-y-auto">
                {searchResults.map((r,i)=>(
                  <button key={i} onClick={()=>{setActiveTab(r.tab);setSearchOpen(false);setSearchQuery("");if(r.wiki)setActiveWiki(r.wiki);}} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{background:r.color+"22"}}>
                      {r.type==="task"?<Calendar size={14} style={{color:r.color}}/>:r.type==="inventory"?<Package size={14} style={{color:r.color}}/>:<BookOpen size={14} style={{color:r.color}}/>}
                    </div>
                    <div className="flex-1 min-w-0"><p className="text-sm font-bold text-gray-900 truncate">{r.label}</p><p className="text-xs text-gray-400">{r.sub}</p></div>
                    <ChevronRight size={14} className="text-gray-300 shrink-0"/>
                  </button>
                ))}
              </div>
            )}
            {searchQuery.trim().length>0&&searchResults.length===0&&<p className="text-center text-sm text-gray-400 py-6">「{searchQuery}」の結果が見つかりません</p>}
          </div>
        </div>
      )}

      {editingRole&&<RoleEditor role={editingRole} onSave={saveRole} onClose={()=>setEditingRole(null)} onDelete={editingRole.isDefault?undefined:()=>deleteRole(editingRole.id)}/>}
      {showNewRoleForm&&<RoleEditor role={{id:Date.now().toString(),name:"新しいロール",color:"#3b82f6",icon:"👤",permissions:{...DEFAULT_PERMISSIONS},isDefault:false,visualEffect:"none",createdAt:new Date().toISOString().split("T")[0]}} onSave={saveRole} onClose={()=>setShowNewRoleForm(false)}/>}

      {/* ── QR表示モーダル ── */}
      {showQRModal&&(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={()=>setShowQRModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xs p-6 text-center" onClick={e=>e.stopPropagation()}>
            <h2 className="text-base font-black text-gray-900 mb-0.5">今週の出欠QR</h2>
            <p className="text-[11px] text-gray-400 mb-4">{qrWeekLabel} · {qrValidUntil}まで有効</p>
            {qrLoading?(
              <div className="flex items-center justify-center h-48"><Loader2 size={28} className="animate-spin text-blue-400"/></div>
            ):qrDataUrl?(
              <>
                <img src={qrDataUrl} alt="QR Code" className="w-56 h-56 mx-auto rounded-2xl shadow-md mb-3 border border-gray-100"/>
                <p className="text-[10px] text-gray-400 mb-4">AeroSyncアプリの「QRスキャン」で読み取れます</p>
                <button onClick={printQR} className="w-full py-2.5 rounded-2xl bg-blue-50 text-blue-700 font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-100 transition-all active:scale-95">
                  <Download size={14}/> 印刷 / 保存
                </button>
              </>
            ):(
              <p className="text-sm text-red-500 py-8">QR生成に失敗しました</p>
            )}
            <button onClick={()=>setShowQRModal(false)} className="mt-2 w-full py-2 rounded-2xl text-gray-400 text-sm hover:text-gray-600 transition-colors">閉じる</button>
          </div>
        </div>
      )}

      {/* ── QRスキャナーモーダル ── */}
      {showQRScanner&&(
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center" onClick={stopQRScanner}>
          <div className="flex flex-col items-center" onClick={e=>e.stopPropagation()}>
            <h2 className="text-white font-black text-base mb-1">QRコードをかざしてください</h2>
            <p className="text-white/50 text-[11px] mb-5">作業場に掲示されたQRコードをスキャン</p>
            <div className="relative w-64 h-64 rounded-2xl overflow-hidden bg-black border-2 border-white/20">
              <video ref={qrVideoRef} autoPlay playsInline muted className="w-full h-full object-cover"/>
              <canvas ref={qrCanvasRef} className="hidden"/>
              {/* corner guides */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-3 left-3 w-7 h-7 border-t-[3px] border-l-[3px] border-white rounded-tl-lg"/>
                <div className="absolute top-3 right-3 w-7 h-7 border-t-[3px] border-r-[3px] border-white rounded-tr-lg"/>
                <div className="absolute bottom-3 left-3 w-7 h-7 border-b-[3px] border-l-[3px] border-white rounded-bl-lg"/>
                <div className="absolute bottom-3 right-3 w-7 h-7 border-b-[3px] border-r-[3px] border-white rounded-br-lg"/>
              </div>
            </div>
            {qrScanResult==="checkin"&&(
              <div className="mt-5 text-center">
                <p className="text-green-400 font-black text-xl">✅ 入室記録完了！</p>
                <p className="text-white/60 text-sm mt-1">入室時刻を記録しました</p>
              </div>
            )}
            {qrScanResult==="checkout"&&(
              <div className="mt-5 text-center">
                <p className="text-blue-400 font-black text-xl">🚪 退室記録完了！</p>
                <p className="text-white/60 text-sm mt-1">
                  滞在時間：{qrScanData?.durationMinutes != null
                    ? qrScanData.durationMinutes >= 60
                      ? `${Math.floor(qrScanData.durationMinutes/60)}時間${qrScanData.durationMinutes%60}分`
                      : `${qrScanData.durationMinutes}分`
                    : "－"}
                </p>
              </div>
            )}
            {qrScanResult==="error"&&(
              <p className="mt-5 text-red-400 font-bold text-sm text-center">QRコードが無効です。<br/>最新のQRを読み取ってください。</p>
            )}
            {!qrScanResult&&<p className="mt-4 text-white/40 text-xs animate-pulse">スキャン中...</p>}
            <button onClick={stopQRScanner} className="mt-6 px-8 py-3 rounded-2xl bg-white/10 text-white font-bold text-sm hover:bg-white/20 transition-all">キャンセル</button>
          </div>
        </div>
      )}
    </div>
  );
}
