export interface Household {
  id: string
  name: string
  invite_code: string
  created_at: string
  image_url: string | null
}

export interface HouseholdMember {
  id: string
  household_id: string
  user_id: string
  nickname: string | null
  is_rent_owner: boolean
  joined_at: string
}

export interface HouseholdWithMemberCount extends Household {
  member_count: number
}

/** JSON payload returned by `create_household` RPC */
export interface CreateHouseholdRpcResult {
  id: string
  name: string
  invite_code: string
  created_at: string
}

export function isCreateHouseholdRpcResult(value: unknown): value is CreateHouseholdRpcResult {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Record<string, unknown>
  return (
    typeof row.id === 'string'
    && typeof row.name === 'string'
    && typeof row.invite_code === 'string'
    && typeof row.created_at === 'string'
  )
}
