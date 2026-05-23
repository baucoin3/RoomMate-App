import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, HOUSEHOLDS, ERRORS } from '@/locales/en'
import type { HouseholdWithMemberCount } from '@/lib/types/household'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('households')
      .select('id, name, invite_code, created_at, image_url, household_members(count)')
      .eq('id', params.id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: HOUSEHOLDS.ERRORS.NOT_FOUND }, { status: 404 })
    }

    const isMember = await supabase
      .from('household_members')
      .select('id')
      .eq('household_id', params.id)
      .eq('user_id', user.id)
      .single()

    if (isMember.error || !isMember.data) {
      return NextResponse.json({ error: HOUSEHOLDS.ERRORS.FORBIDDEN }, { status: 403 })
    }

    const countRow = data.household_members as unknown as { count: string }[] | null
    const household: HouseholdWithMemberCount = {
      id: data.id,
      name: data.name,
      invite_code: data.invite_code,
      created_at: data.created_at,
      image_url: data.image_url ?? null,
      member_count: parseInt(countRow?.[0]?.count ?? '0', 10),
    }

    return NextResponse.json({ data: household })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const body = await request.json()
    const { image_url } = body

    if (!image_url || typeof image_url !== 'string') {
      return NextResponse.json({ error: HOUSEHOLDS.ERRORS.IMAGE_URL_REQUIRED }, { status: 400 })
    }

    const { data: membership, error: memberError } = await supabase
      .from('household_members')
      .select('id')
      .eq('household_id', params.id)
      .eq('user_id', user.id)
      .single()

    if (memberError || !membership) {
      return NextResponse.json({ error: HOUSEHOLDS.ERRORS.FORBIDDEN }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('households')
      .update({ image_url })
      .eq('id', params.id)
      .select('id, name, invite_code, created_at, image_url')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
