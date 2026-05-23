export interface ShoppingList {
  id: string
  name: string
  owner_type: 'user' | 'household'
  user_id: string | null
  household_id: string
  created_at: string
  items?: ShoppingListItem[]
}

export interface ShoppingListItem {
  id: string
  shopping_list_id: string
  name: string
  quantity: number | null
  unit: string | null
  is_checked: boolean
  created_at: string
}

export interface HouseholdItemSuggestion {
  id: string
  name: string
  default_category_id: string | null
}
