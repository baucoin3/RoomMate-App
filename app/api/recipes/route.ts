import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, RECIPES, ERRORS } from '@/locales/en'
import { createRecipe, getRecipes } from '@/lib/services/recipes'
import type { CreateRecipePayload } from '@/lib/types/recipe'

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

    const { data, error } = await getRecipes(supabase, householdId)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    const { name, notes, category_tag, household_id, ingredients, steps } =
      body as Partial<CreateRecipePayload>

    if (!name?.trim()) {
      return NextResponse.json({ error: RECIPES.ERRORS.NAME_REQUIRED }, { status: 400 })
    }
    if (!household_id) {
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

    const createdBy = user.id

    const payload: CreateRecipePayload = {
      name: name.trim(),
      notes: notes ?? null,
      category_tag: category_tag ?? null,
      household_id,
      ingredients: ingredients ?? [],
      steps: steps ?? [],
    }

    const { data, error } = await createRecipe(supabase, payload, createdBy)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
