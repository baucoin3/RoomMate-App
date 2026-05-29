import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, ERRORS } from '@/locales/en'

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    const { email, password } = body as { email?: string; password?: string }

    if (!email || !password) {
      return NextResponse.json({ error: AUTH.ERRORS.REQUIRED_FIELDS }, { status: 400 })
    }

    const supabase = createClient()

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json({ user: data.user })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
