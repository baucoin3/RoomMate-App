import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, FITNESS } from '@/locales/en'
import { completeSession } from '@/lib/services/fitness'
import { getMemberIdForUser } from '@/lib/services/finances'

export async function PATCH(
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
      return NextResponse.json({ error: FITNESS.ERRORS.COMPLETE_SESSION }, { status: 403 })
    }

    const session = await completeSession(supabase, sessionId, user.id)
    return NextResponse.json({ data: session })
  } catch (err) {
    console.error('[fitness/sessions PATCH]', err)
    return NextResponse.json({ error: FITNESS.ERRORS.COMPLETE_SESSION }, { status: 500 })
  }
}
