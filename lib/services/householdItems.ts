import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeReceiptText } from '@/lib/utils/itemMatching'
import type { HouseholdItem, HouseholdItemAlias } from '@/lib/types/householdItems'

type ItemRow = {
  id: string
  household_id: string
  name: string
  default_category_id: string | null
  item_group: string | null
  split_overrides: { member_id: string; percentage: number }[] | null
  image_url: string | null
  created_at: string
  category: { name: string } | null
  aliases: Array<{
    id: string
    household_item_id: string
    alias_text: string
    display_text: string
  }> | null
}

function mapItemRow(row: ItemRow): HouseholdItem {
  return {
    id: row.id,
    household_id: row.household_id,
    name: row.name,
    default_category_id: row.default_category_id,
    item_group: row.item_group,
    split_overrides: row.split_overrides,
    image_url: row.image_url,
    category_name: row.category?.name,
    aliases: row.aliases ?? [],
  }
}

const ITEM_SELECT = `
  id,
  household_id,
  name,
  default_category_id,
  item_group,
  split_overrides,
  image_url,
  created_at,
  category:expense_categories ( name ),
  aliases:household_item_aliases (
    id,
    household_item_id,
    alias_text,
    display_text
  )
`

export async function getHouseholdItemsForHousehold(
  supabase: SupabaseClient,
  householdId: string,
): Promise<{ data: HouseholdItem[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('household_items')
    .select(ITEM_SELECT)
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })
    .order('name', { ascending: true })

  if (error) return { data: null, error: error.message }

  return { data: (data as unknown as ItemRow[]).map(mapItemRow), error: null }
}

export async function getItemGroupsForHouseholdItems(
  supabase: SupabaseClient,
  householdId: string,
): Promise<{ data: string[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('household_items')
    .select('item_group')
    .eq('household_id', householdId)
    .not('item_group', 'is', null)

  if (error) return { data: null, error: error.message }

  const seen = new Set<string>()
  const groups = ((data ?? []) as { item_group: string | null }[])
    .reduce<string[]>((acc, row) => {
      if (row.item_group && !seen.has(row.item_group)) {
        seen.add(row.item_group)
        acc.push(row.item_group)
      }
      return acc
    }, [])

  return { data: groups.sort(), error: null }
}

export async function createHouseholdItem(
  supabase: SupabaseClient,
  payload: {
    household_id: string
    name: string
    default_category_id?: string | null
    item_group?: string | null
    split_overrides?: { member_id: string; percentage: number }[] | null
  },
): Promise<{ data: HouseholdItem | null; error: string | null }> {
  const { data, error } = await supabase
    .from('household_items')
    .insert({
      household_id: payload.household_id,
      name: payload.name.trim(),
      default_category_id: payload.default_category_id ?? null,
      item_group: payload.item_group ?? null,
      split_overrides: payload.split_overrides ?? null,
    })
    .select(ITEM_SELECT)
    .single()

  if (error) return { data: null, error: error.message }
  return { data: mapItemRow(data as unknown as ItemRow), error: null }
}

export async function updateHouseholdItem(
  supabase: SupabaseClient,
  itemId: string,
  updates: {
    name?: string
    default_category_id?: string | null
    item_group?: string | null
    split_overrides?: { member_id: string; percentage: number }[] | null
  },
): Promise<{ data: HouseholdItem | null; error: string | null }> {
  const patch: Record<string, unknown> = {}
  if (updates.name !== undefined) patch.name = updates.name.trim()
  if (updates.default_category_id !== undefined) patch.default_category_id = updates.default_category_id
  if (updates.item_group !== undefined) patch.item_group = updates.item_group
  if (updates.split_overrides !== undefined) patch.split_overrides = updates.split_overrides

  const { data, error } = await supabase
    .from('household_items')
    .update(patch)
    .eq('id', itemId)
    .select(ITEM_SELECT)
    .single()

  if (error) return { data: null, error: error.message }
  return { data: mapItemRow(data as unknown as ItemRow), error: null }
}

export async function deleteHouseholdItem(
  supabase: SupabaseClient,
  itemId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('household_items').delete().eq('id', itemId)
  return { error: error?.message ?? null }
}

export async function upsertAlias(
  supabase: SupabaseClient,
  payload: {
    household_id: string
    household_item_id: string
    display_text: string
  },
): Promise<{ data: HouseholdItemAlias | null; error: string | null }> {
  const aliasText = normalizeReceiptText(payload.display_text)
  if (!aliasText) {
    return { data: null, error: 'Invalid alias text' }
  }

  const { data, error } = await supabase
    .from('household_item_aliases')
    .upsert(
      {
        household_id: payload.household_id,
        household_item_id: payload.household_item_id,
        alias_text: aliasText,
        display_text: payload.display_text,
      },
      { onConflict: 'household_id,alias_text' },
    )
    .select('id, household_item_id, alias_text, display_text')
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as HouseholdItemAlias, error: null }
}

export async function upsertAliasesBatch(
  supabase: SupabaseClient,
  householdId: string,
  aliases: Array<{ household_item_id: string; display_text: string }>,
): Promise<{ error: string | null }> {
  if (aliases.length === 0) return { error: null }

  const rows = aliases
    .map((a) => ({
      household_id: householdId,
      household_item_id: a.household_item_id,
      alias_text: normalizeReceiptText(a.display_text),
      display_text: a.display_text,
    }))
    .filter((a) => a.alias_text.length > 0)

  if (rows.length === 0) return { error: null }

  const { error } = await supabase
    .from('household_item_aliases')
    .upsert(rows, { onConflict: 'household_id,alias_text' })

  return { error: error?.message ?? null }
}

export async function deleteAlias(
  supabase: SupabaseClient,
  aliasId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('household_item_aliases')
    .delete()
    .eq('id', aliasId)

  return { error: error?.message ?? null }
}
