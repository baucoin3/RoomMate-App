import type { SupabaseClient } from '@supabase/supabase-js'
import type { TaskCategoryRecord, CreateTaskCategoryPayload } from '@/lib/types/taskCategories'

const DEFAULT_CATEGORIES: { name: string; color: string }[] = [
  { name: 'fitness', color: 'oklch(0.734 0.125 289.2)' },
  { name: 'home',    color: 'oklch(0.734 0.125 175)' },
  { name: 'work',    color: 'oklch(0.734 0.125 245)' },
  { name: 'errands', color: 'oklch(0.734 0.125 45)' },
]

export async function getTaskCategories(
  supabase: SupabaseClient,
  householdId: string,
): Promise<{ data: TaskCategoryRecord[] | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('task_categories')
      .select('id, household_id, name, color, created_at')
      .eq('household_id', householdId)
      .order('created_at', { ascending: true })

    if (error) return { data: null, error: error.message }

    if (!data || data.length === 0) {
      // Seed defaults for new households
      const { data: seeded, error: seedError } = await supabase
        .from('task_categories')
        .insert(DEFAULT_CATEGORIES.map((c) => ({ ...c, household_id: householdId })))
        .select('id, household_id, name, color, created_at')

      if (seedError) return { data: null, error: seedError.message }

      return {
        data: (seeded ?? []).map((r) => ({
          id: r.id as string,
          householdId: r.household_id as string,
          name: r.name as string,
          color: r.color as string,
          createdAt: r.created_at as string,
        })),
        error: null,
      }
    }

    return {
      data: data.map((r) => ({
        id: r.id as string,
        householdId: r.household_id as string,
        name: r.name as string,
        color: r.color as string,
        createdAt: r.created_at as string,
      })),
      error: null,
    }
  } catch (err) {
    console.error('[taskCategories/getTaskCategories]', err)
    return { data: null, error: 'Failed to load categories.' }
  }
}

export async function createTaskCategory(
  supabase: SupabaseClient,
  householdId: string,
  payload: CreateTaskCategoryPayload,
): Promise<{ data: TaskCategoryRecord | null; error: string | null; conflict?: boolean }> {
  try {
    const { data, error } = await supabase
      .from('task_categories')
      .insert({ household_id: householdId, name: payload.name.trim(), color: payload.color })
      .select('id, household_id, name, color, created_at')
      .single()

    if (error) {
      // Unique constraint violation
      if (error.code === '23505') return { data: null, error: 'exists', conflict: true }
      return { data: null, error: error.message }
    }

    return {
      data: {
        id: data.id as string,
        householdId: data.household_id as string,
        name: data.name as string,
        color: data.color as string,
        createdAt: data.created_at as string,
      },
      error: null,
    }
  } catch (err) {
    console.error('[taskCategories/createTaskCategory]', err)
    return { data: null, error: 'Failed to create category.' }
  }
}

export async function deleteTaskCategory(
  supabase: SupabaseClient,
  householdId: string,
  categoryId: string,
): Promise<{ error: string | null; inUse?: boolean }> {
  try {
    // Find the category name first
    const { data: cat, error: fetchError } = await supabase
      .from('task_categories')
      .select('name')
      .eq('id', categoryId)
      .eq('household_id', householdId)
      .single()

    if (fetchError || !cat) return { error: 'Category not found.' }

    // Block deletion if any tasks still use this category name
    const { count, error: countError } = await supabase
      .from('daily_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', householdId)
      .eq('category', cat.name as string)

    if (countError) return { error: countError.message }
    if ((count ?? 0) > 0) return { error: 'in_use', inUse: true }

    const { error } = await supabase
      .from('task_categories')
      .delete()
      .eq('id', categoryId)
      .eq('household_id', householdId)

    if (error) return { error: error.message }
    return { error: null }
  } catch (err) {
    console.error('[taskCategories/deleteTaskCategory]', err)
    return { error: 'Failed to delete category.' }
  }
}
