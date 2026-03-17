import { createClient } from '../../../lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  console.log("=== [DEBUG] コールバックルートに到達しました ===")

  const requestUrl = new URL(request.url)
  const { searchParams, origin } = requestUrl
  const code = searchParams.get('code')
  const errorFromDiscord = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  console.log("[DEBUG] URL:", request.url)
  console.log("[DEBUG] Code:", code ? "取得成功" : "なし")

  if (errorFromDiscord) {
    console.error("[DEBUG] Discordエラー:", errorFromDiscord, errorDescription)
    return NextResponse.redirect(
      `${origin}/?error=${errorFromDiscord}&auth_error=${encodeURIComponent(errorDescription || 'Unknown')}`
    )
  }

  if (code) {
    try {
      // Use the proper server client from lib/supabase/server — it handles
      // cookies via getAll/setAll correctly for @supabase/ssr ^0.5.x
      const supabase = await createClient()
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error("[DEBUG] セッション交換エラー:", error.message)
        return NextResponse.redirect(
          `${origin}/?error=auth_callback_failed&auth_error=${encodeURIComponent(error.message)}`
        )
      }

      console.log("[DEBUG] 🎉セッション交換成功！ユーザーID:", data.user?.id)
      return NextResponse.redirect(`${origin}/`)

    } catch (err: any) {
      console.error("[DEBUG] システムエラー:", err)
      return NextResponse.redirect(
        `${origin}/?error=system_error&auth_error=${encodeURIComponent(err.message)}`
      )
    }
  }

  return NextResponse.redirect(
    `${origin}/?error=no_code_provided&auth_error=${encodeURIComponent("認証コードが見つかりません")}`
  )
}
