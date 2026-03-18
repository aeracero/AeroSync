import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { messages, context } = await req.json()
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'APIキーが設定されていません' }, { status: 500 })

    const systemPrompt = `あなたはAeroSyncというクラブ活動管理アプリのアシスタントです。
現在のアプリデータ:
${context}
親切で簡潔に日本語で答えてください。必要に応じてGoogle検索を使って最新情報も提供してください。`

    const contents = [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "わかりました！AeroSyncのアシスタントとして質問にお答えします。必要なら検索も活用します。" }] },
      ...messages.map((m: any) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }]
      }))
    ]

    // Use gemini-2.5-pro with Google Search grounding tool
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-preview-05-06:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents,
          tools: [{ google_search: {} }],
          generation_config: {
            temperature: 1,
            top_p: 0.95,
            max_output_tokens: 8192,
          }
        }),
      }
    )

    if (!res.ok) {
      const errBody = await res.text()
      console.error('Gemini API error:', res.status, errBody)
      // Fallback to gemini-2.0-flash if 2.5-pro fails (quota / availability)
      const fallback = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({ contents }),
        }
      )
      const fallbackData = await fallback.json()
      const text = fallbackData.candidates?.[0]?.content?.parts?.[0]?.text ?? 'エラーが発生しました'
      return NextResponse.json({ reply: text, model: 'gemini-2.0-flash (fallback)' })
    }

    const data = await res.json()

    // Extract text — may be spread across multiple parts if search was used
    const parts = data.candidates?.[0]?.content?.parts ?? []
    const text = parts
      .filter((p: any) => p.text)
      .map((p: any) => p.text)
      .join('') || 'エラーが発生しました'

    // Extract search grounding sources if present
    const groundingMeta = data.candidates?.[0]?.grounding_metadata
    const sources: string[] = groundingMeta?.search_entry_point?.rendered_content
      ? []
      : (groundingMeta?.grounding_chunks ?? [])
          .map((c: any) => c.web?.uri)
          .filter(Boolean)
          .slice(0, 3)

    return NextResponse.json({
      reply: text,
      sources,
      model: 'gemini-2.5-pro'
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
