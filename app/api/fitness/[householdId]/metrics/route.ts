import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, FITNESS } from '@/locales/en'
import { getProgressMetrics } from '@/lib/services/fitness'
import { getMemberIdForUser } from '@/lib/services/finances'

export async function GET(
  request: Request,
  { params }: { params: { householdId: string } },
) {
  try {
    const { householdId } = params
    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') ?? '0', 10)
    const month = parseInt(searchParams.get('month') ?? '0', 10)

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json({ error: FITNESS.ERRORS.LOAD_METRICS }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const memberId = await getMemberIdForUser(supabase, householdId, user.id)
    if (!memberId) {
      return NextResponse.json({ error: FITNESS.ERRORS.LOAD_METRICS }, { status: 403 })
    }

    const metrics = await getProgressMetrics(supabase, householdId, user.id, year, month)
    return NextResponse.json({ data: metrics })
  } catch (err) {
    console.error('[fitness/metrics GET]', err)
    return NextResponse.json({ error: FITNESS.ERRORS.LOAD_METRICS }, { status: 500 })
  }
}
