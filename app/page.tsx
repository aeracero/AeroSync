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

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = "home"|"schedule"|"inventory"|"wiki"|"members"|"settings";
type AuthMode = "login"|"signup"|"check_email";
type SettingsTab = "profile"|"roles"|"appearance"|"notifications"|"privacy"|"data"|"about";

type Task = { id:string; title:string; date:string; description:string; assignees:string[]; openJoin:boolean; color:string; done:boolean; priority:"low"|"medium"|"high"; location?:string; };
type Availability = { userId:string; name:string; date:string; status:"available"|"maybe"|"unavailable"; note:string; };
type InventoryItem = { id:string; name:string; stock:number; total:number; image:string; isEmoji:boolean; category:string; };
type WikiPage = { id:string; title:string; content:string; category:string; updatedAt:string; author:string; views:number; };
type ChatMessage = { role:"user"|"assistant"; content:string; ts:number; };
type Member = { id:string; email:string; display_name:string; avatar_url?:string; discord_id?:string; role_id:string; visual_effect:string; online_at?:string; };
type DmMessage = { id:string; channel_id:string; channel_type:string; sender_id:string; sender_email:string; sender_name:string; sender_avatar?:string; content:string; mentions:string[]; created_at:string; };
type AppNotification = { id:string; type:string; title:string; body:string; read:boolean; created_at:string; };

type Permission = {
  manageRoles: boolean;
  manageTasks: boolean;
  manageInventory: boolean;
  manageWiki: boolean;
  manageMembers: boolean;
  viewStats: boolean;
  exportData: boolean;
};

type Role = {
  id: string;
  name: string;
  color: string;
  icon: string;
  permissions: Permission;
  isDefault: boolean; // can't delete
  visualEffect: string; // "none"|"sparkle"|"fire"|"rainbow"|"glow"|"snow"|"stars"
  createdAt: string;
};

type MemberRole = {
  email: string;
  roleId: string;
  assignedAt: string;
  assignedBy: string;
};

type AppearanceSettings = {
  theme: "system"|"light"|"dark";
  accentColor: string;
  fontSize: "sm"|"md"|"lg";
  reduceMotion: boolean;
  compactMode: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const TASK_COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#84cc16"];
const WIKI_CATS = ["一般","機材","手順","ルール","メモ"];
const INV_CATS = ["カメラ","音響","照明","その他"];
const AVAIL_COLORS = { available:"#10b981", maybe:"#f59e0b", unavailable:"#ef4444" } as const;
const AVAIL_LABELS = { available:"参加可", maybe:"未定", unavailable:"不参加" } as const;
const ROLE_COLORS = ["#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#8b5cf6","#ec4899","#06b6d4","#84cc16","#64748b"];
const ROLE_ICONS = ["👑","⭐","🛡️","🎯","🔧","🎨","🚀","💎","🔑","👤","🎭","⚡","🌟","🏆","🦊"];
const VISUAL_EFFECTS = [
  { id:"none", label:"なし", preview:"" },
  { id:"sparkle", label:"✨ スパークル", preview:"sparkle" },
  { id:"fire", label:"🔥 ファイア", preview:"fire" },
  { id:"rainbow", label:"🌈 レインボー", preview:"rainbow" },
  { id:"glow", label:"💫 グロー", preview:"glow" },
  { id:"snow", label:"❄️ スノー", preview:"snow" },
  { id:"stars", label:"⭐ スターズ", preview:"stars" },
  { id:"pulse", label:"💜 パルス", preview:"pulse" },
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
    // Check for updates every 60 seconds
    setInterval(() => reg.update(), 60_000);
    // New SW waiting = update available
    reg.addEventListener("updatefound", () => {
      const newSW = reg.installing;
      if (!newSW) return;
      newSW.addEventListener("statechange", () => {
        if (newSW.state === "installed" && navigator.serviceWorker.controller) {
          onUpdate?.();
        }
      });
    });
  }).catch(() => {});
  // Listen for the SW_UPDATED message — triggers full reload
  navigator.serviceWorker.addEventListener("message", (e) => {
    if (e.data?.type === "SW_UPDATED") onUpdate?.();
  });
  // When a new SW takes control, reload the page automatically
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!refreshing) { refreshing = true; window.location.reload(); }
  });
}
async function reqNotif():Promise<boolean> { if(!("Notification" in window)) return false; if(Notification.permission==="granted") return true; return (await Notification.requestPermission())==="granted"; }

// ─── Visual Effects CSS ────────────────────────────────────────────────────────
const EFFECT_STYLES: Record<string,string> = {
  sparkle: "relative overflow-visible after:content-['✨'] after:absolute after:-top-1 after:-right-1 after:text-xs after:animate-bounce",
  fire: "relative after:content-['🔥'] after:absolute after:-top-1.5 after:-right-0.5 after:text-xs",
  rainbow: "bg-gradient-to-r from-red-400 via-yellow-400 via-green-400 via-blue-400 to-purple-400 bg-clip-text text-transparent",
  glow: "drop-shadow-[0_0_8px_rgba(139,92,246,0.8)]",
  snow: "relative after:content-['❄️'] after:absolute after:-top-1 after:-right-0.5 after:text-xs after:animate-spin",
  stars: "relative after:content-['⭐'] after:absolute after:-top-1.5 after:-right-0.5 after:text-xs",
  pulse: "animate-pulse",
  none: "",
};

// ─── Animations ────────────────────────────────────────────────────────────────
const fadeIn = "animate-[fadeIn_0.3s_ease-out]";
const slideUp = "animate-[slideUp_0.35s_cubic-bezier(0.34,1.56,0.64,1)]";

// ─── VisualEffect component ────────────────────────────────────────────────────
function VisualEffectWrapper({ effect, children }: { effect:string; children:React.ReactNode }) {
  if (effect === "none" || !effect) return <>{children}</>;
  if (effect === "sparkle") return (
    <span className="relative inline-flex">
      {children}
      <span className="absolute -top-1 -right-1 text-[10px] animate-bounce pointer-events-none">✨</span>
    </span>
  );
  if (effect === "fire") return (
    <span className="relative inline-flex">
      {children}
      <span className="absolute -top-2 -right-0.5 text-[10px] pointer-events-none" style={{animation:"floatPulse 1.5s ease-in-out infinite"}}>🔥</span>
    </span>
  );
  if (effect === "rainbow") return (
    <span className="bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 bg-clip-text text-transparent font-black">{children}</span>
  );
  if (effect === "glow") return (
    <span style={{filter:"drop-shadow(0 0 6px rgba(139,92,246,0.7))"}}>  {children}</span>
  );
  if (effect === "snow") return (
    <span className="relative inline-flex">
      {children}
      <span className="absolute -top-1 -right-0.5 text-[10px] pointer-events-none" style={{animation:"spin 3s linear infinite"}}>❄️</span>
    </span>
  );
  if (effect === "stars") return (
    <span className="relative inline-flex">
      {children}
      <span className="absolute -top-1.5 -right-0.5 text-[10px] pointer-events-none animate-pulse">⭐</span>
    </span>
  );
  if (effect === "pulse") return <span className="animate-pulse">{children}</span>;
  return <>{children}</>;
}

// ─── Particle canvas for background effects ────────────────────────────────────
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
        ctx!.globalAlpha = p.alpha;
        ctx!.font = `${p.size}px serif`;
        ctx!.fillText(p.char, p.x, p.y);
        p.x += p.vx; p.y += p.vy; p.alpha -= 0.003;
        if (p.alpha <= 0 || p.y < -20) {
          p.y = canvas!.height + 10; p.x = Math.random()*canvas!.width;
          p.alpha = 0.4+Math.random()*0.6; p.char = ch[Math.floor(Math.random()*ch.length)];
        }
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

// ─── Small UI atoms ────────────────────────────────────────────────────────────
function DiscordIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.031.053a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>;
}

function Pill({ color, children }: { color?:string; children:React.ReactNode }) {
  return <span style={{background:color?color+"22":undefined,color,border:`1px solid ${color}44`}} className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">{children}</span>;
}

function Toggle({ checked, onChange, activeColor="#3b82f6" }: { checked:boolean; onChange:(v:boolean)=>void; activeColor?:string }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer" onClick={e=>e.stopPropagation()}>
      <input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} className="sr-only peer"/>
      <div className="w-11 h-6 bg-gray-200 rounded-full transition-all duration-300" style={{background:checked?activeColor:"#e5e7eb"}}/>
      <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300" style={{transform:checked?"translateX(20px)":"translateX(0)"}}/>
    </label>
  );
}

