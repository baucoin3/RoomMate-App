import type { SupabaseClient } from '@supabase/supabase-js'
import type { HouseholdWithMemberCount } from '@/lib/types/household'
import { HOUSEHOLDS } from '@/locales/en'
import { createAdminClient } from '@/lib/supabase/admin'

export async function getHouseholdsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: HouseholdWithMemberCount[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('household_members')
    .select('household_id, households(id, name, invite_code, created_at, image_url, household_members(count))')
    .eq('user_id', userId)

  if (error) return { data: null, error: error.message }

  type HouseholdsRow = {
    household_id: string
    households: {
      id: string
      name: string
      invite_code: string
      created_at: string
      image_url: string | null
      household_members: { count: number }[]
    } | null
  }

  const households: HouseholdWithMemberCount[] = (data as unknown as HouseholdsRow[])
    .map((row) => {
      const h = row.households
      return {
        id: h?.id ?? '',
        name: h?.name ?? '',
        invite_code: h?.invite_code ?? '',
        created_at: h?.created_at ?? '',
        image_url: h?.image_url ?? null,
        member_count: h?.household_members?.[0]?.count ?? 0,
      }
    })
    .filter((h) => h.id !== '')

  return { data: households, error: null }
}

export async function joinHouseholdByInviteCode(
  supabase: SupabaseClient,
  inviteCode: string,
  userId: string,
  userEmail: string,
): Promise<{ data: HouseholdWithMemberCount | null; error: string | null }> {
  const adminClient = createAdminClient()
  const { data: household, error: householdError } = await adminClient
    .from('households')
    .select('id, name, invite_code, created_at, image_url')
    .eq('invite_code', inviteCode.trim())
    .maybeSingle()

  if (householdError) return { data: null, error: householdError.message }
  if (!household) return { data: null, error: HOUSEHOLDS.ERRORS.INVITE_INVALID }

  const { data: existing } = await supabase
    .from('household_members')
    .select('id')
    .eq('household_id', household.id)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) return { data: null, error: HOUSEHOLDS.ERRORS.ALREADY_MEMBER }

  const nickname = userEmail.split('@')[0] ?? 'Member'
  const { error: insertError } = await supabase
    .from('household_members')
    .insert({ household_id: household.id, user_id: userId, nickname, is_rent_owner: false })

  if (insertError) return { data: null, error: insertError.message }

  const { count } = await supabase
    .from('household_members')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', household.id)

  return {
    data: {
      id: household.id,
      name: household.name,
      invite_code: household.invite_code,
      created_at: household.created_at,
      image_url: household.image_url ?? null,
      member_count: count ?? 0,
    },
    error: null,
  }
}
