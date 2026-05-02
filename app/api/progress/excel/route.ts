// POST /api/progress/excel
// Excelファイルを受け取り、進捗データとサマリーを返す
// GET /api/progress/excel
// テンプレートExcelファイルを生成してダウンロード
import { NextResponse } from 'next/server'
// @ts-expect-error xlsx ships its own types in some environments
import * as XLSX from 'xlsx'
import { parseExcelData, summarize, TEMPLATE_COLUMNS } from '@/lib/excel-template'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'ファイルが必要です' }, { status: 400 })

    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rawRows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    const { rows, warnings } = parseExcelData(rawRows)
    const summary = summarize(rows)

    return NextResponse.json({ rows, summary, warnings })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function GET() {
  // テンプレートExcelを生成
  const wb = XLSX.utils.book_new()

  const templateData = [
    [...TEMPLATE_COLUMNS],
    ['UIリデザイン', '田中太郎', '高', '進行中', 60, '2026-05-10', 'ボタンの色が未決定'],
    ['APIドキュメント整備', '山田花子', '中', '未着手', 0, '2026-05-15', ''],
    ['バグ修正 #42', '鈴木次郎', '高', '完了', 100, '2026-05-05', ''],
  ]

  const ws = XLSX.utils.aoa_to_sheet(templateData)

  // カラム幅を設定
  ws['!cols'] = [
    { wch: 25 }, // タスク名
    { wch: 12 }, // 担当者
    { wch: 8 },  // 優先度
    { wch: 10 }, // 状態
    { wch: 8 },  // 進捗(%)
    { wch: 12 }, // 期日
    { wch: 30 }, // 課題・メモ
  ]

  XLSX.utils.book_append_sheet(wb, ws, '進捗管理')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="aerosync_progress_template.xlsx"',
    },
  })
}
