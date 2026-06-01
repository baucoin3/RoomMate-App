import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, HOUSEHOLDS, ERRORS } from '@/locales/en'
import { joinHouseholdByInviteCode } from '@/lib/services/households'

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    const { invite_code } = body as { invite_code?: string }

    if (!invite_code?.trim()) {
      return NextResponse.json({ error: HOUSEHOLDS.ERRORS.INVITE_INVALID }, { status: 400 })
    }

    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const displayName = (user.user_metadata?.full_name as string | undefined)?.trim() || undefined

    const { data, error } = await joinHouseholdByInviteCode(
      supabase,
      invite_code,
      user.id,
      user.email ?? '',
      displayName,
    )

    if (error) {
      const status =
        error === HOUSEHOLDS.ERRORS.INVITE_INVALID ? 404
        : error === HOUSEHOLDS.ERRORS.ALREADY_MEMBER ? 409
        : 400
      return NextResponse.json({ error }, { status })
    }

    return NextResponse.json({ data }, { status: 200 })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
