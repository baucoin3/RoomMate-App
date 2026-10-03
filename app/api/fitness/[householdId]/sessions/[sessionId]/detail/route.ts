import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, FITNESS } from '@/locales/en'
import { getSessionDayDetail } from '@/lib/services/fitness'
import { getMemberIdForUser } from '@/lib/services/finances'

export async function GET(
  _request: Request,
  { params }: { params: { householdId: string; sessionId: string } },
) {
  try {
    const { householdId, sessionId } = params

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const memberId = await getMemberIdForUser(supabase, householdId, user.id)
    if (!memberId) {
      return NextResponse.json({ error: FITNESS.ERRORS.LOAD_SESSION }, { status: 403 })
    }

    const detail = await getSessionDayDetail(supabase, sessionId, user.id)
    return NextResponse.json({ data: detail })
  } catch (err) {
    console.error('[fitness/sessions/detail GET]', err)
    return NextResponse.json({ error: FITNESS.ERRORS.LOAD_SESSION_DETAIL }, { status: 500 })
  }
}
