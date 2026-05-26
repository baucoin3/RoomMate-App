export interface HouseholdGuest {
  id: string
  household_id: string
  name: string
  email: string | null
  expires_at: string | null
  created_by: string | null
  created_at: string
}

export interface HouseholdGuestGroup {
  id: string
  household_id: string
  name: string
  expires_at: string | null
  created_by: string | null
  created_at: string
  members?: HouseholdGuest[]
}

export interface SplitParticipant {
  id: string
  displayName: string
  type: 'member' | 'guest'
  email?: string | null
}

export interface GuestSplitRow {
  guest_id: string
  name: string
  percentage: number
}
