import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ERRORS, HOUSEHOLDS, DAILY_TASKS } from '@/locales/en'
import { getTaskCategories, createTaskCategory } from '@/lib/services/taskCategories'

interface RouteParams {
  params: { householdId: string }
}

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

    const { data, error } = await getTaskCategories(supabase, params.householdId)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[task-categories/GET]', err)
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

    const body = (await request.json()) as { name?: unknown; color?: unknown }

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const color = typeof body.color === 'string' ? body.color.trim() : ''

    if (!name) {
      return NextResponse.json({ error: DAILY_TASKS.ERRORS.CATEGORY_NAME_REQUIRED }, { status: 400 })
    }
    if (!color) {
      return NextResponse.json({ error: 'Color is required.' }, { status: 400 })
    }
    if (name.length > 50) {
      return NextResponse.json({ error: 'Category name must be 50 characters or fewer.' }, { status: 400 })
    }

    const { data, error, conflict } = await createTaskCategory(supabase, params.householdId, { name, color })
    if (conflict) {
      return NextResponse.json({ error: DAILY_TASKS.ERRORS.CATEGORY_EXISTS }, { status: 409 })
    }
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[task-categories/POST]', err)
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
