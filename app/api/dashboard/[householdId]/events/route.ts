import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ERRORS, HOUSEHOLDS, HOUSEHOLD_DASHBOARD } from '@/locales/en'
import type { CalendarCustomEvent } from '@/lib/types/dashboard'

interface RouteParams {
  params: { householdId: string }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { data: membership, error: membershipError } = await supabase
      .from('household_members')
      .select('id')
      .eq('household_id', params.householdId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (membershipError) {
      return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
    }
    if (!membership) {
      return NextResponse.json({ error: HOUSEHOLDS.ERRORS.FORBIDDEN }, { status: 403 })
    }

    const body = (await request.json()) as { date?: unknown; title?: unknown; note?: unknown }

    const date = typeof body.date === 'string' ? body.date.trim() : ''
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'A valid date (YYYY-MM-DD) is required.' }, { status: 400 })
    }
    if (!title) {
      return NextResponse.json({ error: HOUSEHOLD_DASHBOARD.CALENDAR.EVENT_TITLE_REQUIRED }, { status: 400 })
    }
    if (title.length > 100) {
      return NextResponse.json({ error: HOUSEHOLD_DASHBOARD.CALENDAR.EVENT_TITLE_TOO_LONG }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('household_events')
      .insert({
        household_id: params.householdId,
        date,
        title,
        note,
        created_by: membership.id,
      })
      .select('id, date, title, note')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const event: CalendarCustomEvent = {
      id: data.id as string,
      date: data.date as string,
      title: data.title as string,
      note: data.note as string | null,
    }

    return NextResponse.json({ data: event }, { status: 201 })
  } catch (err) {
    console.error('[dashboard/events/POST]', err)
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
