import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ERRORS, HOUSEHOLDS, DAILY_TASKS } from '@/locales/en'
import { getDailyTasks, createDailyTask, timeDisplayToTimeOfDay } from '@/lib/services/dailyTasks'
import type { CreateDailyTaskPayload, TaskScope } from '@/lib/types/dailyTasks'

interface RouteParams {
  params: { householdId: string }
}

const VALID_SCOPES: TaskScope[] = ['personal', 'household']

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

    const { data, error } = await getDailyTasks(supabase, params.householdId, user.id)
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
      scope?: unknown
    }

    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const category = typeof body.category === 'string' ? body.category.trim() : ''
    const timeOfDayRaw = typeof body.timeOfDay === 'string' ? body.timeOfDay.trim() : null
    const logsToCalendar = body.logsToCalendar === true
    const scope = typeof body.scope === 'string' && VALID_SCOPES.includes(body.scope as TaskScope)
      ? (body.scope as TaskScope)
      : 'personal'

    if (!title) {
      return NextResponse.json({ error: DAILY_TASKS.ERRORS.TITLE_REQUIRED }, { status: 400 })
    }
    if (!category) {
      return NextResponse.json({ error: DAILY_TASKS.ERRORS.CATEGORY_REQUIRED }, { status: 400 })
    }

    // Validate category against the household's dynamic category list
    const { count: catCount, error: catCountError } = await supabase
      .from('task_categories')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', params.householdId)
      .eq('name', category)

    if (catCountError) {
      console.error('[tasks/POST] category validation query failed', catCountError)
      return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
    }
    if ((catCount ?? 0) === 0) {
      return NextResponse.json({ error: DAILY_TASKS.ERRORS.CATEGORY_REQUIRED }, { status: 400 })
    }

    // Convert display time "6:30 PM" → "18:30:00", or "HH:MM" → "HH:MM:00", if provided
    let timeOfDay: string | null = null
    if (timeOfDayRaw) {
      if (/^\d{2}:\d{2}:\d{2}$/.test(timeOfDayRaw)) {
        timeOfDay = timeOfDayRaw
      } else if (/^\d{2}:\d{2}$/.test(timeOfDayRaw)) {
        timeOfDay = timeOfDayRaw + ':00'
      } else {
        timeOfDay = timeDisplayToTimeOfDay(timeOfDayRaw)
      }
    }

    const payload: CreateDailyTaskPayload = {
      title,
      category,
      timeOfDay,
      logsToCalendar,
      scope,
    }

    const { data, error } = await createDailyTask(supabase, params.householdId, user.id, payload)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[tasks/POST]', err)
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
