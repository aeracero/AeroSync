import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  console.log("=== [DEBUG] コールバックルートに到達しました ===")
  const requestUrl = new URL(request.url)
  const { searchParams, origin } = requestUrl
  const code = searchParams.get('code')
  const errorFromDiscord = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  console.log("[DEBUG] URL:", request.url)
  console.log("[DEBUG] Auth Code:", code ? "取得成功" : "なし")

  // 1. Discord側でキャンセルやエラーがあった場合
  if (errorFromDiscord) {
    console.error("[DEBUG] Discordからエラーが返されました:", errorFromDiscord, errorDescription)
    return NextResponse.redirect(`${origin}/?error=${errorFromDiscord}&auth_error=${encodeURIComponent(errorDescription || 'Unknown')}`)
  }

  // 2. 正常にコードが送られてきた場合
  if (code) {
    try {
      const cookieStore = await cookies()
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              const val = cookieStore.get(name)?.value
              console.log(`[DEBUG] クッキー読み込み (${name}): ${val ? 'OK' : '見つかりません'}`)
              return val
            },
            set(name: string, value: string, options: CookieOptions) {
              console.log(`[DEBUG] クッキー書き込み (${name})`)
              cookieStore.set({ name, value, ...options })
            },
            remove(name: string, options: CookieOptions) {
              console.log(`[DEBUG] クッキー削除 (${name})`)
              cookieStore.set({ name, value: '', ...options })
            },
          },
        }
      )

      console.log("[DEBUG] Supabaseにコードを送信してセッションと交換します...")
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error("[DEBUG] 🚨セッション交換エラー🚨:", error.name, error.message)
        return NextResponse.redirect(`${origin}/?error=auth_callback_failed&auth_error=${encodeURIComponent(error.message)}`)
      }

      console.log("[DEBUG] 🎉セッション交換成功！ユーザーID:", data.user?.id)
      return NextResponse.redirect(`${origin}/`)
      
    } catch (err: any) {
      console.error("[DEBUG] 🚨予期せぬシステムエラー🚨:", err)
      return NextResponse.redirect(`${origin}/?error=system_error&auth_error=${encodeURIComponent(err.message)}`)
    }
  }

  // コードもエラーもURLに無い場合（直接アクセスなど）
  console.log("[DEBUG] コードがURLに含まれていません。")
  return NextResponse.redirect(`${origin}/?error=no_code_provided&auth_error=${encodeURIComponent("認証コードが見つかりません")}`)
}
