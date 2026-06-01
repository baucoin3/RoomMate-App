import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { AUTH, ERRORS } from '@/locales/en'

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    const { email, password, inviteCode, name } = body as {
      email?: string
      password?: string
      inviteCode?: string
      name?: string
    }

    if (!email || !password || !name?.trim()) {
      return NextResponse.json({ error: AUTH.ERRORS.REQUIRED_FIELDS }, { status: 400 })
    }

    const supabase = createClient()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name.trim() } },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (data.user && data.user.identities?.length === 0) {
      return NextResponse.json({ error: AUTH.ERRORS.DUPLICATE_EMAIL }, { status: 409 })
    }

    if (!data.user) {
      return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
    }

    if (!inviteCode?.trim()) {
      return NextResponse.json({ message: AUTH.MESSAGES.CONFIRM_EMAIL })
    }

    const adminClient = createAdminClient()

    const { data: household, error: householdError } = await adminClient
      .from('households')
      .select('id')
      .eq('invite_code', inviteCode.trim())
      .maybeSingle()

    if (householdError) {
      console.error('[register] invite code lookup failed', householdError)
      return NextResponse.json({
        message: AUTH.MESSAGES.CONFIRM_EMAIL,
        inviteWarning: AUTH.ERRORS.INVITE_INVALID,
      })
    }

    if (!household) {
      return NextResponse.json({
        message: AUTH.MESSAGES.CONFIRM_EMAIL,
        inviteWarning: AUTH.ERRORS.INVITE_INVALID,
      })
    }

    const nickname = name.trim() || email.split('@')[0]

    const { error: memberError } = await adminClient
      .from('household_members')
      .insert({
        household_id: household.id,
        user_id: data.user.id,
        nickname,
        is_rent_owner: false,
      })

    if (memberError) {
      console.error('[register] household_members insert failed', memberError)
      return NextResponse.json({
        message: AUTH.MESSAGES.CONFIRM_EMAIL,
        inviteWarning: AUTH.ERRORS.INVITE_INVALID,
      })
    }

    return NextResponse.json({
      message: AUTH.MESSAGES.CONFIRM_EMAIL,
      inviteMessage: AUTH.MESSAGES.INVITE_JOINED,
    })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
