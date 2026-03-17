// lib/supabase.ts
// IMPORTANT: Do NOT export a singleton client here.
// Always call createBrowserClient() inside your component or handler.
// A module-level singleton shares state across requests and loses the
// PKCE code_verifier cookie before the callback route can read it.

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
