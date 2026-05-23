import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Recipe,
  RecipeDetail,
  RecipeTag,
  CreateRecipePayload,
  UpdateRecipePayload,
} from '@/lib/types/recipe'

/**
 * Build a userId → display name map from household_members for a given household.
 * Falls back to a truncated user ID when no nickname is set.
 */
async function buildAuthorMap(
  supabase: SupabaseClient,
  householdId: string,
): Promise<Record<string, string>> {
  const { data: members } = await supabase
    .from('household_members')
    .select('user_id, nickname')
    .eq('household_id', householdId)

  if (!members) return {}

  return members.reduce<Record<string, string>>((acc, m) => {
    acc[m.user_id] = m.nickname ?? m.user_id.slice(0, 8)
    return acc
  }, {})
}

export async function getRecipes(
  supabase: SupabaseClient,
  householdId: string,
): Promise<{ data: Recipe[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('recipes')
    .select('id, name, notes, image_url, created_by, created_at, category_tag, recipe_ingredients(name)')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })

  if (error) return { data: null, error: error.message }

  const authorMap = await buildAuthorMap(supabase, householdId)

  const recipes: Recipe[] = (data ?? []).map((r) => ({
    ...r,
    created_by_name: authorMap[r.created_by] ?? r.created_by.slice(0, 8),
  }))

  return { data: recipes, error: null }
}

export async function getRecipeById(
  supabase: SupabaseClient,
  id: string,
): Promise<{ data: RecipeDetail | null; error: string | null }> {
  const { data, error } = await supabase
    .from('recipes')
    .select(
      'id, name, notes, image_url, created_by, created_at, category_tag, household_id, recipe_ingredients(id, name, quantity, unit), recipe_steps(id, step_number, instruction)',
    )
    .eq('id', id)
    .order('step_number', { referencedTable: 'recipe_steps', ascending: true })
    .single()

  if (error) return { data: null, error: error.message }

  const authorMap = await buildAuthorMap(supabase, data.household_id)

  const recipe: RecipeDetail = {
    ...data,
    created_by_name: authorMap[data.created_by] ?? data.created_by.slice(0, 8),
  }

  return { data: recipe, error: null }
}

export async function createRecipe(
  supabase: SupabaseClient,
  payload: CreateRecipePayload,
  createdBy: string,
): Promise<{ data: { id: string } | null; error: string | null }> {
  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .insert({
      household_id: payload.household_id,
      created_by: createdBy,
      name: payload.name,
      notes: payload.notes ?? null,
      category_tag: payload.category_tag ?? null,
    })
    .select('id')
    .single()

  if (recipeError) return { data: null, error: recipeError.message }

  const ingredientRows = payload.ingredients
    .filter((i) => i.name.trim())
    .map((i) => ({ recipe_id: recipe.id, name: i.name.trim(), quantity: i.quantity ?? null }))

  const stepRows = payload.steps
    .filter((s) => s.instruction.trim())
    .map((s, idx) => ({
      recipe_id: recipe.id,
      step_number: idx + 1,
      instruction: s.instruction.trim(),
    }))

  const [ingResult, stepResult] = await Promise.all([
    ingredientRows.length > 0
      ? supabase.from('recipe_ingredients').insert(ingredientRows)
      : Promise.resolve({ error: null }),
    stepRows.length > 0
      ? supabase.from('recipe_steps').insert(stepRows)
      : Promise.resolve({ error: null }),
  ])

  if (ingResult.error) return { data: null, error: ingResult.error.message }
  if (stepResult.error) return { data: null, error: stepResult.error.message }

  return { data: { id: recipe.id }, error: null }
}

export async function updateRecipe(
  supabase: SupabaseClient,
  id: string,
  payload: UpdateRecipePayload,
): Promise<{ error: string | null }> {
  const updateFields: Record<string, unknown> = {
    name: payload.name,
    notes: payload.notes ?? null,
    category_tag: payload.category_tag ?? null,
  }
  if (payload.image_url !== undefined) {
    updateFields.image_url = payload.image_url
  }

  const { error: recipeError } = await supabase
    .from('recipes')
    .update(updateFields)
    .eq('id', id)

  if (recipeError) return { error: recipeError.message }

  // Full-replace strategy: delete then re-insert ingredients and steps
  const [delIngResult, delStepResult] = await Promise.all([
    supabase.from('recipe_ingredients').delete().eq('recipe_id', id),
    supabase.from('recipe_steps').delete().eq('recipe_id', id),
  ])

  if (delIngResult.error) return { error: delIngResult.error.message }
  if (delStepResult.error) return { error: delStepResult.error.message }

  const ingredientRows = payload.ingredients
    .filter((i) => i.name.trim())
    .map((i) => ({ recipe_id: id, name: i.name.trim(), quantity: i.quantity ?? null }))

  const stepRows = payload.steps
    .filter((s) => s.instruction.trim())
    .map((s, idx) => ({
      recipe_id: id,
      step_number: idx + 1,
      instruction: s.instruction.trim(),
    }))

  const [ingResult, stepResult] = await Promise.all([
    ingredientRows.length > 0
      ? supabase.from('recipe_ingredients').insert(ingredientRows)
      : Promise.resolve({ error: null }),
    stepRows.length > 0
      ? supabase.from('recipe_steps').insert(stepRows)
      : Promise.resolve({ error: null }),
  ])

  if (ingResult.error) return { error: ingResult.error.message }
  if (stepResult.error) return { error: stepResult.error.message }

  return { error: null }
}

export async function deleteRecipe(
  supabase: SupabaseClient,
  id: string,
): Promise<{ error: string | null }> {
  const [ingResult, stepResult] = await Promise.all([
    supabase.from('recipe_ingredients').delete().eq('recipe_id', id),
    supabase.from('recipe_steps').delete().eq('recipe_id', id),
  ])

  if (ingResult.error) return { error: ingResult.error.message }
  if (stepResult.error) return { error: stepResult.error.message }

  const { error } = await supabase.from('recipes').delete().eq('id', id)
  if (error) return { error: error.message }

  return { error: null }
}

export async function getRecipeTags(
  supabase: SupabaseClient,
  householdId: string,
): Promise<{ data: RecipeTag[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('recipe_tags')
    .select('id, household_id, name, created_at')
    .eq('household_id', householdId)
    .order('name', { ascending: true })

  if (error) return { data: null, error: error.message }
  return { data: data as RecipeTag[], error: null }
}

export async function createRecipeTag(
  supabase: SupabaseClient,
  householdId: string,
  name: string,
): Promise<{ data: RecipeTag | null; error: string | null }> {
  const { data, error } = await supabase
    .from('recipe_tags')
    .upsert({ household_id: householdId, name: name.trim() }, { onConflict: 'household_id,name' })
    .select('id, household_id, name, created_at')
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as RecipeTag, error: null }
}
