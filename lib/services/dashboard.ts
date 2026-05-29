import type { SupabaseClient } from '@supabase/supabase-js'
import type { DashboardData, ActivityItem, RecurringBillAlert, GetStartedStatus } from '@/lib/types/dashboard'
import { getCurrentCycleDueDate, isDateInCycle } from '@/lib/utils/recurringCycle'

function diffDays(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

async function fetchGetStartedStatus(
  supabase: SupabaseClient,
  householdId: string,
): Promise<GetStartedStatus> {
  try {
    const [householdResult, recurringResult, membersResult] = await Promise.all([
      supabase.from('households').select('name').eq('id', householdId).single(),
      supabase
        .from('recurring_expenses')
        .select('id', { count: 'exact', head: true })
        .eq('household_id', householdId)
        .eq('is_active', true),
      supabase
        .from('household_members')
        .select('id', { count: 'exact', head: true })
        .eq('household_id', householdId),
    ])

    return {
      hasHouseholdName: !!(householdResult.data?.name?.trim()),
      hasRecurringBills: (recurringResult.count ?? 0) > 0,
      hasMultipleMembers: (membersResult.count ?? 0) > 1,
    }
  } catch (err) {
    console.error('[dashboard/getStarted]', err)
    return { hasHouseholdName: false, hasRecurringBills: false, hasMultipleMembers: false }
  }
}

async function fetchRecurringAlerts(
  supabase: SupabaseClient,
  householdId: string,
): Promise<RecurringBillAlert[]> {
  try {
    const { data: bills, error: billsErr } = await supabase
      .from('recurring_expenses')
      .select('id, description, amount, due_day_of_month, alert_days_before')
      .eq('household_id', householdId)
      .eq('is_active', true)

    if (billsErr || !bills?.length) return []

    const { data: loggedExpenses } = await supabase
      .from('expenses')
      .select('recurring_expense_id, date')
      .in('recurring_expense_id', bills.map((b) => b.id))

    const today = new Date()
    const alerts: RecurringBillAlert[] = []

    for (const bill of bills) {
      const cycleDueDate = getCurrentCycleDueDate(bill.due_day_of_month)
      const isLogged = (loggedExpenses ?? []).some(
        (e) =>
          e.recurring_expense_id === bill.id &&
          isDateInCycle(e.date, cycleDueDate),
      )
      if (isLogged) continue

      const daysUntilDue = diffDays(today, new Date(cycleDueDate))
      if (daysUntilDue > bill.alert_days_before) continue

      alerts.push({
        id: bill.id,
        description: bill.description,
        totalAmount: Number(bill.amount),
        dueDayOfMonth: bill.due_day_of_month,
        daysUntilDue,
        cycleDueDate,
      })
    }

    return alerts.sort((a, b) => a.daysUntilDue - b.daysUntilDue)
  } catch (err) {
    console.error('[dashboard/recurringAlerts]', err)
    return []
  }
}

async function fetchRecentActivity(
  supabase: SupabaseClient,
  householdId: string,
): Promise<ActivityItem[]> {
  try {
    const [expensesResult, shoppingResult] = await Promise.all([
      supabase
        .from('expenses')
        .select(`
          id,
          description,
          total_amount,
          created_at,
          household_members!paid_by_member_id ( nickname )
        `)
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })
        .limit(5),

      supabase
        .from('shopping_list_items')
        .select(`
          id,
          name,
          created_at,
          shopping_lists!inner ( household_id )
        `)
        .eq('shopping_lists.household_id', householdId)
        .eq('is_checked', true)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    type ExpenseRow = {
      id: string
      description: string
      total_amount: number
      created_at: string
      household_members: { nickname: string | null } | null
    }

    type ShoppingRow = {
      id: string
      name: string
      created_at: string
    }

    const expenseItems: ActivityItem[] = ((expensesResult.data ?? []) as unknown as ExpenseRow[]).map((e) => ({
      id: e.id,
      type: 'expense' as const,
      actorName: e.household_members?.nickname ?? 'Someone',
      description: `added ${e.description}`,
      amount: Number(e.total_amount),
      createdAt: e.created_at,
    }))

    const shoppingItems: ActivityItem[] = ((shoppingResult.data ?? []) as ShoppingRow[]).map((s) => ({
      id: s.id,
      type: 'shopping_item' as const,
      actorName: 'Someone',
      description: `checked off ${s.name}`,
      createdAt: s.created_at,
    }))

    return [...expenseItems, ...shoppingItems]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3)
  } catch (err) {
    console.error('[dashboard/recentActivity]', err)
    return []
  }
}

export async function getDashboardData(
  supabase: SupabaseClient,
  householdId: string,
): Promise<{ data: DashboardData | null; error: string | null }> {
  try {
    const [getStarted, recurringAlerts, recentActivity] = await Promise.all([
      fetchGetStartedStatus(supabase, householdId),
      fetchRecurringAlerts(supabase, householdId),
      fetchRecentActivity(supabase, householdId),
    ])

    return { data: { getStarted, recurringAlerts, recentActivity }, error: null }
  } catch (err) {
    console.error('[dashboard/getDashboardData]', err)
    return { data: null, error: 'Failed to load dashboard data.' }
  }
}
