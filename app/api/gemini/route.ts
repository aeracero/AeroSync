import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { messages, context } = await req.json()
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'APIキーが設定されていません' }, { status: 500 })

    const systemPrompt = `あなたはAeroSyncというクラブ活動管理アプリのアシスタントです。
現在のアプリデータ:
${context}
親切で簡潔に日本語で答えてください。`

    const contents = [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "わかりました！AeroSyncのアシスタントとして質問にお答えします。" }] },
      ...messages.map((m: any) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.content }] }))
    ]

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({ contents }),
      }
    )
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'エラーが発生しました'
    return NextResponse.json({ reply: text })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}