import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ERRORS, HOUSEHOLDS, DAILY_TASKS } from '@/locales/en'
import { getDailyTasks, createDailyTask, timeDisplayToTimeOfDay } from '@/lib/services/dailyTasks'
import type { CreateDailyTaskPayload, TaskCategory } from '@/lib/types/dailyTasks'

interface RouteParams {
  params: { householdId: string }
}

const VALID_CATEGORIES: TaskCategory[] = ['fitness', 'home', 'work', 'errands']

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { data: membership } = await supabase
      .from('household_members')
      .select('id')
      .eq('household_id', params.householdId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: HOUSEHOLDS.ERRORS.FORBIDDEN }, { status: 403 })
    }

    const { data, error } = await getDailyTasks(supabase, params.householdId)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[tasks/GET]', err)
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { data: membership } = await supabase
      .from('household_members')
      .select('id')
      .eq('household_id', params.householdId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: HOUSEHOLDS.ERRORS.FORBIDDEN }, { status: 403 })
    }

    const body = (await request.json()) as {
      title?: unknown
      category?: unknown
      timeOfDay?: unknown
      logsToCalendar?: unknown
    }

    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const category = typeof body.category === 'string' ? body.category : ''
    const timeOfDayRaw = typeof body.timeOfDay === 'string' ? body.timeOfDay.trim() : ''
    const logsToCalendar = body.logsToCalendar === true

    if (!title) {
      return NextResponse.json({ error: DAILY_TASKS.ERRORS.TITLE_REQUIRED }, { status: 400 })
    }
    if (!VALID_CATEGORIES.includes(category as TaskCategory)) {
      return NextResponse.json({ error: DAILY_TASKS.ERRORS.CATEGORY_REQUIRED }, { status: 400 })
    }
    if (!timeOfDayRaw) {
      return NextResponse.json({ error: DAILY_TASKS.ERRORS.TIME_REQUIRED }, { status: 400 })
    }

    // Convert display time "6:30 PM" → "18:30:00" if needed
    const timeOfDay = /^\d{2}:\d{2}:\d{2}$/.test(timeOfDayRaw)
      ? timeOfDayRaw
      : timeDisplayToTimeOfDay(timeOfDayRaw)

    const payload: CreateDailyTaskPayload = {
      title,
      category: category as TaskCategory,
      timeOfDay,
      logsToCalendar,
    }

    const { data, error } = await createDailyTask(supabase, params.householdId, user.id, payload)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[tasks/POST]', err)
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
