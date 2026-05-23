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

export interface LineItemConfig {
  description: string
  amount: number
  quantity: number
  categoryId: string | null
  useCustomSplit: boolean
  customSplits: LineItemSplitRow[]
  saveAsHouseholdItem: boolean
  matchedHouseholdItemId: string | null
  configured: boolean
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

export interface ReceiptAnalysis {
  merchant_name: string | null
  receipt_date: string | null
  subtotal: number | null
  tax: number | null
  total: number | null
  suggested_category_name: string | null
  line_items: Array<{ description: string; amount: number; quantity: number }>
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
  paid_by_member_id: string
  splits: Array<{ household_member_id: string; percentage: number; calculated_amount: number }>
  new_household_items?: Array<{ name: string; default_category_id: string | null }>
}

export interface ReceiptLedgerItem extends Receipt {
  expense_id: string | null
  category_name: string | null
}
