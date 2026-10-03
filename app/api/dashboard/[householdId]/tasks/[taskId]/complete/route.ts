import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ERRORS, HOUSEHOLDS } from '@/locales/en'
import { completeDailyTask, uncompleteDailyTask, getCurrentPeriodDate } from '@/lib/services/dailyTasks'

interface RouteParams {
  params: { householdId: string; taskId: string }
}

async function verifyMembership(supabase: ReturnType<typeof createClient>, householdId: string, userId: string) {
  const { data } = await supabase
    .from('household_members')
    .select('id')
    .eq('household_id', householdId)
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const membership = await verifyMembership(supabase, params.householdId, user.id)
    if (!membership) {
      return NextResponse.json({ error: HOUSEHOLDS.ERRORS.FORBIDDEN }, { status: 403 })
    }

    // Optional body.date lets callers complete a specific past/future day (e.g. from calendar)
    let date = getCurrentPeriodDate()
    try {
      const body = await request.json() as { date?: string }
      if (body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) date = body.date
    } catch { /* no body is fine */ }

    const { data, isFullyDone, error } = await completeDailyTask(supabase, params.taskId, user.id, date)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data, isFullyDone }, { status: 201 })
  } catch (err) {
    console.error('[tasks/complete/POST]', err)
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const membership = await verifyMembership(supabase, params.householdId, user.id)
    if (!membership) {
      return NextResponse.json({ error: HOUSEHOLDS.ERRORS.FORBIDDEN }, { status: 403 })
    }

    // Optional ?date=YYYY-MM-DD lets callers uncomplete a specific past day
    const dateParam = request.nextUrl.searchParams.get('date')
    const date =
      dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
        ? dateParam
        : getCurrentPeriodDate()

    const { error } = await uncompleteDailyTask(supabase, params.taskId, user.id, date)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data: null })
  } catch (err) {
    console.error('[tasks/complete/DELETE]', err)
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
