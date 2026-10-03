import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ERRORS, HOUSEHOLDS, DAILY_TASKS } from '@/locales/en'
import { deleteTaskCategory, updateTaskCategory } from '@/lib/services/taskCategories'

interface RouteParams {
  params: { householdId: string; categoryId: string }
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

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    const body = (await request.json()) as { name?: unknown; color?: unknown }
    const payload: { name?: string; color?: string } = {}

    if (typeof body.name === 'string') {
      const name = body.name.trim()
      if (!name) return NextResponse.json({ error: DAILY_TASKS.ERRORS.CATEGORY_NAME_REQUIRED }, { status: 400 })
      payload.name = name
    }

    if (typeof body.color === 'string') {
      payload.color = body.color.trim()
    }

    const { data, error } = await updateTaskCategory(supabase, params.householdId, params.categoryId, payload)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[task-categories/PATCH]', err)
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

    const membership = await verifyMembership(supabase, params.householdId, user.id)
    if (!membership) {
      return NextResponse.json({ error: HOUSEHOLDS.ERRORS.FORBIDDEN }, { status: 403 })
    }

    const { error, inUse, taskTitles } = await deleteTaskCategory(
      supabase,
      params.householdId,
      params.categoryId,
    )

    if (inUse) {
      return NextResponse.json({ error: DAILY_TASKS.ERRORS.CATEGORY_IN_USE, taskTitles }, { status: 409 })
    }
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data: { id: params.categoryId } })
  } catch (err) {
    console.error('[task-categories/DELETE]', err)
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
