import type { SupabaseClient } from '@supabase/supabase-js'
import type { DashboardData, RentStatus, Balance, ActivityItem } from '@/lib/types/dashboard'

function diffDays(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

async function fetchRentStatus(
  supabase: SupabaseClient,
  householdId: string,
  currentMemberId: string,
): Promise<RentStatus | null> {
  try {
    const { data: expense, error } = await supabase
      .from('expenses')
      .select(`
        id,
        description,
        total_amount,
        date,
        expense_splits (
          id,
          household_member_id,
          is_settled,
          household_members ( id, nickname, user_id )
        ),
        expense_categories ( name )
      `)
      .eq('household_id', householdId)
      .ilike('expense_categories.name', 'rent')
      .not('expense_categories', 'is', null)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !expense) return null

    const expenseDate = new Date(expense.date)
    const dueDate = new Date(expenseDate)
    dueDate.setDate(expenseDate.getDate() + 30)
    const daysUntilDue = diffDays(new Date(), dueDate)

    const splits = (expense.expense_splits ?? []) as unknown as Array<{
      id: string
      household_member_id: string
      is_settled: boolean
      household_members: { id: string; nickname: string | null; user_id: string } | null
    }>

    const members = splits.map((split) => ({
      memberId: split.household_member_id,
      memberName: split.household_members?.nickname ?? 'Unknown',
      hasPaid: split.household_member_id === currentMemberId
        ? split.is_settled
        : split.is_settled,
    }))

    return {
      expenseId: expense.id,
      description: expense.description,
      totalAmount: Number(expense.total_amount),
      dueDate: dueDate.toISOString(),
      daysUntilDue,
      members,
      paidCount: members.filter((m) => m.hasPaid).length,
      totalCount: members.length,
    }
  } catch (err) {
    console.error('[dashboard/rentStatus]', err)
    return null
  }
}

async function fetchBalances(
  supabase: SupabaseClient,
  householdId: string,
  currentMemberId: string,
): Promise<Balance[]> {
  try {
    const { data: splits, error } = await supabase
      .from('expense_splits')
      .select(`
        household_member_id,
        calculated_amount,
        is_settled,
        expenses!inner (
          household_id,
          paid_by_member_id
        ),
        household_members!inner (
          id,
          nickname,
          user_id
        )
      `)
      .eq('expenses.household_id', householdId)
      .eq('is_settled', false)

    if (error || !splits) return []

    type SplitRow = {
      household_member_id: string
      calculated_amount: number
      is_settled: boolean
      expenses: { household_id: string; paid_by_member_id: string }
      household_members: { id: string; nickname: string | null; user_id: string }
    }

    const netMap = new Map<string, { name: string; net: number }>()

    for (const split of splits as unknown as SplitRow[]) {
      const { household_member_id, calculated_amount, expenses: expense, household_members: member } = split
      const amount = Number(calculated_amount)

      if (expense.paid_by_member_id === currentMemberId && household_member_id !== currentMemberId) {
        const existing = netMap.get(household_member_id) ?? { name: member.nickname ?? 'Unknown', net: 0 }
        netMap.set(household_member_id, { ...existing, net: existing.net + amount })
      }

      if (household_member_id === currentMemberId && expense.paid_by_member_id !== currentMemberId) {
        const payerId = expense.paid_by_member_id
        const existing = netMap.get(payerId) ?? { name: 'Unknown', net: 0 }
        netMap.set(payerId, { ...existing, net: existing.net - amount })
      }
    }

    return Array.from(netMap.entries()).map(([memberId, { name, net }]) => ({
      memberId,
      memberName: name,
      netAmount: Math.round(net * 100) / 100,
    }))
  } catch (err) {
    console.error('[dashboard/balances]', err)
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
      .slice(0, 5)
  } catch (err) {
    console.error('[dashboard/recentActivity]', err)
    return []
  }
}

export async function getDashboardData(
  supabase: SupabaseClient,
  householdId: string,
  currentMemberId: string,
): Promise<{ data: DashboardData | null; error: string | null }> {
  try {
    const [rentStatus, balances, recentActivity] = await Promise.all([
      fetchRentStatus(supabase, householdId, currentMemberId),
      fetchBalances(supabase, householdId, currentMemberId),
      fetchRecentActivity(supabase, householdId),
    ])

    return { data: { rentStatus, balances, recentActivity }, error: null }
  } catch (err) {
    console.error('[dashboard/getDashboardData]', err)
    return { data: null, error: 'Failed to load dashboard data.' }
  }
}
