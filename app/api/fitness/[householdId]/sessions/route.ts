import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, FITNESS } from '@/locales/en'
import { createSession, getActiveSession, autoCompleteStaleSession } from '@/lib/services/fitness'
import { getMemberIdForUser } from '@/lib/services/finances'

export async function GET(
  request: Request,
  { params }: { params: { householdId: string } },
) {
  try {
    const { householdId } = params
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const memberId = await getMemberIdForUser(supabase, householdId, user.id)
    if (!memberId) {
      return NextResponse.json({ error: FITNESS.ERRORS.LOAD_SESSION }, { status: 403 })
    }

    // If year+month provided, return sessions for that month (for calendar day-click)
    if (year && month) {
      const y = parseInt(year, 10)
      const m = parseInt(month, 10)
      const startDate = `${y}-${String(m).padStart(2, '0')}-01`
      const endMonth = m === 12 ? 1 : m + 1
      const endYear = m === 12 ? y + 1 : y
      const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

      const { data, error } = await supabase
        .from('fitness_sessions')
        .select('id, session_date, completed_at')
        .eq('user_id', user.id)
        .gte('session_date', startDate)
        .lt('session_date', endDate)
        .order('session_date', { ascending: true })

      if (error) throw new Error(error.message)
      return NextResponse.json({ data: data ?? [] })
    }

    // Default: auto-complete stale + return today's active session
    const autoCompleted = await autoCompleteStaleSession(supabase, user.id)
    const session = await getActiveSession(supabase, user.id)
    return NextResponse.json({ data: session, autoCompleted })
  } catch (err) {
    console.error('[fitness/sessions GET]', err)
    return NextResponse.json({ error: FITNESS.ERRORS.LOAD_SESSION }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: { householdId: string } },
) {
  try {
    const { householdId } = params
    const body = await request.json() as { routine_id?: string; session_date?: string }

    if (!body.routine_id) {
      return NextResponse.json({ error: FITNESS.ERRORS.LOAD_SESSION }, { status: 400 })
    }
    if (!body.session_date) {
      return NextResponse.json({ error: FITNESS.ERRORS.LOAD_SESSION }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const memberId = await getMemberIdForUser(supabase, householdId, user.id)
    if (!memberId) {
      return NextResponse.json({ error: FITNESS.ERRORS.LOAD_SESSION }, { status: 403 })
    }

    const session = await createSession(
      supabase,
      householdId,
      body.routine_id,
      user.id,
      body.session_date,
    )
    return NextResponse.json({ data: session })
  } catch (err) {
    console.error('[fitness/sessions POST]', err)
    return NextResponse.json({ error: FITNESS.ERRORS.LOAD_SESSION }, { status: 500 })
  }
}