function SectionHeader({ title }: { title:string }) {
  return <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 py-2.5">{title}</p>;
}

function SettingsRow({ icon, iconBg, title, subtitle, right, onClick, danger }: {
  icon:React.ReactNode; iconBg:string; title:string; subtitle?:string;
  right?:React.ReactNode; onClick?:()=>void; danger?:boolean;
}) {
  return (
    <div onClick={onClick} className={`flex items-center gap-3 px-4 py-3 ${onClick?"cursor-pointer hover:bg-gray-50":""} ${danger?"hover:bg-red-50":""} transition-colors`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold ${danger?"text-red-500":"text-gray-800"}`}>{title}</p>
        {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
      </div>
      {right ?? (onClick && <ChevronRight size={15} className="text-gray-300 shrink-0"/>)}
    </div>
  );
}

// ─── Calendar ─────────────────────────────────────────────────────────────────
function CalendarView({ tasks, availability, onDayClick, selectedDate }: {
  tasks:Task[]; availability:Availability[]; onDayClick:(d:string)=>void; selectedDate:string;
}) {
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
        {["日","月","火","水","木","金","土"].map((d,i)=>(
          <div key={d} className={`py-2 text-[10px] font-bold ${i===0?"text-red-400":i===6?"text-blue-400":"text-gray-400"}`}>{d}</div>
        ))}
        {Array.from({length:fd}).map((_,i)=><div key={`b${i}`}/>)}
        {Array.from({length:dim},(_,i)=>i+1).map(d=>{
          const s=ds(d), dt=tasks.filter(t=>t.date===s), av=availability.filter(a=>a.date===s);
          const isSel=s===selectedDate, isT=s===today;
          return (
            <button key={d} onClick={()=>onDayClick(s)}
              className={`relative py-1.5 mx-0.5 my-0.5 rounded-xl text-xs font-medium transition-all duration-200 active:scale-90 ${isSel?"bg-blue-600 text-white shadow-md shadow-blue-200":isT?"bg-blue-50 text-blue-600 font-bold":"text-gray-700 hover:bg-gray-50"}`}>
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

// ─── Wiki Page View ────────────────────────────────────────────────────────────
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
        <div className="flex-1 min-w-0">
          {editing?<input value={title} onChange={e=>setTitle(e.target.value)} className="w-full text-base font-bold border-b border-blue-300 focus:outline-none bg-transparent"/>
            :<h2 className="text-base font-bold text-gray-900 truncate">{page.title}</h2>}
        </div>
        {canEdit&&(editing
          ?<button onClick={save} className="flex items-center gap-1 text-xs font-bold text-white bg-blue-600 px-3 py-1.5 rounded-xl transition-all active:scale-95"><Save size={13}/> 保存</button>
          :<button onClick={()=>setEditing(true)} className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl transition-all active:scale-95"><Edit2 size={13}/> 編集</button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center gap-2 mb-4">
          {editing?<select value={category} onChange={e=>setCategory(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none">{WIKI_CATS.map(c=><option key={c}>{c}</option>)}</select>
            :<Pill color="#3b82f6">{page.category}</Pill>}
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

// ─── Role Editor ───────────────────────────────────────────────────────────────
function RoleEditor({ role, onSave, onClose, onDelete }: { role:Role; onSave:(r:Role)=>void; onClose:()=>void; onDelete?:()=>void; }) {
  const [draft, setDraft] = useState<Role>({...role, permissions:{...role.permissions}});
  const PERM_LABELS: {key:keyof Permission; label:string; desc:string}[] = [
    {key:"manageTasks",label:"タスク管理",desc:"タスクの追加・編集・削除"},
    {key:"manageInventory",label:"在庫管理",desc:"機材の追加・編集・削除"},
    {key:"manageWiki",label:"Wiki管理",desc:"Wikiページの編集・削除"},
    {key:"manageMembers",label:"メンバー管理",desc:"ロールの割り当て"},
    {key:"manageRoles",label:"ロール管理",desc:"ロールの作成・編集・削除"},
    {key:"viewStats",label:"統計閲覧",desc:"詳細な統計情報の閲覧"},
    {key:"exportData",label:"データ出力",desc:"データのエクスポート"},
  ];
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end" onClick={onClose}>
      <div className={`bg-white w-full rounded-t-3xl max-h-[90vh] overflow-y-auto ${slideUp}`} onClick={e=>e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1"/>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xl">{draft.icon}</span>
            <h3 className="font-black text-gray-900 text-base">ロールを編集</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center"><X size={14} className="text-gray-500"/></button>
        </div>
        <div className="p-5 space-y-5">
          {/* Preview */}
          <div className="rounded-2xl p-4 flex items-center gap-3" style={{background:draft.color+"18",border:`1.5px solid ${draft.color}44`}}>
            <span className="text-2xl">{draft.icon}</span>
            <div>
              <VisualEffectWrapper effect={draft.visualEffect}>
                <span className="font-black text-base" style={{color:draft.color}}>{draft.name}</span>
              </VisualEffectWrapper>
              <p className="text-xs text-gray-500 mt-0.5">プレビュー</p>
            </div>
          </div>
          {/* Name */}
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1.5">ロール名</label>
            <input value={draft.name} onChange={e=>setDraft(p=>({...p,name:e.target.value}))} disabled={draft.isDefault}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-50 disabled:text-gray-400"/>
          </div>
          {/* Color */}
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-2">カラー</label>
            <div className="flex gap-2 flex-wrap">
              {ROLE_COLORS.map(c=>(
                <button key={c} onClick={()=>setDraft(p=>({...p,color:c}))} style={{background:c}}
                  className={`w-8 h-8 rounded-full transition-all ${draft.color===c?"scale-125 ring-2 ring-offset-1 ring-gray-400":""}`}/>
              ))}
              <div className="relative">
                <input type="color" value={draft.color} onChange={e=>setDraft(p=>({...p,color:e.target.value}))}
                  className="w-8 h-8 rounded-full cursor-pointer border-0 p-0"/>
              </div>
            </div>
          </div>
          {/* Icon */}
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-2">アイコン</label>
            <div className="flex flex-wrap gap-2">
              {ROLE_ICONS.map(ic=>(
                <button key={ic} onClick={()=>setDraft(p=>({...p,icon:ic}))}
                  className={`w-9 h-9 rounded-xl text-xl flex items-center justify-center transition-all ${draft.icon===ic?"bg-blue-100 ring-2 ring-blue-400 scale-110":"bg-gray-100 hover:bg-gray-200"}`}>{ic}</button>
              ))}
            </div>
          </div>
          {/* Visual Effect */}
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-2">ビジュアルエフェクト</label>
            <div className="grid grid-cols-2 gap-2">
              {VISUAL_EFFECTS.map(ef=>(
                <button key={ef.id} onClick={()=>setDraft(p=>({...p,visualEffect:ef.id}))}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border-2 text-left transition-all ${draft.visualEffect===ef.id?"border-blue-500 bg-blue-50 text-blue-700":"border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                  {ef.label}
                </button>
              ))}
            </div>
          </div>
          {/* Permissions */}
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-2">権限</label>
            <div className="space-y-2 bg-gray-50 rounded-2xl p-3">
              {PERM_LABELS.map(({key,label,desc})=>(
                <div key={key} className="flex items-center justify-between gap-3 py-1">
                  <div>
                    <p className="text-sm font-bold text-gray-800">{label}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                  <Toggle checked={draft.permissions[key]} onChange={v=>setDraft(p=>({...p,permissions:{...p.permissions,[key]:v}}))} activeColor={draft.color}/>
                </div>
              ))}
            </div>
          </div>
          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button onClick={()=>onSave(draft)} className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-2xl text-sm hover:bg-blue-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
              <Save size={15}/> 保存
            </button>
            {!draft.isDefault && onDelete && (
              <button onClick={onDelete} className="w-12 bg-red-50 text-red-500 font-bold py-3 rounded-2xl text-sm hover:bg-red-100 transition-all flex items-center justify-center">
                <Trash2 size={15}/>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
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

  // Roles
  const [roles, setRoles] = useState<Role[]>(DEFAULT_ROLES);
  const [memberRoles, setMemberRoles] = useState<MemberRole[]>([]);
  const [editingRole, setEditingRole] = useState<Role|null>(null);
  const [showNewRoleForm, setShowNewRoleForm] = useState(false);
  const [claimOwnerCode, setClaimOwnerCode] = useState("");
  const [claimOwnerError, setClaimOwnerError] = useState("");
  const [showClaimOwner, setShowClaimOwner] = useState(false);
  const [assignEmail, setAssignEmail] = useState("");
  const [assignRoleId, setAssignRoleId] = useState("");

  // Appearance
  const [appearance, setAppearance] = useState<AppearanceSettings>({
    theme:"system", accentColor:"#3b82f6", fontSize:"md", reduceMotion:false, compactMode:false
  });
  const [myVisualEffect, setMyVisualEffect] = useState("none");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [privateMode, setPrivateMode] = useState(false);
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);

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
  const [invFilter, setInvFilter] = useState("すべて");

  // Wiki
  const [wikis, setWikis] = useState<WikiPage[]>([]);
  const [activeWiki, setActiveWiki] = useState<WikiPage|null>(null);
  const [showWikiForm, setShowWikiForm] = useState(false);
  const [newWiki, setNewWiki] = useState({ title:"", cat:WIKI_CATS[0] });
  const [wikiFilter, setWikiFilter] = useState("すべて");

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [selectionTooltip, setSelectionTooltip] = useState<{text:string;x:number;y:number}|null>(null);
  const pendingSendRef = useRef(false);

  // Members & realtime
  const [members, setMembers] = useState<Member[]>([]);
  const [dmOpen, setDmOpen] = useState<Member|null>(null);
  const [dmMessages, setDmMessages] = useState<DmMessage[]>([]);
  const [dmInput, setDmInput] = useState("");
  const [dmLoading, setDmLoading] = useState(false);
  const dmEndRef = useRef<HTMLDivElement>(null);
  const [groupMessages, setGroupMessages] = useState<DmMessage[]>([]);
  const [groupInput, setGroupInput] = useState("");
  const [groupOpen, setGroupOpen] = useState(false);
  useEffect(()=>{
    if(!groupOpen)return;
    const load=async()=>{
      const supabase=createClient();
      const {data}=await supabase.from("messages").select("*").eq("channel_id","general").order("created_at",{ascending:true}).limit(100);
      if(data)setGroupMessages(data as DmMessage[]);
      supabase.channel("general_msgs").on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`channel_id=eq.general`},(p)=>{setGroupMessages(prev=>[...prev,p.new as DmMessage]);}).subscribe();
    };
    load();
  },[groupOpen]);
  const [mentionTarget, setMentionTarget] = useState<Member|null>(null);
  const [roleChangeTarget, setRoleChangeTarget] = useState<string|null>(null); // member.id
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const unreadCount = notifications.filter(n=>!n.read).length;
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const currentUserEmail = session?.user?.email ?? session?.user?.user_metadata?.full_name ?? "me";

  // Derive permissions from role
  const myRole = memberRoles.find(m=>m.email===currentUserEmail);
  const myRoleData = roles.find(r=>r.id===myRole?.roleId) ?? roles.find(r=>r.id==="member")!;
  const perms = myRoleData?.permissions ?? DEFAULT_PERMISSIONS;
  const isAdmin = perms.manageTasks || perms.manageInventory || perms.manageWiki;
  const canManageRoles = perms.manageRoles || perms.manageMembers;
  // noOwner = no one in memberRoles has owner AND no one in members DB has role_id="owner"
  const noOwner = !memberRoles.some(m=>m.roleId==="owner") && !members.some(m=>m.role_id==="owner");
  const imAlreadyOwner = myRole?.roleId==="owner" || myRoleData?.id==="owner";

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

    // Only load UI preferences from localStorage — shared data always comes from Supabase
    setRoles(loadLS("as_roles", DEFAULT_ROLES));
    setMemberRoles(loadLS("as_memberroles", []));
    setAppearance(loadLS("as_appearance", {theme:"system",accentColor:"#3b82f6",fontSize:"md",reduceMotion:false,compactMode:false}));
    setMyVisualEffect(loadLS("as_myeffect", "none"));
    setChatMessages(loadLS("as_chat", []));
    setNotifEnabled(typeof Notification!=="undefined"&&Notification.permission==="granted");

    // ── Supabase realtime subscriptions ──────────────────────────────────────
    // Fetch initial data from Supabase (fallback to localStorage already loaded above)
    const initSupabase = async () => {
      try {
        // Load members
        const { data: membersData } = await supabase.from("members").select("*").order("created_at");
        if (membersData) setMembers(membersData);

        // Load tasks
        const { data: tasksData } = await supabase.from("tasks").select("*").order("date");
        if (tasksData && tasksData.length > 0) setTasks(tasksData.map((t:any)=>({
          id:t.id, title:t.title, date:t.date, description:t.description||"",
          assignees:t.assignees||[], openJoin:t.open_join, color:t.color,
          done:t.done, priority:t.priority, location:t.location||""
        })));

        // Load inventory
        const { data: invData } = await supabase.from("inventory").select("*").order("created_at");
        if (invData && invData.length > 0) setInventory(invData.map((i:any)=>({
          id:i.id, name:i.name, stock:i.stock, total:i.total,
          image:i.image||"📦", isEmoji:i.is_emoji, category:i.category
        })));

        // Load wiki
        const { data: wikiData } = await supabase.from("wiki_pages").select("*").order("updated_at", {ascending:false});
        if (wikiData && wikiData.length > 0) setWikis(wikiData.map((w:any)=>({
          id:w.id, title:w.title, content:w.content, category:w.category,
          updatedAt:w.updated_at?.split("T")[0]||new Date().toISOString().split("T")[0],
          author:w.author||"", views:w.views||0
        })));

        // Load availability
        const { data: availData } = await supabase.from("availability").select("*");
        if (availData) setAvailability(availData.map((a:any)=>({
          userId:a.user_id, name:a.user_email||a.user_id, date:a.date, status:a.status, note:a.note||""
        })));

        // Load notifications for current user
        const { data: notifData } = await supabase.from("notifications").select("*").order("created_at",{ascending:false}).limit(50);
        if (notifData) setNotifications(notifData);

        // Load roles from DB
        const { data: rolesData } = await supabase.from("roles").select("*");
        if (rolesData && rolesData.length > 0) setRoles(rolesData.map((r:any)=>({
          id:r.id, name:r.name, color:r.color, icon:r.icon,
          permissions:r.permissions||DEFAULT_PERMISSIONS, isDefault:r.is_default,
          visualEffect:r.visual_effect||"none", createdAt:r.created_at?.split("T")[0]||""
        })));

        // Update own member presence
        const { data: { user: u } } = await supabase.auth.getUser();
        if (u) {
          await supabase.from("members").upsert({
            id: u.id, email: u.email,
            display_name: u.user_metadata?.full_name || u.email,
            avatar_url: u.user_metadata?.avatar_url,
            discord_id: u.user_metadata?.provider_id,
            online_at: new Date().toISOString(),
          });
        }
      } catch(e) {
        console.error("[AeroSync] Supabase init failed:", e);
        // Log which env vars are set
        console.log("[AeroSync] SUPABASE_URL set:", !!process.env.NEXT_PUBLIC_SUPABASE_URL);
      }
    };
    // initSupabase runs immediately — auth session is already set from cookies
    // We call getUser() inside initSupabase anyway before upsert
    initSupabase();

    // ── Realtime subscriptions ────────────────────────────────────────────────
    const tasksSub = supabase.channel("tasks_changes")
      .on("postgres_changes",{event:"*",schema:"public",table:"tasks"},(payload)=>{
        if(payload.eventType==="INSERT") setTasks(p=>[...p,{id:payload.new.id,title:payload.new.title,date:payload.new.date,description:payload.new.description||"",assignees:payload.new.assignees||[],openJoin:payload.new.open_join,color:payload.new.color,done:payload.new.done,priority:payload.new.priority,location:payload.new.location||""}]);
        if(payload.eventType==="UPDATE") setTasks(p=>p.map(t=>t.id===payload.new.id?{...t,done:payload.new.done,assignees:payload.new.assignees||t.assignees}:t));
        if(payload.eventType==="DELETE") setTasks(p=>p.filter(t=>t.id!==(payload.old as any).id));
      }).subscribe();

    const invSub = supabase.channel("inventory_changes")
      .on("postgres_changes",{event:"*",schema:"public",table:"inventory"},(payload)=>{
        if(payload.eventType==="INSERT") setInventory(p=>[...p,{id:payload.new.id,name:payload.new.name,stock:payload.new.stock,total:payload.new.total,image:payload.new.image||"📦",isEmoji:payload.new.is_emoji,category:payload.new.category}]);
        if(payload.eventType==="UPDATE") setInventory(p=>p.map(i=>i.id===payload.new.id?{...i,stock:payload.new.stock}:i));
        if(payload.eventType==="DELETE") setInventory(p=>p.filter(i=>i.id!==(payload.old as any).id));
      }).subscribe();

    const wikiSub = supabase.channel("wiki_changes")
      .on("postgres_changes",{event:"*",schema:"public",table:"wiki_pages"},(payload)=>{
        if(payload.eventType==="INSERT"||payload.eventType==="UPDATE") {
          const w={id:payload.new.id,title:payload.new.title,content:payload.new.content,category:payload.new.category,updatedAt:payload.new.updated_at?.split("T")[0]||"",author:payload.new.author||"",views:payload.new.views||0};
          setWikis(p=>{ const idx=p.findIndex(x=>x.id===w.id); return idx>=0?p.map((x,i)=>i===idx?w:x):[...p,w]; });
        }
        if(payload.eventType==="DELETE") setWikis(p=>p.filter(w=>w.id!==(payload.old as any).id));
      }).subscribe();

    const availSub = supabase.channel("avail_changes")
      .on("postgres_changes",{event:"*",schema:"public",table:"availability"},(payload)=>{
        const n=payload.new as any; const o=payload.old as any;
        const a={userId:n?.user_id,name:n?.user_email||"",date:n?.date,status:n?.status,note:n?.note||""};
        if(payload.eventType==="INSERT"||payload.eventType==="UPDATE") setAvailability(p=>[...p.filter(x=>!(x.userId===a.userId&&x.date===a.date)),a]);
        if(payload.eventType==="DELETE") setAvailability(p=>p.filter(x=>!(x.userId===o?.user_id&&x.date===o?.date)));
      }).subscribe();

    const membersSub = supabase.channel("members_changes")
      .on("postgres_changes",{event:"*",schema:"public",table:"members"},(payload)=>{
        if(payload.eventType==="INSERT"||payload.eventType==="UPDATE") {
          const updated = payload.new as Member;
          setMembers(p=>{const idx=p.findIndex(m=>m.id===updated.id);return idx>=0?p.map((m,i)=>i===idx?{...m,...updated}:m):[...p,updated];});
          // Also sync memberRoles local state so role display updates immediately
          if(updated.role_id) setMemberRoles(p=>[...p.filter(mr=>mr.email!==updated.email),{email:updated.email||"",roleId:updated.role_id,assignedAt:new Date().toISOString().split("T")[0],assignedBy:"sync"}]);
        }
      }).subscribe();

    const notifSub = supabase.channel("notif_changes")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications"},(payload)=>{
        setNotifications(p=>[payload.new as AppNotification,...p]);
        // Show browser notification
        if(typeof Notification!=="undefined"&&Notification.permission==="granted") {
          new Notification(payload.new.title,{body:payload.new.body,icon:"/icons/icon-192.png"});
        }
      }).subscribe();

    return () => {
      try { tasksSub.unsubscribe(); invSub.unsubscribe(); wikiSub.unsubscribe(); availSub.unsubscribe(); membersSub.unsubscribe(); notifSub.unsubscribe(); } catch {}
      subscription.unsubscribe();
      document.removeEventListener("pointerup", handleSelectionChange);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  useEffect(()=>{
    if(!isMounted)return;
    // Only persist UI preferences locally — shared data lives in Supabase
    saveLS("as_roles", roles);
    saveLS("as_memberroles", memberRoles);
    saveLS("as_appearance", appearance);
    saveLS("as_myeffect", myVisualEffect);
    saveLS("as_chat", chatMessages);
  },[roles,memberRoles,appearance,myVisualEffect,chatMessages,isMounted]);

  useEffect(()=>{ chatEndRef.current?.scrollIntoView({behavior:"smooth"}); },[chatMessages]);
  useEffect(()=>{ dmEndRef.current?.scrollIntoView({behavior:"smooth"}); },[dmMessages]);
  useEffect(()=>{ if(searchOpen) setTimeout(()=>searchRef.current?.focus(),100); },[searchOpen]);

  useEffect(()=>{
    const my = availability.find(a=>a.userId===currentUserEmail&&a.date===selectedDate);
    setMyAvailStatus(my?.status??null); setAvailNote(my?.note??"");
  },[selectedDate,availability,currentUserEmail]);

  // ── Auth ──────────────────────────────────────────────────────────────────
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

  // ── Availability ─────────────────────────────────────────────────────────
  const setMyAvail = async(status:Availability["status"])=>{
    setMyAvailStatus(status);
    setAvailability(prev=>[...prev.filter(a=>!(a.userId===currentUserEmail&&a.date===selectedDate)),{userId:currentUserEmail,name:currentUserEmail,date:selectedDate,status,note:availNote}]);
    try {
      const sb=createClient();
      const {data:{user}}=await sb.auth.getUser();
      if(!user)return;
      await sb.from("availability").upsert({user_id:user.id,user_email:currentUserEmail,date:selectedDate,status,note:availNote},{onConflict:"user_id,date"});
    } catch(e){console.log("avail sync err",e);}
  };

  // ── Tasks ─────────────────────────────────────────────────────────────────
  const addTask = useCallback(async()=>{
    if(!newTask.title.trim())return;
    const supabase = createClient();
    const { data:{ user } } = await supabase.auth.getUser();
    // Optimistic local add
    const localId = Date.now().toString();
    setTasks(prev=>[...prev,{id:localId,title:newTask.title.trim(),date:selectedDate,description:newTask.desc.trim(),done:false,color:newTask.color,openJoin:newTask.open,assignees:newTask.assignees,priority:newTask.priority,location:newTask.location}]);
    setNewTask({title:"",desc:"",color:TASK_COLORS[0],open:true,assignees:[],priority:"medium",location:""}); setShowTaskForm(false);
    // Sync to Supabase
    try {
      const { data, error } = await supabase.from("tasks").insert({
        title:newTask.title.trim(), date:selectedDate, description:newTask.desc.trim(),
        done:false, color:newTask.color, open_join:newTask.open, assignees:newTask.assignees,
        priority:newTask.priority, location:newTask.location, created_by:user?.id
      }).select().single();
      // Replace optimistic id with real id
      if(data) setTasks(p=>p.map(t=>t.id===localId?{...t,id:data.id}:t));
    } catch(e) { console.log("Task sync error:", e); }
  },[newTask,selectedDate]);

  // ── Inventory ─────────────────────────────────────────────────────────────
  const addInventory = useCallback(async()=>{
    if(!newInv.name.trim()||!newInv.total)return;
    const n=parseInt(newInv.total,10); if(isNaN(n)||n<1)return;
    const supabase = createClient();
    const localId = Date.now().toString();
    setInventory(prev=>[...prev,{id:localId,name:newInv.name.trim(),stock:n,total:n,image:newInv.image??newInv.emoji,isEmoji:!newInv.image,category:newInv.category}]);
    setNewInv({name:"",total:"",emoji:"📦",image:null,category:INV_CATS[0]}); setShowInvForm(false);
    try {
      const { data } = await supabase.from("inventory").insert({
        name:newInv.name.trim(), stock:n, total:n,
        image:newInv.image??newInv.emoji, is_emoji:!newInv.image, category:newInv.category
      }).select().single();
      if(data) setInventory(p=>p.map(i=>i.id===localId?{...i,id:data.id}:i));
    } catch(e) { console.log("Inventory sync error:", e); }
  },[newInv]);

  // ── Wiki ──────────────────────────────────────────────────────────────────
  const addWiki = useCallback(()=>{
    if(!newWiki.title.trim())return;
    const page:WikiPage={id:Date.now().toString(),title:newWiki.title.trim(),content:`# ${newWiki.title.trim()}\n\nここに内容を書いてください。`,category:newWiki.cat,updatedAt:new Date().toISOString().split("T")[0],author:currentUserEmail,views:0};
    setWikis(prev=>[...prev,page]); setNewWiki({title:"",cat:WIKI_CATS[0]}); setShowWikiForm(false); setActiveWiki(page);
  },[newWiki,currentUserEmail]);

  // ── Chat ──────────────────────────────────────────────────────────────────
  const sendChat = async()=>{
    if(!chatInput.trim()||chatLoading)return;
    const userMsg:ChatMessage={role:"user",content:chatInput.trim(),ts:Date.now()};
    setChatMessages(prev=>[...prev,userMsg]); setChatInput(""); setChatLoading(true);
    const context=`タスク数:${tasks.length},機材数:${inventory.length},Wikiページ数:${wikis.length},今日:${new Date().toISOString().split("T")[0]},タスク:${tasks.slice(0,5).map(t=>t.title).join(",")}`;
    try {
      const res=await fetch("/api/gemini",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:[...chatMessages,userMsg],context})});
      const data=await res.json();
      const reply = data.reply || data.error || "エラーが発生しました";
      const sources: string[] = data.sources ?? [];
      const fullReply = sources.length > 0
        ? reply + `

🔍 参照: ${sources.slice(0,2).join(', ')}`
        : reply;
      setChatMessages(prev=>[...prev,{role:"assistant",content:fullReply,ts:Date.now()}]);
    } catch { setChatMessages(prev=>[...prev,{role:"assistant",content:"接続エラーが発生しました",ts:Date.now()}]); }
    finally { setChatLoading(false); }
  };

  // ── DM helpers ─────────────────────────────────────────────────────────────
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

  const loadDmHistory = async(member:Member)=>{
    setDmOpen(member);setDmMessages([]);
    try {
      const supabase=createClient();
      const {data:{user}}=await supabase.auth.getUser();
      if(!user)return;
      const channelId=`dm:${[user.id,member.id].sort().join(":")}`;
      const {data}=await supabase.from("messages").select("*").eq("channel_id",channelId).order("created_at",{ascending:true}).limit(50);
      if(data) setDmMessages(data as DmMessage[]);
      supabase.channel(`dm_${channelId.replace(/:/g,"_")}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`channel_id=eq.${channelId}`},(p)=>{
        setDmMessages(prev=>[...prev,p.new as DmMessage]);
      }).subscribe();
    } catch(e){console.log("DM load error:",e);}
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
      // Notify mentioned member (Discord DM + in-app)
      if(mentionMember){
        await fetch("/api/notify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:"mention",targetUserId:mentionMember.id,targetDiscordId:mentionMember.discord_id,channelId:process.env.NEXT_PUBLIC_DISCORD_CHANNEL_ID,message:{title:`🔔 @${user.user_metadata?.full_name||user.email}からメンション`,body:msg.content,data:{}}})});
      }
    } catch(e){console.log("Group msg error:",e);}
  };

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

  // ── Notifications ─────────────────────────────────────────────────────────
  const toggleNotif = async()=>{ if(notifEnabled){setNotifEnabled(false);return;} const g=await reqNotif(); setNotifEnabled(g); if(g) new Notification("AeroSync",{body:"通知が有効になりました！",icon:"/icons/icon-192.png"}); };

  // ── Search ────────────────────────────────────────────────────────────────
  const searchResults = searchQuery.trim().length<1?[]:[
    ...tasks.filter(t=>t.title.includes(searchQuery)||t.description.includes(searchQuery)).map(t=>({type:"task",label:t.title,sub:t.date,tab:"schedule" as Tab,color:t.color,wiki:null as WikiPage|null})),
    ...inventory.filter(i=>i.name.includes(searchQuery)).map(i=>({type:"inventory",label:i.name,sub:`残:${i.stock}/${i.total}`,tab:"inventory" as Tab,color:"#3b82f6",wiki:null})),
    ...wikis.filter(w=>w.title.includes(searchQuery)||w.content.includes(searchQuery)).map(w=>({type:"wiki",label:w.title,sub:w.category,tab:"wiki" as Tab,color:"#8b5cf6",wiki:w})),
  ];

  const completedTasks = tasks.filter(t=>t.done).length;
  const todayTasks = tasks.filter(t=>t.date===new Date().toISOString().split("T")[0]);
  const lowStock = inventory.filter(i=>i.stock<i.total*0.3);

  // ── Loading ────────────────────────────────────────────────────────────────
  if(!isMounted||session===undefined) return (
    <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-300 animate-pulse">
          <span className="text-white font-black text-xl">AS</span>
        </div>
        <div className="flex gap-1.5">{[0,1,2].map(i=><div key={i} className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:`${i*0.15}s`}}/>)}</div>
      </div>
    </div>
  );

  // ── Auth screen ────────────────────────────────────────────────────────────
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

  // ── App ────────────────────────────────────────────────────────────────────
  const userProfile = session.user?.user_metadata??{};
  const displayName = userProfile?.full_name??session.user?.email??"ユーザー";
  const selectedTasks = tasks.filter(t=>t.date===selectedDate);
  const selectedAvail = availability.filter(a=>a.date===selectedDate);

  const renderContent = () => {
    // ── Home ──────────────────────────────────────────────────────────────
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
          {/* Hero greeting section */}
          <div className="relative overflow-hidden px-5 pt-8 pb-6" style={{background:`linear-gradient(160deg, ${appearance.accentColor}18 0%, ${appearance.accentColor}05 60%, transparent 100%)`}}>
            {/* Decorative blobs */}
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none" style={{background:appearance.accentColor, transform:"translate(30%,-30%)"}}/>
            <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full opacity-5 pointer-events-none" style={{background:appearance.accentColor, transform:"translate(-30%,30%)"}}/>

            <div className="relative flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold mb-1" style={{color:appearance.accentColor, opacity:0.7}}>{greeting}</p>
                <div className="flex items-center gap-2 mb-1">
                  <VisualEffectWrapper effect={myVisualEffect}>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight truncate">
                      {(userProfile?.full_name ?? session.user?.email ?? "ユーザー").split("@")[0]}
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
                      {(userProfile?.full_name ?? session.user?.email ?? "U").charAt(0).toUpperCase()}
                    </div>
                }
              </div>
            </div>

            {/* Progress ring + today summary */}
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
            {/* Quick stat cards */}
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

            {/* Today's tasks */}
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
                        <button onClick={()=>setTasks(p=>p.map(x=>x.id===t.id?{...x,done:!x.done}:x))}
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

            {/* My tasks */}
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

            {/* Upcoming */}
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

            {/* Low stock alert */}
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

            {/* Recent Wiki */}
            {recentWikis.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h2 className="text-base font-black text-gray-900 flex items-center gap-1.5"><span>📖</span> 最近のWiki</h2>
                  <button onClick={()=>setActiveTab("wiki")} className="text-xs font-bold" style={{color:appearance.accentColor}}>すべて見る →</button>
                </div>
                <div className="space-y-1.5">
                  {recentWikis.map(w=>(
                    <button key={w.id} onClick={()=>{setWikis(p=>p.map(x=>x.id===w.id?{...x,views:x.views+1}:x));setActiveWiki({...w,views:w.views+1});setActiveTab("wiki");}}
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

            {/* Quick actions */}
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
          </div>
        </div>
      );
    }

        // ── Schedule ──────────────────────────────────────────────────────────
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
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-gray-900">スケジュール</h2>
          {perms.manageTasks&&<button onClick={()=>setShowTaskForm(true)} className="flex items-center gap-1.5 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm transition-all active:scale-95" style={{background:appearance.accentColor}}><Plus size={14}/> タスク追加</button>}
        </div>
        <CalendarView tasks={tasks} availability={availability} onDayClick={setSelectedDate} selectedDate={selectedDate}/>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5"><Users size={14} className="text-blue-500"/> {selectedDate} の参加状況</h3>
          <div className="flex gap-2 mb-3">
            {(["available","maybe","unavailable"] as const).map(s=>(
              <button key={s} onClick={()=>setMyAvail(s)} style={{borderColor:AVAIL_COLORS[s]+(myAvailStatus===s?"":"44"),background:myAvailStatus===s?AVAIL_COLORS[s]+"22":"white",color:AVAIL_COLORS[s]}}
                className="flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-all active:scale-95">{AVAIL_LABELS[s]}</button>
            ))}
          </div>
          {myAvailStatus&&<div className="flex gap-2"><input value={availNote} onChange={e=>setAvailNote(e.target.value)} placeholder="コメント" className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"/><button onClick={()=>setAvailability(p=>p.map(a=>a.userId===currentUserEmail&&a.date===selectedDate?{...a,note:availNote}:a))};
            try{const sb=createClient();const{data:{user}}=await sb.auth.getUser();if(user)await sb.from('availability').update({note:availNote}).eq('user_id',user.id).eq('date',selectedDate);}catch(e){console.log('note sync err',e);}
          }} className="bg-blue-100 text-blue-700 text-xs font-bold px-3 rounded-xl">保存</button></div>}
          {selectedAvail.length>0&&<div className="mt-3 space-y-1.5">{selectedAvail.map(a=><div key={a.userId} className="flex items-center gap-2 text-xs"><div className="w-2 h-2 rounded-full" style={{background:AVAIL_COLORS[a.status]}}/><span className="font-medium text-gray-700 truncate flex-1">{a.name}</span><span style={{color:AVAIL_COLORS[a.status]}} className="font-bold">{AVAIL_LABELS[a.status]}</span>{a.note&&<span className="text-gray-400 truncate max-w-[80px]">{a.note}</span>}</div>)}</div>}
        </div>
        <h3 className="text-sm font-bold text-gray-500">{selectedDate} のタスク</h3>
        {selectedTasks.length===0?<div className="text-center py-8 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">この日はタスクがありません</div>
          :<div className="space-y-2">{selectedTasks.map(task=>(
            <div key={task.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${task.done?"opacity-55":""} ${fadeIn}`} style={{borderColor:task.color+"44",borderLeftWidth:3,borderLeftColor:task.color}}>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-sm font-bold ${task.done?"line-through text-gray-400":"text-gray-900"}`}>{task.title}</span>
                      <Pill color={task.color}>{task.priority==="high"?"🔥高":task.priority==="medium"?"⚡中":"🌿低"}</Pill>
                      {task.assignees.includes(currentUserEmail)&&<Pill color={task.color}>担当</Pill>}
                    </div>
                    {task.description&&<p className="text-xs text-gray-500 line-clamp-2">{task.description}</p>}
                    {task.location&&<div className="flex items-center gap-1 mt-1"><MapPin size={10} className="text-gray-400"/><span className="text-[10px] text-gray-400">{task.location}</span></div>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={async()=>{const newDone=!task.done;setTasks(p=>p.map(t=>t.id===task.id?{...t,done:newDone}:t));try{const sb=createClient();await sb.from('tasks').update({done:newDone}).eq('id',task.id);}catch(e){console.log('done sync err',e);}}} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${task.done?"border-green-500":"border-gray-300 hover:border-green-400"}`} style={task.done?{background:"#22c55e"}:{}}>
                      {task.done&&<Check size={12} className="text-white"/>}
                    </button>
                    {perms.manageTasks&&<button onClick={async()=>{setTasks(p=>p.filter(t=>t.id!==task.id));try{const sb=createClient();await sb.from("tasks").delete().eq("id",task.id);}catch(e){console.log("delete task err",e);}}} className="p-1 text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={14}/></button>}
                  </div>
                </div>
                {task.openJoin&&!task.assignees.includes(currentUserEmail)&&<button onClick={async()=>{const newA=[...task.assignees,currentUserEmail];setTasks(p=>p.map(t=>t.id===task.id?{...t,assignees:newA}:t));try{const sb=createClient();await sb.from('tasks').update({assignees:newA}).eq('id',task.id);}catch(e){console.log('join sync err',e);}}} className="mt-2 w-full py-1.5 rounded-xl text-xs font-bold text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 transition-colors flex items-center justify-center gap-1"><UserPlus size={12}/> タスクに参加</button>}
              </div>
            </div>
          ))}</div>
        }
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
              <div><p className="text-xs font-bold text-gray-500 mb-2">担当者</p><div className="flex gap-2"><input placeholder="メール or 名前" value={newAssignee} onChange={e=>setNewAssignee(e.target.value)} className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/><button onClick={()=>{if(newAssignee.trim()){setNewTask(p=>({...p,assignees:[...p.assignees,newAssignee.trim()]}));setNewAssignee("");}}} className="bg-blue-100 text-blue-700 font-bold text-xs px-3 rounded-xl hover:bg-blue-200 transition-colors">追加</button></div>{newTask.assignees.length>0&&<div className="flex flex-wrap gap-1.5 mt-2">{newTask.assignees.map(a=><span key={a} className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2 py-1 rounded-full">{a}<button onClick={()=>setNewTask(p=>({...p,assignees:p.assignees.filter(x=>x!==a)}))}><X size={10}/></button></span>)}</div>}</div>
              <button onClick={addTask} className="w-full text-white font-bold py-3 rounded-2xl text-sm transition-all active:scale-[0.98]" style={{background:appearance.accentColor}}>タスクを追加</button>
            </div>
          </div>
        )}
      </div>
    );

    // ── Inventory ──────────────────────────────────────────────────────────
    if(activeTab==="inventory") return (
      <div className={`p-4 space-y-4 ${fadeIn}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-gray-900">在庫・設備</h2>
          {perms.manageInventory&&<button onClick={()=>setShowInvForm(true)} className="flex items-center gap-1.5 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm transition-all active:scale-95" style={{background:appearance.accentColor}}><Plus size={14}/> 追加</button>}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {["すべて",...INV_CATS].map(cat=><button key={cat} className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${invFilter===cat?"text-white border-transparent":"bg-white text-gray-500 border-gray-200"}`} style={invFilter===cat?{background:appearance.accentColor}:{}} onClick={()=>setInvFilter(cat)}>{cat}</button>)}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(invFilter==="すべて"?inventory:inventory.filter(i=>i.category===invFilter)).map(item=>(
            <div key={item.id} className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all hover:shadow-md ${fadeIn}`}>
              <div className="relative">
                {item.isEmoji?<div className="h-24 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center text-5xl">{item.image}</div>:<img src={item.image} alt={item.name} className="w-full h-24 object-cover"/>}
                {perms.manageInventory&&<button onClick={()=>setInventory(p=>p.filter(x=>x.id!==item.id))} className="absolute top-1.5 right-1.5 w-6 h-6 bg-white/90 rounded-full flex items-center justify-center text-gray-400 hover:text-red-400 shadow-sm transition-all"><Trash2 size={11}/></button>}
                <div className="absolute top-1.5 left-1.5"><Pill color={appearance.accentColor}>{item.category}</Pill></div>
              </div>
              <div className="p-2.5">
                <p className="text-xs font-bold text-gray-800 truncate mb-1.5">{item.name}</p>
                <div className="flex items-center gap-1 mb-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{width:`${(item.stock/item.total)*100}%`,background:item.stock===0?"#ef4444":item.stock<item.total*0.3?"#f59e0b":appearance.accentColor}}/></div>
                  <span className="text-[10px] font-bold text-gray-500 shrink-0">{item.stock}/{item.total}</span>
                </div>
                {perms.manageInventory&&<div className="flex gap-1"><button onClick={async()=>{const ns=Math.max(0,item.stock-1);setInventory(p=>p.map(x=>x.id===item.id?{...x,stock:ns}:x));try{const sb=createClient();await sb.from('inventory').update({stock:ns}).eq('id',item.id);}catch(e){console.log('inv err',e);}}} className="flex-1 py-1 bg-red-50 text-red-500 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors">−</button><button onClick={async()=>{const ns=Math.min(item.total,item.stock+1);setInventory(p=>p.map(x=>x.id===item.id?{...x,stock:ns}:x));try{const sb=createClient();await sb.from('inventory').update({stock:ns}).eq('id',item.id);}catch(e){console.log('inv err',e);}}} className="flex-1 py-1 bg-green-50 text-green-600 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors">＋</button></div>}
              </div>
            </div>
          ))}
        </div>
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
              <select value={newInv.category} onChange={e=>setNewInv(p=>({...p,category:e.target.value}))} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">{INV_CATS.map(c=><option key={c}>{c}</option>)}</select>
              <button onClick={addInventory} className="w-full text-white font-bold py-3 rounded-2xl text-sm transition-all active:scale-[0.98]" style={{background:appearance.accentColor}}>追加</button>
            </div>
          </div>
        )}
      </div>
    );

    // ── Wiki ──────────────────────────────────────────────────────────────
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
                <button key={w.id} onClick={()=>{setWikis(p=>p.map(x=>x.id===w.id?{...x,views:x.views+1}:x));setActiveWiki({...w,views:w.views+1});}}
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
        </div>
      );
    }

    // ── Members ───────────────────────────────────────────────────────────
    if(activeTab==="members") return (
      <div className={`p-4 space-y-4 ${fadeIn}`}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2"><Users size={20} style={{color:appearance.accentColor}}/> メンバー</h2>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full text-white" style={{background:appearance.accentColor}}>{members.length}人</span>
        </div>

        {/* Group chat */}
        <button onClick={()=>setGroupOpen(true)} className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-3.5 flex items-center gap-3 hover:shadow-md transition-all active:scale-[0.99]">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{background:appearance.accentColor+"22"}}>💬</div>
          <div className="flex-1 text-left">
            <p className="text-sm font-black text-gray-900">グループチャット</p>
            <p className="text-xs text-gray-500">全員へのメッセージ・メンション</p>
          </div>
          <ChevronRight size={16} className="text-gray-300"/>
        </button>

        {/* Members list */}

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
              const localAssignment = memberRoles.find(mr=>mr.email===member.email);
              const effectiveRoleId = localAssignment?.roleId ?? member.role_id ?? "member";
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
                    {!isMe&&(
                      <button onClick={()=>loadDmHistory(member)}
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
                {/* Inline role picker — expands under the card */}
                {canManageRoles && roleChangeTarget===member.id&&(
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">ロールを変更</p>
                    <div className="flex flex-wrap gap-1.5">
                      {roles.map(r=>(
                        <button key={r.id} onClick={async()=>{
                          // Update local state
                          setMemberRoles(p=>[...p.filter(mr=>mr.email!==member.email),{email:member.email||"",roleId:r.id,assignedAt:new Date().toISOString().split("T")[0],assignedBy:currentUserEmail}]);
                          setMembers(p=>p.map(m=>m.id===member.id?{...m,role_id:r.id}:m));
                          setRoleChangeTarget(null);
                          // Sync to Supabase — update role_id in members table
                          // Other clients receive via membersSub realtime channel
                          try {
                            const sb=createClient();
                            const {error} = await sb.from("members").update({role_id:r.id}).eq("id",member.id);
                            if(error) console.error("role update err:", error);
                          } catch(e){console.log("role update err",e);}
                        }}
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

        {/* DM panel */}
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
                <textarea value={dmInput} onChange={e=>setDmInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendDm();}}} placeholder="メッセージを送信... (Shift+Enterで改行)" rows={1} className="flex-1 bg-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:bg-white transition resize-none" style={{maxHeight:"80px",overflowY:"auto"}}/>
                <button onClick={sendDm} disabled={!dmInput.trim()} className="w-9 h-9 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-all active:scale-95" style={{background:appearance.accentColor}}><Send size={14}/></button>
              </div>
            </div>
          </div>
        )}

        {/* Group chat panel */}
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
              {/* Mention target preview */}
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
                <textarea value={groupInput} onChange={e=>setGroupInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendGroupMessage(mentionTarget??undefined);}}} placeholder="全員へメッセージ... (Shift+Enterで改行)" rows={1} className="flex-1 bg-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:bg-white transition resize-none" style={{maxHeight:"80px",overflowY:"auto"}}/>
                <button onClick={()=>sendGroupMessage(mentionTarget??undefined)} disabled={!groupInput.trim()} className="w-9 h-9 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-all active:scale-95" style={{background:appearance.accentColor}}><Send size={14}/></button>
              </div>
            </div>
          </div>
        )}
      </div>
    );

        // ── Settings ──────────────────────────────────────────────────────────
    if(activeTab==="settings") {
      const SETTINGS_TABS: {id:SettingsTab; label:string; icon:React.ReactNode}[] = [
        {id:"profile",label:"プロフィール",icon:<User size={14}/>},
        {id:"roles",label:"ロール",icon:<Shield size={14}/>},
        {id:"appearance",label:"外観",icon:<Palette size={14}/>},
        {id:"notifications",label:"通知",icon:<Bell size={14}/>},
        {id:"privacy",label:"プライバシー",icon:<EyeIcon size={14}/>},
        {id:"data",label:"データ",icon:<Download size={14}/>},
        {id:"about",label:"アプリ情報",icon:<HelpCircle size={14}/>},
      ];

      return (
        <div className={`${fadeIn}`}>
          {/* Settings sidebar nav (horizontal scroll on mobile) */}
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
            {/* Profile */}
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
                  <SectionHeader title="ビジュアルエフェクト"/>
                  <div className="p-4">
                    <p className="text-xs text-gray-500 mb-3">自分の名前に表示されるエフェクトを選択</p>
                    <div className="grid grid-cols-2 gap-2">
                      {VISUAL_EFFECTS.map(ef=>(
                        <button key={ef.id} onClick={()=>setMyVisualEffect(ef.id)}
                          className={`py-2.5 px-3 rounded-xl text-xs font-bold border-2 text-left transition-all ${myVisualEffect===ef.id?"border-blue-500 bg-blue-50 text-blue-700":"border-gray-200 text-gray-600"}`}>
                          {ef.id==="none"?"🚫 なし":ef.label}
                        </button>
                      ))}
                    </div>
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

            {/* Roles */}
            {settingsTab==="roles"&&(
              <>
                {/* ── No-owner bootstrap banner ── */}
                {noOwner && !imAlreadyOwner &&(
                  <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl shrink-0">👑</span>
                      <div className="flex-1">
                        <p className="text-sm font-black text-amber-800 mb-0.5">オーナーがいません</p>
                        <p className="text-xs text-amber-700 leading-relaxed mb-3">現在このアプリにはオーナーロールを持つメンバーがいません。あなたがオーナーになるには、セキュリティコードを入力してください。</p>
                        {!showClaimOwner?(
                          <button onClick={()=>setShowClaimOwner(true)}
                            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all active:scale-95">
                            <Crown size={13}/> オーナーになる
                          </button>
                        ):(
                          <div className="space-y-2">
                            <p className="text-xs text-amber-700 font-medium">セキュリティコード: <span className="font-black">AEROSYNC</span></p>
                            <div className="flex gap-2">
                              <input
                                value={claimOwnerCode}
                                onChange={e=>{setClaimOwnerCode(e.target.value.toUpperCase());setClaimOwnerError("");}}
                                placeholder="コードを入力..."
                                className="flex-1 border border-amber-300 bg-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono tracking-widest uppercase"
                              />
                              <button onClick={()=>{
                                if(claimOwnerCode==="AEROSYNC"){
                                  setMemberRoles(p=>[...p.filter(m=>m.email!==currentUserEmail),{email:currentUserEmail,roleId:"owner",assignedAt:new Date().toISOString().split("T")[0],assignedBy:"system"}]);
                                  setShowClaimOwner(false); setClaimOwnerCode("");
                                } else {
                                  setClaimOwnerError("コードが正しくありません");
                                }
                              }} className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 rounded-xl transition-all active:scale-95">確認</button>
                            </div>
                            {claimOwnerError&&<p className="text-xs text-red-500 font-medium">{claimOwnerError}</p>}
                            <button onClick={()=>{setShowClaimOwner(false);setClaimOwnerCode("");setClaimOwnerError("");}} className="text-xs text-amber-600 font-medium">キャンセル</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
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
                      <button onClick={()=>{
                        if(!assignEmail.trim()||!assignRoleId)return;
                        setMemberRoles(p=>[...p.filter(m=>m.email!==assignEmail.trim()),{email:assignEmail.trim(),roleId:assignRoleId,assignedAt:new Date().toISOString().split("T")[0],assignedBy:currentUserEmail}]);
                        setAssignEmail("");setAssignRoleId("");
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
                              <button onClick={()=>setMemberRoles(p=>p.filter(x=>x.email!==m.email))} className="text-gray-300 hover:text-red-400 transition-colors p-1"><X size={13}/></button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Appearance */}
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

            {/* Notifications */}
            {settingsTab==="notifications"&&(
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
                <SectionHeader title="通知設定"/>
                <SettingsRow icon={notifEnabled?<Bell size={15} className="text-blue-600"/>:<BellOff size={15} className="text-gray-400"/>} iconBg={notifEnabled?"bg-blue-100":"bg-gray-100"} title="プッシュ通知" subtitle={notifEnabled?"通知が有効です":"タップして有効化"} right={<Toggle checked={notifEnabled} onChange={async()=>toggleNotif()} activeColor={appearance.accentColor}/>}/>
                <SettingsRow icon={<Volume2 size={15} className={soundEnabled?"text-green-600":"text-gray-400"}/>} iconBg={soundEnabled?"bg-green-100":"bg-gray-100"} title="サウンド" subtitle="通知音を再生" right={<Toggle checked={soundEnabled} onChange={setSoundEnabled} activeColor={appearance.accentColor}/>}/>
                <SettingsRow icon={<Vibrate size={15} className={hapticsEnabled?"text-orange-600":"text-gray-400"}/>} iconBg={hapticsEnabled?"bg-orange-100":"bg-gray-100"} title="バイブレーション" subtitle="触覚フィードバック" right={<Toggle checked={hapticsEnabled} onChange={setHapticsEnabled} activeColor={appearance.accentColor}/>}/>
                <SettingsRow icon={<Smartphone size={15} className="text-indigo-600"/>} iconBg="bg-indigo-100" title="アプリをインストール" subtitle="ホーム画面に追加してネイティブ体験"/>
              </div>
            )}

            {/* Privacy */}
            {settingsTab==="privacy"&&(
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
                <SectionHeader title="プライバシー設定"/>
                <SettingsRow icon={<EyeOffIcon size={15} className="text-gray-600"/>} iconBg="bg-gray-100" title="プライベートモード" subtitle="他のメンバーからプロフィールを隠す" right={<Toggle checked={privateMode} onChange={setPrivateMode} activeColor={appearance.accentColor}/>}/>
                <SettingsRow icon={<Users size={15} className="text-blue-600"/>} iconBg="bg-blue-100" title="オンラインステータスを表示" subtitle="他のメンバーにオンライン状態を表示" right={<Toggle checked={showOnlineStatus} onChange={setShowOnlineStatus} activeColor={appearance.accentColor}/>}/>
                <SettingsRow icon={<Star size={15} className="text-yellow-600"/>} iconBg="bg-yellow-100" title="参加状況を公開" subtitle="スケジュールの参加状況を全員に表示" right={<Toggle checked={true} onChange={()=>{}} activeColor={appearance.accentColor}/>}/>
              </div>
            )}

            {/* Data */}
            {settingsTab==="data"&&(
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100">
                <SectionHeader title="データ管理"/>
                <SettingsRow icon={<Download size={15} className="text-blue-600"/>} iconBg="bg-blue-100" title="データをエクスポート" subtitle="JSON形式でダウンロード" onClick={()=>{
                  const data=JSON.stringify({tasks,inventory,wikis,roles,memberRoles},null,2);
                  const a=document.createElement("a"); a.href="data:text/json;charset=utf-8,"+encodeURIComponent(data); a.download="aerosync-export.json"; a.click();
                }}/>
                <SettingsRow icon={<Upload size={15} className="text-green-600"/>} iconBg="bg-green-100" title="データをインポート" subtitle="JSONファイルから復元"/>
                <SettingsRow icon={<Copy size={15} className="text-purple-600"/>} iconBg="bg-purple-100" title="データをコピー" subtitle="クリップボードにコピー" onClick={()=>{navigator.clipboard.writeText(JSON.stringify({tasks,inventory,wikis},null,2)).catch(()=>{});}}/>
                {perms.manageTasks&&<SettingsRow icon={<Trash2 size={15} className="text-red-500"/>} iconBg="bg-red-100" title="全データをリセット" subtitle="削除されたデータは復元できません" danger onClick={()=>{if(confirm("全データをリセットしますか？")){setTasks([]);setInventory([]);setWikis([]);}}}/>}
              </div>
            )}

            {/* About */}
            {settingsTab==="about"&&(
              <>
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
      `}</style>

      {/* Particle effect for current user's visual effect */}
      <ParticleEffect effect={myVisualEffect}/>

      {/* Header */}
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

      {/* Auto-update banner */}
      {updateAvailable&&(
        <div className="px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b z-40 relative" style={{background:appearance.accentColor,color:"white"}}>
          <RefreshCw size={13} className="shrink-0 animate-spin"/>
          <span className="flex-1">新しいバージョンが利用可能です</span>
          <button onClick={()=>window.location.reload()}
            className="bg-white rounded-lg px-2.5 py-1 font-black text-xs transition-all active:scale-95"
            style={{color:appearance.accentColor}}>
            今すぐ更新
          </button>
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

      {/* Nav */}
      <nav className="fixed bottom-0 w-full bg-white/90 backdrop-blur-md border-t border-gray-100 z-30" style={{paddingBottom:"env(safe-area-inset-bottom)"}}>
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
          {([{id:"home",Icon:Home,label:"ホーム"},{id:"schedule",Icon:Calendar,label:"予定"},{id:"inventory",Icon:Package,label:"在庫"},{id:"members",Icon:Users,label:"メンバー"},{id:"settings",Icon:Settings,label:"設定"}] as const).map(({id,Icon,label})=>(
            <button key={id} onClick={()=>{setActiveTab(id);setActiveWiki(null);}} className="flex flex-col items-center justify-center w-full h-full gap-0.5 transition-all duration-200" style={{color:activeTab===id?appearance.accentColor:"#9ca3af"}}>
              <div className="p-1.5 rounded-xl transition-all duration-200" style={activeTab===id?{background:appearance.accentColor+"22"}:{}}>
                <Icon size={20} strokeWidth={activeTab===id?2.5:1.8}/>
              </div>
              <span className="text-[10px] font-bold">{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Floating AI button */}
      {!chatOpen&&(
        <button onClick={()=>setChatOpen(true)} style={{animation:"floatPulse 3s ease-in-out infinite",background:appearance.accentColor}} className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl active:scale-90 transition-transform" aria-label="AI">
          <div className="absolute inset-0 rounded-2xl opacity-30" style={{background:appearance.accentColor,animation:"ripple 2.5s ease-out infinite"}}/>
          <Sparkles size={22} className="text-white relative z-10"/>
        </button>
      )}

      {/* Chat panel */}
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
              <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendChat();}}} placeholder="メッセージを入力..." className="flex-1 bg-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:bg-white transition resize-none" style={{"--tw-ring-color":appearance.accentColor} as any}/>
              <button onClick={sendChat} disabled={chatLoading||!chatInput.trim()} className="w-9 h-9 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-all active:scale-95 shadow-sm" style={{background:appearance.accentColor}}>
                <Send size={14}/>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selection tooltip */}
      {selectionTooltip&&(
        <div data-selection-tooltip="true" style={{position:"fixed",left:selectionTooltip.x,top:selectionTooltip.y,transform:"translateX(-50%) translateY(-100%)",zIndex:60,animation:"tooltipIn 0.2s ease-out",pointerEvents:"auto"}}>
          <button onMouseDown={e=>{e.preventDefault(); const q=`次のテキストについて教えてください: "${selectionTooltip.text.slice(0,200)}"`; pendingSendRef.current=true; setChatInput(q); setChatOpen(true); setSelectionTooltip(null); window.getSelection()?.removeAllRanges();}}
            className="flex items-center gap-1.5 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-xl whitespace-nowrap transition-colors" style={{background:"#111827"}}>
            <Sparkles size={11}/> AIに聞く
          </button>
          <div className="w-2.5 h-2.5 rotate-45 mx-auto -mt-1.5 rounded-sm" style={{background:"#111827"}}/>
        </div>
      )}

      {/* Notification panel */}
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

      {/* Search */}
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

      {/* Role editor */}
      {editingRole&&(
        <RoleEditor role={editingRole} onSave={updated=>{setRoles(p=>p.map(r=>r.id===updated.id?updated:r));setEditingRole(null);}} onClose={()=>setEditingRole(null)} onDelete={editingRole.isDefault?undefined:()=>{setRoles(p=>p.filter(r=>r.id!==editingRole.id));setEditingRole(null);}}/>
      )}
      {showNewRoleForm&&(
        <RoleEditor role={{id:Date.now().toString(),name:"新しいロール",color:"#3b82f6",icon:"👤",permissions:{...DEFAULT_PERMISSIONS},isDefault:false,visualEffect:"none",createdAt:new Date().toISOString().split("T")[0]}}
          onSave={r=>{setRoles(p=>[...p,r]);setShowNewRoleForm(false);}} onClose={()=>setShowNewRoleForm(false)}/>
      )}
    </div>
  );
}
