import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  // URL にエラーが含まれて戻ってきた場合
  const error = searchParams.get('error')
  const error_description = searchParams.get('error_description')
  if (error) {
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(error_description || error)}`)
  }

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value },
          set(name: string, value: string, options: CookieOptions) { cookieStore.set({ name, value, ...options }) },
          remove(name: string, options: CookieOptions) { cookieStore.set({ name, value: '', ...options }) },
        },
      }
    )

    const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
    
    // セッション交換時にエラーが出た場合
    if (sessionError) {
      console.error("Session exchange error:", sessionError.message)
      return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent("コード交換失敗: " + sessionError.message)}`)
    }
    
    // 成功したらトップページへ
    return NextResponse.redirect(`${origin}/`)
  }

  return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent("認証コードが見つかりません")}`)
}