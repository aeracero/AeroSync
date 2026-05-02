// GET /api/schedule/excel
// スケジュールテンプレートExcelを生成してダウンロード
import { NextResponse } from 'next/server'
// @ts-expect-error xlsx ships its own types in some environments
import * as XLSX from 'xlsx'

const COLUMNS = ['タスク名', '日付', '説明', '優先度', '場所', 'カラー', '担当者（カンマ区切り）', '繰り返し']

const EXAMPLES = [
  ['プロモーション動画撮影', '2026-05-10', 'メインホールで実施', 'high', 'メインホール', '#3b82f6', '田中太郎,山田花子', 'none'],
  ['機材チェック', '2026-05-12', '撮影前の動作確認', 'medium', '機材室', '#10b981', '鈴木次郎', 'weekly'],
  ['振り返りミーティング', '2026-05-15', '先月の反省と来月の計画', 'low', 'ミーティングルーム', '#8b5cf6', '', 'monthly'],
]

const NOTES = [
  ['優先度: low / medium / high'],
  ['カラー: 16進数カラーコード (#3b82f6 など)'],
  ['繰り返し: none / weekly / monthly'],
  ['日付: YYYY-MM-DD 形式 (例: 2026-05-10)'],
]

export async function GET() {
  const wb = XLSX.utils.book_new()

  // メインシート
  const ws = XLSX.utils.aoa_to_sheet([[...COLUMNS], ...EXAMPLES])
  ws['!cols'] = [
    { wch: 25 }, { wch: 12 }, { wch: 30 }, { wch: 10 },
    { wch: 15 }, { wch: 12 }, { wch: 25 }, { wch: 10 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, 'スケジュール')

  // 説明シート
  const wsNote = XLSX.utils.aoa_to_sheet([['記入の注意事項'], ...NOTES])
  wsNote['!cols'] = [{ wch: 40 }]
  XLSX.utils.book_append_sheet(wb, wsNote, '記入方法')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="aerosync_schedule_template.xlsx"',
    },
  })
}

export async function POST() {
  return NextResponse.json({ error: 'Use GET to download the template' }, { status: 405 })
}
