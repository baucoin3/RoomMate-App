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
