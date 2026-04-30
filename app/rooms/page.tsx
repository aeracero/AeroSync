'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// ──────────────────────────────────────────────
// 型
// ──────────────────────────────────────────────
interface Room {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  created_at: string;
}

type Lang = 'ja' | 'en';

const T = {
  ja: {
    title: '作業部屋 & QRコード管理',
    subtitle: '各部屋のQRコードを印刷して壁に貼ってください',
    addRoom: '部屋を追加',
    roomName: '部屋名',
    roomDesc: '説明（任意）',
    namePlaceholder: 'メインホール',
    descPlaceholder: '1Fの作業スペース',
    save: '保存',
    saving: '保存中...',
    cancel: 'キャンセル',
    print: '印刷 / 保存',
    qrLabel: (name: string) => `${name} の QRコード`,
    qrScan: 'このQRコードをスキャンして作業を報告してください',
    toggle: (active: boolean) => (active ? '無効にする' : '有効にする'),
    delete: '削除',
    confirmDelete: 'この部屋を削除しますか？',
    noRooms: 'まだ部屋がありません。上のボタンから追加してください。',
    loading: '読み込み中...',
    baseUrl: 'ベースURL（デプロイ先に合わせて変更してください）',
    active: '有効',
    inactive: '無効',
  },
  en: {
    title: 'Work Rooms & QR Codes',
    subtitle: 'Print each QR code and post it in the room',
    addRoom: 'Add Room',
    roomName: 'Room Name',
    roomDesc: 'Description (optional)',
    namePlaceholder: 'Main Hall',
    descPlaceholder: 'Work space on 1F',
    save: 'Save',
    saving: 'Saving...',
    cancel: 'Cancel',
    print: 'Print / Save',
    qrLabel: (name: string) => `QR Code for ${name}`,
    qrScan: 'Scan this QR code to submit your work report',
    toggle: (active: boolean) => (active ? 'Disable' : 'Enable'),
    delete: 'Delete',
    confirmDelete: 'Delete this room?',
    noRooms: 'No rooms yet. Click "Add Room" to get started.',
    loading: 'Loading...',
    baseUrl: 'Base URL (change to match your deployment)',
    active: 'Active',
    inactive: 'Inactive',
  },
};

