// Excel進捗テンプレートの定義と自動修正ユーティリティ

export interface ProgressRow {
  taskName: string
  assignee: string
  priority: 'high' | 'medium' | 'low' | ''
  status: 'todo' | 'in_progress' | 'done' | ''
  progressPct: number
  dueDate: string
  notes: string
}

export const TEMPLATE_COLUMNS = [
  'タスク名',
  '担当者',
  '優先度',
  '状態',
  '進捗(%)',
  '期日',
  '課題・メモ',
] as const

// カラム名のエイリアスマッピング（様々な表記を正規化）
const COLUMN_ALIASES: Record<string, string> = {
  // タスク名
  タスク: 'タスク名', task: 'タスク名', 'task name': 'タスク名', タイトル: 'タスク名', title: 'タスク名',
  // 担当者
  担当: '担当者', 担当メンバー: '担当者', 名前: '担当者', name: '担当者', assignee: '担当者', member: '担当者',
  // 優先度
  priority: '優先度',
  // 状態
  ステータス: '状態', status: '状態', state: '状態',
  // 進捗
  '進捗': '進捗(%)', '進捗率': '進捗(%)', progress: '進捗(%)', '%': '進捗(%)',
  // 期日
  '締め切り': '期日', '締切': '期日', deadline: '期日', 'due date': '期日', due: '期日',
  // 課題・メモ
  '課題': '課題・メモ', メモ: '課題・メモ', note: '課題・メモ', notes: '課題・メモ', memo: '課題・メモ', 備考: '課題・メモ',
}

// 優先度の正規化
function normalizePriority(raw: string): ProgressRow['priority'] {
  const v = String(raw ?? '').toLowerCase().trim()
  if (['high', '高', 'h', '1'].includes(v)) return 'high'
  if (['medium', '中', 'm', '2'].includes(v)) return 'medium'
  if (['low', '低', 'l', '3'].includes(v)) return 'low'
  return ''
}

// 状態の正規化
function normalizeStatus(raw: string): ProgressRow['status'] {
  const v = String(raw ?? '').toLowerCase().trim()
  if (['done', '完了', '○', '済', 'finished', 'complete'].includes(v)) return 'done'
  if (['in_progress', '進行中', '作業中', 'wip', 'doing', 'in progress'].includes(v)) return 'in_progress'
  if (['todo', '未着手', '予定', '未', 'not started', 'pending'].includes(v)) return 'todo'
  return ''
}

// 進捗%の正規化
function normalizeProgress(raw: unknown): number {
  if (typeof raw === 'number') return Math.min(100, Math.max(0, Math.round(raw)))
  const s = String(raw ?? '').replace('%', '').trim()
  const n = parseFloat(s)
  if (isNaN(n)) return 0
  // 0-1 の小数形式を % に変換
  if (n > 0 && n <= 1) return Math.round(n * 100)
  return Math.min(100, Math.max(0, Math.round(n)))
}

// カラム名の正規化
function normalizeColumnName(raw: string): string {
  const trimmed = String(raw ?? '').trim()
  return COLUMN_ALIASES[trimmed] ?? COLUMN_ALIASES[trimmed.toLowerCase()] ?? trimmed
}

// 生データ（配列の配列）から ProgressRow[] に変換
export function parseExcelData(rawRows: unknown[][]): { rows: ProgressRow[]; warnings: string[] } {
  const warnings: string[] = []
  if (!rawRows || rawRows.length < 2) {
    return { rows: [], warnings: ['データが空か、ヘッダー行のみです'] }
  }

  // ヘッダー行を見つける（最初の行）
  const headerRow = rawRows[0].map((h) => normalizeColumnName(String(h ?? '')))

  const colIndex = (name: string) => headerRow.indexOf(name)

  const idxTask = colIndex('タスク名')
  const idxAssignee = colIndex('担当者')
  const idxPriority = colIndex('優先度')
  const idxStatus = colIndex('状態')
  const idxProgress = colIndex('進捗(%)')
  const idxDue = colIndex('期日')
  const idxNotes = colIndex('課題・メモ')

  if (idxTask === -1) warnings.push('「タスク名」列が見つかりません。自動検出を試みます。')
  if (idxAssignee === -1) warnings.push('「担当者」列が見つかりません。')

  const rows: ProgressRow[] = []

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i]
    const taskName = String(idxTask !== -1 ? (row[idxTask] ?? '') : (row[0] ?? '')).trim()
    if (!taskName) continue  // 空行スキップ

    rows.push({
      taskName,
      assignee: String(idxAssignee !== -1 ? (row[idxAssignee] ?? '') : (row[1] ?? '')).trim(),
      priority: normalizePriority(String(idxPriority !== -1 ? (row[idxPriority] ?? '') : '')),
      status: normalizeStatus(String(idxStatus !== -1 ? (row[idxStatus] ?? '') : '')),
      progressPct: normalizeProgress(idxProgress !== -1 ? row[idxProgress] : 0),
      dueDate: String(idxDue !== -1 ? (row[idxDue] ?? '') : '').trim(),
      notes: String(idxNotes !== -1 ? (row[idxNotes] ?? '') : '').trim(),
    })
  }

  return { rows, warnings }
}

// 集計サマリーを生成
export function summarize(rows: ProgressRow[]) {
  const total = rows.length
  const done = rows.filter((r) => r.status === 'done' || r.progressPct >= 100).length
  const inProgress = rows.filter((r) => r.status === 'in_progress').length
  const todo = rows.filter((r) => r.status === 'todo' || (!r.status && r.progressPct === 0)).length
  const avgProgress = total === 0 ? 0 : Math.round(rows.reduce((s, r) => s + r.progressPct, 0) / total)
  const issues = rows.filter((r) => r.notes.trim() !== '').map((r) => ({
    task: r.taskName,
    assignee: r.assignee,
    note: r.notes,
  }))
  const highPriority = rows.filter((r) => r.priority === 'high' && r.status !== 'done')

  return { total, done, inProgress, todo, avgProgress, issues, highPriority }
}
