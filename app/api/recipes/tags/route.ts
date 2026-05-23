import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, RECIPES, ERRORS } from '@/locales/en'
import { getRecipeTags, createRecipeTag } from '@/lib/services/recipes'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const householdId = searchParams.get('householdId')

    if (!householdId) {
      return NextResponse.json({ error: RECIPES.ERRORS.HOUSEHOLD_REQUIRED }, { status: 400 })
    }

    const supabase = createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { data, error } = await getRecipeTags(supabase, householdId)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    const { household_id, name } = body as { household_id?: string; name?: string }

    if (!household_id) {
      return NextResponse.json({ error: RECIPES.ERRORS.HOUSEHOLD_REQUIRED }, { status: 400 })
    }
    if (!name?.trim()) {
      return NextResponse.json({ error: RECIPES.ERRORS.TAG_NAME_REQUIRED }, { status: 400 })
    }

    const supabase = createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { data, error } = await createRecipeTag(supabase, household_id, name.trim())
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