// QRコードを <img> で表示するためのURL生成（外部API使用・ライブラリ不要）
function qrImageUrl(data: string, size = 280): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&format=svg&ecc=M`;
}

// ──────────────────────────────────────────────
// メインコンポーネント
// ──────────────────────────────────────────────
export default function RoomsPage() {
  const supabase = createClient();
  const [lang, setLang] = useState<Lang>('ja');
  const t = T[lang];

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);

  // アプリのベースURL（環境変数またはデフォルト）
  const [baseUrl, setBaseUrl] = useState(
    typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.host}`
      : 'https://aerosync.soarahpa.com'
  );

  const [printRoom, setPrintRoom] = useState<Room | null>(null);

  const loadRooms = async () => {
    const { data } = await supabase
      .from('work_rooms')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setRooms(data);
    setLoading(false);
  };

  useEffect(() => {
    loadRooms();
  }, []);

  // 部屋追加
  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    await supabase.from('work_rooms').insert({
      name: newName.trim(),
      description: newDesc.trim() || null,
      active: true,
    });
    setNewName('');
    setNewDesc('');
    setShowForm(false);
    setSaving(false);
    await loadRooms();
  };

  // 有効/無効切替
  const handleToggle = async (room: Room) => {
    await supabase
      .from('work_rooms')
      .update({ active: !room.active })
      .eq('id', room.id);
    await loadRooms();
  };

  // 削除
  const handleDelete = async (room: Room) => {
    if (!confirm(t.confirmDelete)) return;
    await supabase.from('work_rooms').delete().eq('id', room.id);
    await loadRooms();
  };

  // 印刷
  const handlePrint = (room: Room) => {
    setPrintRoom(room);
    setTimeout(() => window.print(), 300);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">{t.loading}</p>
      </div>
    );
  }

  // ──────── 印刷ビュー ────────
  if (printRoom) {
    const qrUrl = `${baseUrl}/log/${printRoom.id}`;
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 print:p-4">
        <style>{`@media print { .no-print { display: none !important; } }`}</style>
        <div className="border-4 border-gray-800 rounded-3xl p-8 text-center max-w-sm w-full">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">{printRoom.name}</h2>
          {printRoom.description && (
            <p className="text-gray-500 mb-4">{printRoom.description}</p>
          )}
          {/* QRコード */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrImageUrl(qrUrl, 300)}
            alt={t.qrLabel(printRoom.name)}
            className="mx-auto mb-4"
            width={300}
            height={300}
          />
          <p className="text-sm text-gray-600 font-medium">{t.qrScan}</p>
          <p className="text-xs text-gray-400 mt-2 break-all">{qrUrl}</p>
        </div>
        <button
          onClick={() => setPrintRoom(null)}
          className="no-print mt-6 text-blue-500 underline"
        >
          ← 戻る
        </button>
      </div>
    );
  }

  // ──────── メイン画面 ────────
  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 pt-8 pb-6">
        <div className="max-w-3xl mx-auto flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">🏠 {t.title}</h1>
            <p className="text-indigo-200 text-sm mt-1">{t.subtitle}</p>
          </div>
          <button
            onClick={() => setLang((l) => (l === 'ja' ? 'en' : 'ja'))}
            className="bg-white/20 hover:bg-white/30 rounded-xl px-3 py-1.5 text-sm font-medium transition"
          >
            {lang === 'ja' ? 'EN' : 'JP'}
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 mt-6 space-y-6">
        {/* ベースURL設定 */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <p className="text-xs font-semibold text-blue-700 mb-2">⚙️ {t.baseUrl}</p>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="w-full border border-blue-300 rounded-lg p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* 追加ボタン / フォーム */}
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-2xl font-semibold transition flex items-center justify-center gap-2"
          >
            ＋ {t.addRoom}
          </button>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
            <input
              type="text"
              placeholder={t.namePlaceholder}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <input
              type="text"
              placeholder={t.descPlaceholder}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <div className="flex gap-3">
              <button
                onClick={handleAdd}
                disabled={saving || !newName.trim()}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white py-3 rounded-xl font-semibold transition"
              >
                {saving ? t.saving : t.save}
              </button>
              <button
                onClick={() => { setShowForm(false); setNewName(''); setNewDesc(''); }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold transition"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        )}

        {/* 部屋一覧 */}
        {rooms.length === 0 ? (
          <p className="text-center text-gray-400 py-12">{t.noRooms}</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {rooms.map((room) => {
              const qrUrl = `${baseUrl}/log/${room.id}`;
              return (
                <div
                  key={room.id}
                  className={`bg-white rounded-2xl shadow-sm border p-5 flex flex-col items-center gap-3 ${
                    room.active ? 'border-gray-100' : 'border-gray-200 opacity-60'
                  }`}
                >
                  {/* 部屋名 */}
                  <div className="w-full flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-gray-800">{room.name}</h3>
                      {room.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{room.description}</p>
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${
                        room.active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {room.active ? t.active : t.inactive}
                    </span>
                  </div>

                  {/* QRコード */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrImageUrl(qrUrl, 200)}
                    alt={t.qrLabel(room.name)}
                    width={200}
                    height={200}
                    className="rounded-xl"
                  />
                  <p className="text-xs text-gray-400 break-all text-center">{qrUrl}</p>

                  {/* アクション */}
                  <div className="flex gap-2 w-full mt-1">
                    <button
                      onClick={() => handlePrint(room)}
                      className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-2 rounded-xl text-sm font-medium transition"
                    >
                      🖨️ {t.print}
                    </button>
                    <button
                      onClick={() => handleToggle(room)}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-2 rounded-xl text-sm font-medium transition"
                    >
                      {t.toggle(room.active)}
                    </button>
                    <button
                      onClick={() => handleDelete(room)}
                      className="bg-red-50 hover:bg-red-100 text-red-500 px-3 rounded-xl text-sm transition"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
