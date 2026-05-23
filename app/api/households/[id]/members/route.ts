import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, HOUSEHOLDS, ERRORS } from '@/locales/en'

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

    const { data: membership } = await supabase
      .from('household_members')
      .select('id')
      .eq('household_id', params.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: HOUSEHOLDS.ERRORS.FORBIDDEN }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('household_members')
      .select('id, nickname')
      .eq('household_id', params.id)
      .order('joined_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    type MemberRow = { id: string; nickname: string | null }
    const members = (data as MemberRow[]).map((m) => ({
      id: m.id,
      nickname: m.nickname ?? 'Member',
    }))

    return NextResponse.json({ data: members })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
