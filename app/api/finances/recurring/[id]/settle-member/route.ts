import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, FINANCES, ERRORS } from '@/locales/en'
import { settleRecurringMemberForCycle } from '@/lib/services/finances'

interface RouteContext {
  params: { id: string }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body: unknown = await request.json()
    const { household_id, member_id } = body as { household_id?: string; member_id?: string }

    if (!household_id || !member_id) {
      return NextResponse.json({ error: FINANCES.ERRORS.REQUIRED_FIELDS }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { error, status } = await settleRecurringMemberForCycle(
      supabase,
      params.id,
      household_id,
      member_id,
      user.id,
    )

    if (error) {
      return NextResponse.json({ error }, { status: status ?? 400 })
    }

    return NextResponse.json({ data: null })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
