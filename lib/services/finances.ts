import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ExpenseCategory,
  HouseholdItemRule,
  RecurringExpense,
  BalanceSummary,
  UpcomingBill,
  ActivityItem,
} from '@/lib/types/finances'

// ─── Helper ────────────────────────────────────────────────────────────────

function getLastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function getMonthlyDueDate(year: number, monthIndex: number, dayOfMonth: number): Date {
  return new Date(year, monthIndex, Math.min(dayOfMonth, getLastDayOfMonth(year, monthIndex)))
}

export async function getMemberIdForUser(
  supabase: SupabaseClient,
  householdId: string,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('household_members')
    .select('id')
    .eq('household_id', householdId)
    .eq('user_id', userId)
    .maybeSingle()
  return data?.id ?? null
}

// ─── Categories ────────────────────────────────────────────────────────────

export async function getCategoriesForHousehold(
  supabase: SupabaseClient,
  householdId: string,
): Promise<{ data: ExpenseCategory[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('expense_categories')
    .select(`
      id,
      household_id,
      name,
      paid_by_member_id,
      payer:household_members!paid_by_member_id ( id, nickname ),
      splits:category_splits (
        id,
        category_id,
        household_member_id,
        percentage,
        member:household_members ( id, nickname )
      )
    `)
    .eq('household_id', householdId)
    .order('name', { ascending: true })

  if (error) return { data: null, error: error.message }

  return { data: data as unknown as ExpenseCategory[], error: null }
}

// ─── Item rules ────────────────────────────────────────────────────────────

export async function getItemRulesForHousehold(
  supabase: SupabaseClient,
  householdId: string,
): Promise<{ data: HouseholdItemRule[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('household_item_rules')
    .select(`
      id,
      household_id,
      category_id,
      name,
      item_group,
      split_overrides,
      category:expense_categories ( name )
    `)
    .eq('household_id', householdId)
    .order('item_group', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true })

  if (error) return { data: null, error: error.message }

  type Row = {
    id: string
    household_id: string
    category_id: string | null
    name: string
    item_group: string | null
    split_overrides: { member_id: string; percentage: number }[] | null
    category: { name: string } | null
  }

  const rules: HouseholdItemRule[] = (data as unknown as Row[]).map((r) => ({
    id: r.id,
    household_id: r.household_id,
    category_id: r.category_id,
    category_name: r.category?.name,
    name: r.name,
    item_group: r.item_group,
    split_overrides: r.split_overrides,
  }))

  return { data: rules, error: null }
}

export async function getItemGroupsForHousehold(
  supabase: SupabaseClient,
  householdId: string,
): Promise<{ data: string[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('household_item_rules')
    .select('item_group')
    .eq('household_id', householdId)
    .not('item_group', 'is', null)

  if (error) return { data: null, error: error.message }

  type Row = { item_group: string | null }
  const seen = new Set<string>()
  const groups: string[] = []
  for (const r of data as unknown as Row[]) {
    if (r.item_group && !seen.has(r.item_group)) {
      seen.add(r.item_group)
      groups.push(r.item_group)
    }
  }
  return { data: groups.sort(), error: null }
}

// ─── Recurring expenses ────────────────────────────────────────────────────

export async function getRecurringExpensesForHousehold(
  supabase: SupabaseClient,
  householdId: string,
): Promise<{ data: RecurringExpense[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('recurring_expenses')
    .select(`
      id,
      household_id,
      category_id,
      description,
      amount,
      paid_by_member_id,
      due_day_of_month,
      alert_days_before,
      is_active,
      payer:household_members!paid_by_member_id ( id, nickname ),
      category:expense_categories ( name ),
      splits:recurring_expense_splits (
        id,
        recurring_expense_id,
        household_member_id,
        percentage,
        amount,
        member:household_members ( id, nickname )
      )
    `)
    .eq('household_id', householdId)
    .order('description', { ascending: true })

  if (error) return { data: null, error: error.message }

  type Row = {
    id: string
    household_id: string
    category_id: string | null
    description: string
    amount: number
    paid_by_member_id: string
    due_day_of_month: number
    alert_days_before: number
    is_active: boolean
    payer: { id: string; nickname: string } | null
    category: { name: string } | null
    splits: {
      id: string
      recurring_expense_id: string
      household_member_id: string
      percentage: number
      amount: number
      member: { id: string; nickname: string } | null
    }[]
  }

  const expenses: RecurringExpense[] = (data as unknown as Row[]).map((r) => ({
    id: r.id,
    household_id: r.household_id,
    category_id: r.category_id,
    category_name: r.category?.name,
    description: r.description,
    amount: Number(r.amount),
    paid_by_member_id: r.paid_by_member_id,
    payer: r.payer ?? undefined,
    due_day_of_month: r.due_day_of_month,
    alert_days_before: r.alert_days_before,
    is_active: r.is_active,
    splits: r.splits.map((s) => ({
      id: s.id,
      recurring_expense_id: s.recurring_expense_id,
      household_member_id: s.household_member_id,
      percentage: Number(s.percentage),
      amount: Number(s.amount),
      member: s.member ?? undefined,
    })),
  }))

  return { data: expenses, error: null }
}

// ─── Balances ──────────────────────────────────────────────────────────────

export async function getBalanceSummary(
  supabase: SupabaseClient,
  householdId: string,
  currentMemberId: string,
): Promise<{ data: BalanceSummary | null; error: string | null }> {
  const { data: splits, error } = await supabase
    .from('expense_splits')
    .select(`
      household_member_id,
      calculated_amount,
      is_settled,
      expenses!inner (
        household_id,
        paid_by_member_id,
        category_id,
        expense_categories ( id, name )
      ),
      member:household_members!household_member_id ( id, nickname )
    `)
    .eq('expenses.household_id', householdId)
    .eq('is_settled', false)

  if (error) return { data: null, error: error.message }

  type SplitRow = {
    household_member_id: string
    calculated_amount: number
    is_settled: boolean
    expenses: {
      household_id: string
      paid_by_member_id: string
      category_id: string | null
      expense_categories: { id: string; name: string } | null
    }
    member: { id: string; nickname: string } | null
  }

  type BalanceKey = `${string}::${string}`
  const youOweMap = new Map<BalanceKey, { to_member: { id: string; nickname: string }; category: { id: string; name: string }; amount: number; count: number }>()
  const owedToYouMap = new Map<BalanceKey, { from_member: { id: string; nickname: string }; category: { id: string; name: string }; amount: number; count: number }>()

  const payerIdSet = new Set<string>()
  for (const s of splits as unknown as SplitRow[]) {
    if (s.household_member_id === currentMemberId && s.expenses.paid_by_member_id !== currentMemberId) {
      payerIdSet.add(s.expenses.paid_by_member_id)
    }
  }
  const payerIds = Array.from(payerIdSet)

  const payerMap = new Map<string, { id: string; nickname: string }>()
  if (payerIds.length > 0) {
    const { data: payerRows } = await supabase
      .from('household_members')
      .select('id, nickname')
      .in('id', payerIds)
    for (const p of payerRows ?? []) {
      payerMap.set(p.id, p as { id: string; nickname: string })
    }
  }

  for (const split of splits as unknown as SplitRow[]) {
    const { household_member_id, calculated_amount, expenses: exp, member } = split
    const amount = Number(calculated_amount)
    const category = exp.expense_categories ?? { id: exp.category_id ?? '', name: '' }

    if (exp.paid_by_member_id === currentMemberId && household_member_id !== currentMemberId) {
      const key: BalanceKey = `${household_member_id}::${category.id}`
      const existing = owedToYouMap.get(key)
      owedToYouMap.set(key, {
        from_member: member ?? { id: household_member_id, nickname: 'Unknown' },
        category,
        amount: (existing?.amount ?? 0) + amount,
        count: (existing?.count ?? 0) + 1,
      })
    }

    if (household_member_id === currentMemberId && exp.paid_by_member_id !== currentMemberId) {
      const payer = payerMap.get(exp.paid_by_member_id) ?? { id: exp.paid_by_member_id, nickname: 'Unknown' }
      const key: BalanceKey = `${exp.paid_by_member_id}::${category.id}`
      const existing = youOweMap.get(key)
      youOweMap.set(key, {
        to_member: payer,
        category,
        amount: (existing?.amount ?? 0) + amount,
        count: (existing?.count ?? 0) + 1,
      })
    }
  }

  const you_owe = Array.from(youOweMap.values()).map(({ to_member, category, amount, count }) => ({
    to_member,
    category,
    amount: Math.round(amount * 100) / 100,
    expense_count: count,
  }))

  const owed_to_you = Array.from(owedToYouMap.values()).map(({ from_member, category, amount, count }) => ({
    from_member,
    category,
    amount: Math.round(amount * 100) / 100,
    expense_count: count,
  }))

  return { data: { you_owe, owed_to_you }, error: null }
}

// ─── Upcoming bills ────────────────────────────────────────────────────────

export async function getUpcomingBills(
  supabase: SupabaseClient,
  householdId: string,
  currentMemberId: string,
): Promise<{ data: UpcomingBill[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('recurring_expenses')
    .select(`
      id,
      description,
      amount,
      due_day_of_month,
      paid_by_member_id,
      alert_days_before,
      payer:household_members!paid_by_member_id ( id, nickname ),
      category:expense_categories ( name ),
      splits:recurring_expense_splits (
        household_member_id,
        percentage,
        amount
      )
    `)
    .eq('household_id', householdId)
    .eq('is_active', true)

  if (error) return { data: null, error: error.message }

  type Row = {
    id: string
    description: string
    amount: number
    due_day_of_month: number
    paid_by_member_id: string
    alert_days_before: number
    payer: { id: string; nickname: string } | null
    category: { name: string } | null
    splits: { household_member_id: string; percentage: number; amount: number | null }[]
  }

  const today = new Date()
  const bills: UpcomingBill[] = []

  for (const row of data as unknown as Row[]) {
    let nextDue = getMonthlyDueDate(today.getFullYear(), today.getMonth(), row.due_day_of_month)
    if (nextDue < today) {
      nextDue = getMonthlyDueDate(today.getFullYear(), today.getMonth() + 1, row.due_day_of_month)
    }
    const msUntil = nextDue.getTime() - today.getTime()
    const daysUntil = Math.ceil(msUntil / (1000 * 60 * 60 * 24))
    const isOverdue = nextDue < today

    if (daysUntil > row.alert_days_before && !isOverdue) continue

    const yourSplit = row.splits.find((s) => s.household_member_id === currentMemberId)
    const yourShare = yourSplit
      ? yourSplit.amount !== null
        ? Number(yourSplit.amount)
        : Math.round((Number(yourSplit.percentage) / 100) * Number(row.amount) * 100) / 100
      : 0

    bills.push({
      recurring_expense_id: row.id,
      description: row.description,
      category_name: row.category?.name ?? '',
      due_date: nextDue.toISOString(),
      is_overdue: isOverdue,
      days_until: daysUntil,
      alert_days_before: row.alert_days_before,
      your_share: yourShare,
      payer: row.payer ?? { id: row.paid_by_member_id, nickname: 'Unknown' },
      you_are_payer: row.paid_by_member_id === currentMemberId,
    })
  }

  bills.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
  return { data: bills, error: null }
}

// ─── Recent activity ───────────────────────────────────────────────────────

export async function getRecentActivity(
  supabase: SupabaseClient,
  householdId: string,
  currentMemberId: string,
): Promise<{ data: ActivityItem[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('expenses')
    .select(`
      id,
      date,
      description,
      total_amount,
      paid_by_member_id,
      payer:household_members!paid_by_member_id ( id, nickname ),
      category:expense_categories ( name ),
      expense_splits (
        household_member_id,
        calculated_amount,
        is_settled,
        member:household_members ( id, nickname )
      )
    `)
    .eq('household_id', householdId)
    .order('date', { ascending: false })
    .limit(20)

  if (error) return { data: null, error: error.message }

  type SplitRow = {
    household_member_id: string
    calculated_amount: number
    is_settled: boolean
    member: { id: string; nickname: string } | null
  }

  type ExpenseRow = {
    id: string
    date: string
    description: string
    total_amount: number
    paid_by_member_id: string
    payer: { id: string; nickname: string } | null
    category: { name: string } | null
    expense_splits: SplitRow[]
  }

  const items: ActivityItem[] = (data as unknown as ExpenseRow[]).map((e) => {
    const yourSplitRow = e.expense_splits.find((s) => s.household_member_id === currentMemberId)
    return {
      id: e.id,
      date: e.date,
      description: e.description,
      category_name: e.category?.name ?? '',
      total_amount: Number(e.total_amount),
      paid_by: e.payer ?? { id: e.paid_by_member_id, nickname: 'Unknown' },
      your_split: yourSplitRow
        ? { calculated_amount: Number(yourSplitRow.calculated_amount), is_settled: yourSplitRow.is_settled }
        : null,
      all_splits: e.expense_splits.map((s) => ({
        member: s.member ?? { id: s.household_member_id, nickname: 'Unknown' },
        calculated_amount: Number(s.calculated_amount),
        is_settled: s.is_settled,
      })),
    }
  })

  return { data: items, error: null }
}
