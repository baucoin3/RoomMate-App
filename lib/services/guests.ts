import type { SupabaseClient } from '@supabase/supabase-js'
import type { HouseholdGuest, HouseholdGuestGroup } from '@/lib/types/guests'

const ACTIVE_FILTER = 'expires_at.is.null,expires_at.gt.now()'

export async function getActiveGuests(
  supabase: SupabaseClient,
  householdId: string,
): Promise<{ data: HouseholdGuest[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('household_guests')
    .select('id, household_id, name, email, expires_at, created_by, created_at')
    .eq('household_id', householdId)
    .or(ACTIVE_FILTER)
    .order('name', { ascending: true })

  if (error) return { data: null, error: error.message }
  return { data: data as HouseholdGuest[], error: null }
}

export async function getAllGuests(
  supabase: SupabaseClient,
  householdId: string,
): Promise<{ data: HouseholdGuest[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('household_guests')
    .select('id, household_id, name, email, expires_at, created_by, created_at')
    .eq('household_id', householdId)
    .order('name', { ascending: true })

  if (error) return { data: null, error: error.message }
  return { data: data as HouseholdGuest[], error: null }
}

export async function createGuest(
  supabase: SupabaseClient,
  householdId: string,
  memberId: string,
  data: { name: string; email?: string | null; expires_at?: string | null },
): Promise<{ data: HouseholdGuest | null; error: string | null }> {
  const { data: row, error } = await supabase
    .from('household_guests')
    .insert({
      household_id: householdId,
      created_by: memberId,
      name: data.name.trim(),
      email: data.email?.trim() || null,
      expires_at: data.expires_at ?? null,
    })
    .select('id, household_id, name, email, expires_at, created_by, created_at')
    .single()

  if (error) return { data: null, error: error.message }
  return { data: row as HouseholdGuest, error: null }
}

export async function updateGuest(
  supabase: SupabaseClient,
  guestId: string,
  data: { name?: string; email?: string | null; expires_at?: string | null },
): Promise<{ data: HouseholdGuest | null; error: string | null }> {
  const patch: Record<string, unknown> = {}
  if (data.name !== undefined) patch.name = data.name.trim()
  if ('email' in data) patch.email = data.email?.trim() || null
  if ('expires_at' in data) patch.expires_at = data.expires_at ?? null

  const { data: row, error } = await supabase
    .from('household_guests')
    .update(patch)
    .eq('id', guestId)
    .select('id, household_id, name, email, expires_at, created_by, created_at')
    .single()

  if (error) return { data: null, error: error.message }
  return { data: row as HouseholdGuest, error: null }
}

export async function deleteGuest(
  supabase: SupabaseClient,
  guestId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('household_guests')
    .delete()
    .eq('id', guestId)

  if (error) return { error: error.message }
  return { error: null }
}

function mapGuestGroupRow(g: Record<string, unknown>): HouseholdGuestGroup {
  const memberJoins = (g.household_guest_group_members ?? []) as Array<{
    household_guests: HouseholdGuest | null
  }>
  return {
    id: g.id as string,
    household_id: g.household_id as string,
    name: g.name as string,
    expires_at: (g.expires_at as string) ?? null,
    created_by: (g.created_by as string) ?? null,
    created_at: g.created_at as string,
    members: memberJoins
      .map((m) => m.household_guests)
      .filter((guest): guest is HouseholdGuest => guest !== null),
  }
}

const GROUP_SELECT =
  'id, household_id, name, expires_at, created_by, created_at, ' +
  'household_guest_group_members(household_guests(id, household_id, name, email, expires_at, created_by, created_at))'

export async function getGuestGroupById(
  supabase: SupabaseClient,
  groupId: string,
): Promise<{ data: HouseholdGuestGroup | null; error: string | null }> {
  const { data, error } = await supabase
    .from('household_guest_groups')
    .select(GROUP_SELECT)
    .eq('id', groupId)
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  if (!data) return { data: null, error: null }
  return { data: mapGuestGroupRow(data as unknown as Record<string, unknown>), error: null }
}

export async function getGuestGroups(
  supabase: SupabaseClient,
  householdId: string,
): Promise<{ data: HouseholdGuestGroup[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('household_guest_groups')
    .select(GROUP_SELECT)
    .eq('household_id', householdId)
    .order('name', { ascending: true })

  if (error) return { data: null, error: error.message }

  const groups = (data ?? []).map((g) =>
    mapGuestGroupRow(g as unknown as Record<string, unknown>),
  )

  return { data: groups, error: null }
}

export async function syncGuestGroupMembers(
  supabase: SupabaseClient,
  groupId: string,
  guestIds: string[],
): Promise<{ error: string | null }> {
  const { data: existing, error: fetchError } = await supabase
    .from('household_guest_group_members')
    .select('guest_id')
    .eq('group_id', groupId)

  if (fetchError) return { error: fetchError.message }

  const existingIds = new Set((existing ?? []).map((row) => row.guest_id as string))
  const targetIds = new Set(guestIds)

  const toAdd = guestIds.filter((id) => !existingIds.has(id))
  const toRemove = [...existingIds].filter((id) => !targetIds.has(id))

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('household_guest_group_members')
      .delete()
      .eq('group_id', groupId)
      .in('guest_id', toRemove)
    if (error) return { error: error.message }
  }

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from('household_guest_group_members')
      .insert(toAdd.map((guest_id) => ({ group_id: groupId, guest_id })))
    if (error) return { error: error.message }
  }

  return { error: null }
}

export async function createGuestGroup(
  supabase: SupabaseClient,
  householdId: string,
  memberId: string,
  data: { name: string; expires_at?: string | null; guest_ids?: string[] },
): Promise<{ data: HouseholdGuestGroup | null; error: string | null }> {
  const { data: row, error } = await supabase
    .from('household_guest_groups')
    .insert({
      household_id: householdId,
      created_by: memberId,
      name: data.name.trim(),
      expires_at: data.expires_at ?? null,
    })
    .select('id, household_id, name, expires_at, created_by, created_at')
    .single()

  if (error) return { data: null, error: error.message }

  const groupId = (row as HouseholdGuestGroup).id
  if (data.guest_ids && data.guest_ids.length > 0) {
    const { error: syncError } = await syncGuestGroupMembers(supabase, groupId, data.guest_ids)
    if (syncError) return { data: null, error: syncError }
  }

  return getGuestGroupById(supabase, groupId)
}

export async function updateGuestGroup(
  supabase: SupabaseClient,
  groupId: string,
  data: { name?: string; expires_at?: string | null; guest_ids?: string[] },
): Promise<{ data: HouseholdGuestGroup | null; error: string | null }> {
  const patch: Record<string, unknown> = {}
  if (data.name !== undefined) patch.name = data.name.trim()
  if ('expires_at' in data) patch.expires_at = data.expires_at ?? null

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase
      .from('household_guest_groups')
      .update(patch)
      .eq('id', groupId)

    if (error) return { data: null, error: error.message }
  }

  if (data.guest_ids !== undefined) {
    const { error: syncError } = await syncGuestGroupMembers(supabase, groupId, data.guest_ids)
    if (syncError) return { data: null, error: syncError }
  }

  return getGuestGroupById(supabase, groupId)
}

export async function deleteGuestGroup(
  supabase: SupabaseClient,
  groupId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('household_guest_groups')
    .delete()
    .eq('id', groupId)

  if (error) return { error: error.message }
  return { error: null }
}

export async function addGuestToGroup(
  supabase: SupabaseClient,
  groupId: string,
  guestId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('household_guest_group_members')
    .insert({ group_id: groupId, guest_id: guestId })

  if (error) return { error: error.message }
  return { error: null }
}

export async function removeGuestFromGroup(
  supabase: SupabaseClient,
  groupId: string,
  guestId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('household_guest_group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('guest_id', guestId)

  if (error) return { error: error.message }
  return { error: null }
}
