import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
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

  // サーバー側から OAuth 認証を開始する
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: {
      redirectTo: `${requestUrl.origin}/auth/callback`,
    },
  })

  if (error) {
    console.error("Auth routing error:", error.message);
    return NextResponse.redirect(`${requestUrl.origin}/?auth_error=${encodeURIComponent(error.message)}`)
  }

  // Supabase が生成した Discord の認証画面 URL へリダイレクト
  if (data.url) {
    return NextResponse.redirect(data.url)
  }

  return NextResponse.redirect(`${requestUrl.origin}/?auth_error=No_URL_returned`)
}