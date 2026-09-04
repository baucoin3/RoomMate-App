import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ERRORS, HOUSEHOLDS, DAILY_TASKS } from '@/locales/en'
import { updateDailyTask, deleteDailyTask, timeDisplayToTimeOfDay } from '@/lib/services/dailyTasks'
import type { TaskScope } from '@/lib/types/dailyTasks'

interface RouteParams {
  params: { householdId: string; taskId: string }
}

const VALID_SCOPES: TaskScope[] = ['personal', 'household']

async function getMembership(supabase: ReturnType<typeof createClient>, householdId: string, userId: string) {
  return supabase
    .from('household_members')
    .select('id')
    .eq('household_id', householdId)
    .eq('user_id', userId)
    .maybeSingle()
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { data: membership } = await getMembership(supabase, params.householdId, user.id)
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

    const payload: Record<string, unknown> = {}

    if (typeof body.title === 'string') {
      const title = body.title.trim()
      if (!title) return NextResponse.json({ error: DAILY_TASKS.ERRORS.TITLE_REQUIRED }, { status: 400 })
      payload.title = title
    }

    if (typeof body.category === 'string') {
      const category = body.category.trim()
      // Validate against household's actual categories
      const { count } = await supabase
        .from('task_categories')
        .select('id', { count: 'exact', head: true })
        .eq('household_id', params.householdId)
        .eq('name', category)
      if ((count ?? 0) === 0) {
        return NextResponse.json({ error: DAILY_TASKS.ERRORS.CATEGORY_REQUIRED }, { status: 400 })
      }
      payload.category = category
    }

    if ('timeOfDay' in body) {
      const raw = body.timeOfDay
      if (raw === null || raw === '') {
        payload.timeOfDay = null
      } else if (typeof raw === 'string') {
        const s = raw.trim()
        if (/^\d{2}:\d{2}:\d{2}$/.test(s)) {
          payload.timeOfDay = s
        } else if (/^\d{2}:\d{2}$/.test(s)) {
          payload.timeOfDay = s + ':00'
        } else {
          payload.timeOfDay = timeDisplayToTimeOfDay(s)
        }
      }
    }

    if (typeof body.logsToCalendar === 'boolean') {
      payload.logsToCalendar = body.logsToCalendar
    }

    if (typeof body.scope === 'string' && VALID_SCOPES.includes(body.scope as TaskScope)) {
      payload.scope = body.scope as TaskScope
    }

    const { data, error } = await updateDailyTask(
      supabase,
      params.taskId,
      params.householdId,
      user.id,
      payload,
    )
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[tasks/PATCH]', err)
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { data: membership } = await getMembership(supabase, params.householdId, user.id)
    if (!membership) {
      return NextResponse.json({ error: HOUSEHOLDS.ERRORS.FORBIDDEN }, { status: 403 })
    }

    const { error } = await deleteDailyTask(supabase, params.taskId, params.householdId)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data: { id: params.taskId } })
  } catch (err) {
    console.error('[tasks/DELETE]', err)
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
