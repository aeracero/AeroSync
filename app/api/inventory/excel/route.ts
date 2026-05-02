// GET /api/inventory/excel
// 在庫テンプレートExcelを生成してダウンロード
import { NextResponse } from 'next/server'
// @ts-expect-error xlsx ships its own types in some environments
import * as XLSX from 'xlsx'

const COLUMNS = ['機材名', '総数', '在庫', 'カテゴリ', '絵文字']

const EXAMPLES = [
  ['SONYα7III', 3, 3, 'カメラ', '📷'],
  ['マイク（ダイナミック）', 5, 4, '音響', '🎤'],
  ['LEDパネルライト', 8, 6, '照明', '💡'],
  ['三脚', 10, 10, 'カメラ', '📐'],
  ['HDMIケーブル 3m', 15, 12, 'その他', '🔌'],
]

const NOTES = [
  ['カテゴリ: カメラ / 音響 / 照明 / その他（自由入力可）'],
  ['絵文字: 任意の絵文字を入力 (例: 📷 🎤 💡)'],
  ['在庫: 省略すると総数と同じ値になります'],
]

export async function GET() {
  const wb = XLSX.utils.book_new()

  const ws = XLSX.utils.aoa_to_sheet([[...COLUMNS], ...EXAMPLES])
  ws['!cols'] = [
    { wch: 25 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 8 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, '在庫管理')

  const wsNote = XLSX.utils.aoa_to_sheet([['記入の注意事項'], ...NOTES])
  wsNote['!cols'] = [{ wch: 45 }]
  XLSX.utils.book_append_sheet(wb, wsNote, '記入方法')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="aerosync_inventory_template.xlsx"',
    },
  })
}

export async function POST() {
  return NextResponse.json({ error: 'Use GET to download the template' }, { status: 405 })
}
