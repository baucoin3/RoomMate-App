export interface HouseholdItemAlias {
  id: string
  household_item_id: string
  alias_text: string
  display_text: string
}

export interface HouseholdItem {
  id: string
  household_id: string
  name: string
  default_category_id: string | null
  item_group: string | null
  split_overrides: { member_id: string; percentage: number }[] | null
  image_url?: string | null
  category_name?: string
  aliases?: HouseholdItemAlias[]
}

export interface HouseholdItemWithAliases extends HouseholdItem {
  aliases: HouseholdItemAlias[]
}
