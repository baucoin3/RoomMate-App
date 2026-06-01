import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, HOUSEHOLDS, ERRORS } from '@/locales/en'
import { getHouseholdsForUser } from '@/lib/services/households'

export async function GET() {
  try {
    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { data, error } = await getHouseholdsForUser(supabase, user.id)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    const { name } = body as { name?: string }

    if (!name?.trim()) {
      return NextResponse.json({ error: HOUSEHOLDS.ERRORS.NAME_REQUIRED }, { status: 400 })
    }

    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { data: household, error: householdError } = await supabase
      .from('households')
      .insert({ name: name.trim() })
      .select('id, name, invite_code, created_at')
      .single()

    if (householdError || !household) {
      return NextResponse.json({ error: householdError?.message ?? HOUSEHOLDS.ERRORS.CREATE }, { status: 400 })
    }

    const nickname = (user.user_metadata?.full_name as string | undefined)?.trim() || user.email?.split('@')[0] || 'Member'
    const { error: memberError } = await supabase
      .from('household_members')
      .insert({ household_id: household.id, user_id: user.id, is_rent_owner: true, nickname })

    if (memberError) {
      await supabase.from('households').delete().eq('id', household.id)
      return NextResponse.json({ error: memberError.message ?? HOUSEHOLDS.ERRORS.CREATE }, { status: 400 })
    }

    return NextResponse.json({ data: { ...household, image_url: null, member_count: 1 } }, { status: 201 })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
