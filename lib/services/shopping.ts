import type { SupabaseClient } from '@supabase/supabase-js'
import type { ShoppingList, ShoppingListItem } from '@/lib/types/shopping'

/**
 * Fetch all shopping lists visible to the current user within a household:
 * - Household-owned lists (owner_type = 'household', household_id matches)
 * - User-owned lists (owner_type = 'user', user_id matches current user)
 * Each list includes its items, ordered by is_checked ASC then created_at ASC.
 */
export async function getListsForHousehold(
  supabase: SupabaseClient,
  householdId: string,
  userId: string,
): Promise<{ data: ShoppingList[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('shopping_lists')
    .select(
      'id, name, owner_type, user_id, household_id, created_at, shopping_list_items(id, shopping_list_id, name, quantity, unit, is_checked, created_at)',
    )
    .or(
      `and(owner_type.eq.household,household_id.eq.${householdId}),and(owner_type.eq.user,user_id.eq.${userId})`,
    )
    .order('created_at', { ascending: false })
    .order('is_checked', { referencedTable: 'shopping_list_items', ascending: true })
    .order('created_at', { referencedTable: 'shopping_list_items', ascending: true })

  if (error) return { data: null, error: error.message }

  type Row = {
    id: string
    name: string
    owner_type: 'user' | 'household'
    user_id: string | null
    household_id: string
    created_at: string
    shopping_list_items: ShoppingListItem[]
  }

  const lists: ShoppingList[] = (data as unknown as Row[]).map((row) => ({
    id: row.id,
    name: row.name,
    owner_type: row.owner_type,
    user_id: row.user_id,
    household_id: row.household_id,
    created_at: row.created_at,
    items: row.shopping_list_items ?? [],
  }))

  return { data: lists, error: null }
}

/**
 * Fetch all items for a given list, ordered by is_checked ASC, created_at ASC.
 */
export async function getItemsForList(
  supabase: SupabaseClient,
  listId: string,
): Promise<{ data: ShoppingListItem[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('shopping_list_items')
    .select('id, shopping_list_id, name, quantity, unit, is_checked, created_at')
    .eq('shopping_list_id', listId)
    .order('is_checked', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return { data: null, error: error.message }

  return { data: data as ShoppingListItem[], error: null }
}
