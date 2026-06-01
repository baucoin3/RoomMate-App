import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, ERRORS, MEAL_LOGS } from '@/locales/en'
import { createMealLog, getMealLogsForRecipe } from '@/lib/services/mealLogs'

interface RouteContext {
  params: { id: string }
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const supabase = createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { data, error } = await getMealLogsForRecipe(supabase, params.id, 5)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data: data ?? [] })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const supabase = createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const body = await request.json()
    const { household_id, made_at, notes } = body

    if (!household_id) {
      return NextResponse.json({ error: MEAL_LOGS.ERROR }, { status: 400 })
    }

    const { data, error } = await createMealLog(
      supabase,
      { recipe_id: params.id, household_id, made_at, notes },
      user.id,
    )
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
