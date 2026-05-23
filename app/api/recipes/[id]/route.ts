import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { AUTH, RECIPES, ERRORS } from '@/locales/en'
import { getRecipeById, deleteRecipe, updateRecipe } from '@/lib/services/recipes'
import type { UpdateRecipePayload } from '@/lib/types/recipe'

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

    const { data, error } = await getRecipeById(supabase, params.id)
    if (error) return NextResponse.json({ error }, { status: 400 })
    if (!data) return NextResponse.json({ error: RECIPES.ERRORS.NOT_FOUND }, { status: 404 })

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const body = await request.json()
    const { name, notes, category_tag, image_url, ingredients, steps } = body as Partial<UpdateRecipePayload>

    if (!name?.trim()) {
      return NextResponse.json({ error: RECIPES.ERRORS.NAME_REQUIRED }, { status: 400 })
    }
    if (!Array.isArray(ingredients) || !Array.isArray(steps)) {
      return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 400 })
    }

    const supabase = createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const payload: UpdateRecipePayload = {
      name: name.trim(),
      notes: notes?.trim() || null,
      category_tag: category_tag?.trim() || null,
      image_url,
      ingredients,
      steps,
    }

    const { error } = await updateRecipe(supabase, params.id, payload)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data: { id: params.id } })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const supabase = createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: AUTH.ERRORS.UNAUTHORIZED }, { status: 401 })
    }

    const { error } = await deleteRecipe(supabase, params.id)
    if (error) return NextResponse.json({ error }, { status: 400 })

    return NextResponse.json({ data: null }, { status: 200 })
  } catch {
    return NextResponse.json({ error: ERRORS.INTERNAL }, { status: 500 })
  }
}
