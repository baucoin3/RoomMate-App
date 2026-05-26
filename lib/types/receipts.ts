export interface ReceiptLineItem {
  id: string
  receipt_id: string
  description: string
  amount: number
  quantity: number
}

export interface LineItemSplitRow {
  household_member_id: string
  nickname: string
  percentage: number
}

export type MatchSource = 'catalog' | 'alias' | 'ai' | 'fuzzy' | 'manual' | null

export type SetupMode = 'item' | 'category'

export interface LineItemConfig {
  description: string
  amount: number
  quantity: number
  setupMode: SetupMode
  categoryId: string | null
  useCustomSplit: boolean
  customSplits: LineItemSplitRow[]
  guestSplits: import('@/lib/types/guests').GuestSplitRow[]
  /** When true, member + guest % on this item were manually edited. */
  splitCustomized: boolean
  saveAsHouseholdItem: boolean
  householdItemId: string | null
  resolvedItemName: string | null
  matchSource: MatchSource
  rememberAlias: boolean
  aiNormalizedName?: string | null
  aiSuggestedCategoryName?: string | null
  aiCandidates?: string[]
  categoryAutoMatched: boolean
  itemGroup: string
  configured: boolean
  active: boolean
}

export interface HouseholdItemSummary {
  id: string
  name: string
  default_category_id: string | null
}

export interface Receipt {
  id: string
  household_id: string
  uploaded_by_member_id: string
  image_url: string
  merchant_name: string | null
  receipt_date: string | null
  raw_total: number | null
  created_at: string
  line_items?: ReceiptLineItem[]
}

export interface ReceiptAnalysisLineItem {
  description: string
  amount: number
  quantity: number
  normalized_name?: string | null
  suggested_category_name?: string | null
  probable_names?: string[]
}

export interface ReceiptAnalysis {
  merchant_name: string | null
  receipt_date: string | null
  subtotal: number | null
  tax: number | null
  total: number | null
  suggested_category_name: string | null
  line_items: ReceiptAnalysisLineItem[]
}

export interface SaveReceiptPayload {
  household_id: string
  image_url: string
  merchant_name: string | null
  receipt_date: string | null
  raw_total: number
  ai_extracted_data: ReceiptAnalysis
  line_items: Array<{ description: string; amount: number; quantity: number }>
  category_id: string | null
  description: string
  uploaded_by_member_id: string
  paid_by_member_id?: string
  paid_by_guest_id?: string
  splits: Array<{
    household_member_id?: string
    guest_id?: string
    percentage: number
    calculated_amount: number
  }>
  new_household_items?: Array<{
    name: string
    default_category_id: string | null
    split_overrides?: { member_id: string; percentage: number }[] | null
    initial_aliases?: string[]
    item_group?: string | null
  }>
  alias_inserts?: Array<{ household_item_id: string; display_text: string }>
}

export interface ReceiptLedgerItem extends Receipt {
  expense_id: string | null
  category_name: string | null
}

export interface ReceiptDetailSplit {
  participantType: 'member' | 'guest'
  displayName: string
  amount: number
}

export interface ReceiptDetail {
  id: string
  imageUrl: string | null
  merchantName: string
  receiptDate: string
  rawTotal: number
  categoryName: string | null
  lineItems: { id: string; description: string; amount: number; quantity: number | null }[]
  splits: ReceiptDetailSplit[]
  expenseTotal: number
}
