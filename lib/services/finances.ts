import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ExpenseCategory,
  RecurringExpense,
  OweSummary,
  OweItem,
  SettledItem,
  ActivityItem,
  RecurringBillOverview,
  RecurringBillMemberStatus,
  SplitParticipant,
} from '@/lib/types/finances'
import { FINANCES } from '@/locales/en'
import { getCurrentCycleDueDate, isDateInCycle } from '@/lib/utils/recurringCycle'

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
      color,
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
    color: string | null
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
    color: r.color ?? '#ef4444',
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

// ─── Owe summary ───────────────────────────────────────────────────────────

export async function getOweSummary(
  supabase: SupabaseClient,
  householdId: string,
  currentMemberId: string,
): Promise<{ data: OweSummary | null; error: string | null }> {
  type ReceiptRow = { id: string; merchant_name: string | null; receipt_date: string | null } | null
  type ExpenseRowA = {
    id: string
    description: string
    date: string
    receipt_id: string | null
    receipts: ReceiptRow
  }
  type SplitRowMemberDebt = {
    id: string
    household_member_id: string
    calculated_amount: number
    expenses: ExpenseRowA
    debtor: { id: string; nickname: string } | null
  }
  type SplitRowGuestDebt = {
    id: string
    guest_id: string
    calculated_amount: number
    expenses: ExpenseRowA
    debtor: { id: string; name: string } | null
  }

  type ExpenseRowMemberCred = {
    id: string
    description: string
    date: string
    receipt_id: string | null
    paid_by_member_id: string
    receipts: ReceiptRow
    creditor: { id: string; nickname: string } | null
  }
  type ExpenseRowGuestCred = {
    id: string
    description: string
    date: string
    receipt_id: string | null
    paid_by_guest_id: string
    receipts: ReceiptRow
    creditor: { id: string; name: string } | null
  }
  type SplitRowYouOweMember = {
    id: string
    household_member_id: string
    calculated_amount: number
    expenses: ExpenseRowMemberCred
  }
  type SplitRowYouOweGuest = {
    id: string
    household_member_id: string
    calculated_amount: number
    expenses: ExpenseRowGuestCred
  }

  const [owedMembersRes, owedGuestsRes, youOweMembersRes, youOweGuestsRes] = await Promise.all([
    supabase
      .from('expense_splits')
      .select(`
        id,
        household_member_id,
        calculated_amount,
        expenses!inner (
          id,
          description,
          date,
          receipt_id,
          receipts ( id, merchant_name, receipt_date )
        ),
        debtor:household_members!household_member_id ( id, nickname )
      `)
      .eq('expenses.household_id', householdId)
      .eq('expenses.paid_by_member_id', currentMemberId)
      .neq('household_member_id', currentMemberId)
      .eq('is_settled', false),

    supabase
      .from('expense_splits')
      .select(`
        id,
        guest_id,
        calculated_amount,
        expenses!inner (
          id,
          description,
          date,
          receipt_id,
          receipts ( id, merchant_name, receipt_date )
        ),
        debtor:household_guests!guest_id ( id, name )
      `)
      .eq('expenses.household_id', householdId)
      .eq('expenses.paid_by_member_id', currentMemberId)
      .not('guest_id', 'is', null)
      .eq('is_settled', false),

    supabase
      .from('expense_splits')
      .select(`
        id,
        household_member_id,
        calculated_amount,
        expenses!inner (
          id,
          description,
          date,
          receipt_id,
          paid_by_member_id,
          receipts ( id, merchant_name, receipt_date ),
          creditor:household_members!paid_by_member_id ( id, nickname )
        )
      `)
      .eq('expenses.household_id', householdId)
      .eq('household_member_id', currentMemberId)
      .neq('expenses.paid_by_member_id', currentMemberId)
      .not('expenses.paid_by_member_id', 'is', null)
      .eq('is_settled', false),

    supabase
      .from('expense_splits')
      .select(`
        id,
        household_member_id,
        calculated_amount,
        expenses!inner (
          id,
          description,
          date,
          receipt_id,
          paid_by_guest_id,
          receipts ( id, merchant_name, receipt_date ),
          creditor:household_guests!paid_by_guest_id ( id, name )
        )
      `)
      .eq('expenses.household_id', householdId)
      .eq('household_member_id', currentMemberId)
      .not('expenses.paid_by_guest_id', 'is', null)
      .eq('is_settled', false),
  ])

  if (owedMembersRes.error) return { data: null, error: owedMembersRes.error.message }
  if (owedGuestsRes.error) return { data: null, error: owedGuestsRes.error.message }
  if (youOweMembersRes.error) return { data: null, error: youOweMembersRes.error.message }
  if (youOweGuestsRes.error) return { data: null, error: youOweGuestsRes.error.message }

  const toParticipant = (
    p: { id: string; nickname?: string; name?: string } | null | undefined,
    type: SplitParticipant['type'],
  ): SplitParticipant | undefined => {
    if (!p) return undefined
    return { type, id: p.id, nickname: p.nickname ?? p.name ?? 'Unknown' }
  }

  const owed_to_you: OweItem[] = [
    ...(owedMembersRes.data as unknown as SplitRowMemberDebt[]).map((s) => ({
      split_id: s.id,
      expense_id: s.expenses.id,
      description: s.expenses.description,
      date: s.expenses.date,
      amount: Math.round(Number(s.calculated_amount) * 100) / 100,
      debtor: toParticipant(s.debtor, 'member'),
      receipt: s.expenses.receipts
        ? { id: s.expenses.receipts.id, merchant_name: s.expenses.receipts.merchant_name, receipt_date: s.expenses.receipts.receipt_date }
        : null,
    })),
    ...(owedGuestsRes.data as unknown as SplitRowGuestDebt[]).map((s) => ({
      split_id: s.id,
      expense_id: s.expenses.id,
      description: s.expenses.description,
      date: s.expenses.date,
      amount: Math.round(Number(s.calculated_amount) * 100) / 100,
      debtor: toParticipant(s.debtor, 'guest'),
      receipt: s.expenses.receipts
        ? { id: s.expenses.receipts.id, merchant_name: s.expenses.receipts.merchant_name, receipt_date: s.expenses.receipts.receipt_date }
        : null,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const you_owe: OweItem[] = [
    ...(youOweMembersRes.data as unknown as SplitRowYouOweMember[]).map((s) => ({
      split_id: s.id,
      expense_id: s.expenses.id,
      description: s.expenses.description,
      date: s.expenses.date,
      amount: Math.round(Number(s.calculated_amount) * 100) / 100,
      creditor: toParticipant(s.expenses.creditor, 'member'),
      receipt: s.expenses.receipts
        ? { id: s.expenses.receipts.id, merchant_name: s.expenses.receipts.merchant_name, receipt_date: s.expenses.receipts.receipt_date }
        : null,
    })),
    ...(youOweGuestsRes.data as unknown as SplitRowYouOweGuest[]).map((s) => ({
      split_id: s.id,
      expense_id: s.expenses.id,
      description: s.expenses.description,
      date: s.expenses.date,
      amount: Math.round(Number(s.calculated_amount) * 100) / 100,
      creditor: toParticipant(s.expenses.creditor, 'guest'),
      receipt: s.expenses.receipts
        ? { id: s.expenses.receipts.id, merchant_name: s.expenses.receipts.merchant_name, receipt_date: s.expenses.receipts.receipt_date }
        : null,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return { data: { owed_to_you, you_owe }, error: null }
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
      paid_by_guest_id,
      payer:household_members!paid_by_member_id ( id, nickname ),
      guest_payer:household_guests!paid_by_guest_id ( id, name ),
      category:expense_categories ( name ),
      expense_splits (
        household_member_id,
        guest_id,
        calculated_amount,
        is_settled,
        member:household_members ( id, nickname ),
        guest:household_guests ( id, name )
      )
    `)
    .eq('household_id', householdId)
    .order('date', { ascending: false })
    .limit(20)

  if (error) return { data: null, error: error.message }

  type SplitRow = {
    household_member_id: string | null
    guest_id: string | null
    calculated_amount: number
    is_settled: boolean
    member: { id: string; nickname: string } | null
    guest: { id: string; name: string } | null
  }

  type ExpenseRow = {
    id: string
    date: string
    description: string
    total_amount: number
    paid_by_member_id: string | null
    paid_by_guest_id: string | null
    payer: { id: string; nickname: string } | null
    guest_payer: { id: string; name: string } | null
    category: { name: string } | null
    expense_splits: SplitRow[]
  }

  const items: ActivityItem[] = (data as unknown as ExpenseRow[]).map((e) => {
    const yourSplitRow = e.expense_splits.find((s) => s.household_member_id === currentMemberId)
    const paidBy: SplitParticipant = e.payer
      ? { type: 'member', id: e.payer.id, nickname: e.payer.nickname }
      : e.guest_payer
        ? { type: 'guest', id: e.guest_payer.id, nickname: e.guest_payer.name }
        : { type: 'member', id: e.paid_by_member_id ?? '', nickname: 'Unknown' }

    return {
      id: e.id,
      date: e.date,
      description: e.description,
      category_name: e.category?.name ?? '',
      total_amount: Number(e.total_amount),
      paid_by: paidBy,
      your_split: yourSplitRow
        ? { calculated_amount: Number(yourSplitRow.calculated_amount), is_settled: yourSplitRow.is_settled }
        : null,
      all_splits: e.expense_splits.map((s) => ({
        participant: s.member
          ? { type: 'member' as const, id: s.member.id, nickname: s.member.nickname }
          : s.guest
            ? { type: 'guest' as const, id: s.guest.id, nickname: s.guest.name }
            : { type: 'member' as const, id: s.household_member_id ?? '', nickname: 'Unknown' },
        calculated_amount: Number(s.calculated_amount),
        is_settled: s.is_settled,
      })),
    }
  })

  return { data: items, error: null }
}

// ─── Recurring bills overview ──────────────────────────────────────────────

function roundAmount(n: number): number {
  return Math.round(n * 100) / 100
}

export async function getRecurringBillsOverview(
  supabase: SupabaseClient,
  householdId: string,
  currentMemberId: string,
): Promise<{ data: RecurringBillOverview[] | null; error: string | null }> {
  const { data: recurringRows, error: recurringErr } = await supabase
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
      color,
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
    .eq('is_active', true)
    .order('description', { ascending: true })

  if (recurringErr) return { data: null, error: recurringErr.message }

  type RecurringRow = {
    id: string
    household_id: string
    category_id: string | null
    description: string
    amount: number
    paid_by_member_id: string
    due_day_of_month: number
    alert_days_before: number
    is_active: boolean
    color: string | null
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

  const recurring = (recurringRows as unknown as RecurringRow[]) ?? []
  if (recurring.length === 0) return { data: [], error: null }

  const recurringIds = recurring.map((r) => r.id)

  const { data: expenseRows, error: expenseErr } = await supabase
    .from('expenses')
    .select(`
      id,
      recurring_expense_id,
      date,
      expense_splits (
        id,
        household_member_id,
        calculated_amount,
        is_settled,
        member:household_members ( id, nickname )
      )
    `)
    .eq('household_id', householdId)
    .in('recurring_expense_id', recurringIds)

  if (expenseErr) return { data: null, error: expenseErr.message }

  type ExpenseSplitRow = {
    id: string
    household_member_id: string
    calculated_amount: number
    is_settled: boolean
    member: { id: string; nickname: string } | null
  }

  type ExpenseRow = {
    id: string
    recurring_expense_id: string
    date: string
    expense_splits: ExpenseSplitRow[]
  }

  const expenses = (expenseRows as unknown as ExpenseRow[]) ?? []

  const bills: RecurringBillOverview[] = recurring.map((r) => {
    const cycleDueDate = getCurrentCycleDueDate(r.due_day_of_month)
    const cycleExpense = expenses.find(
      (e) => e.recurring_expense_id === r.id && isDateInCycle(e.date, cycleDueDate),
    )

    const payer = r.payer ?? { id: r.paid_by_member_id, nickname: 'Unknown' }
    const viewerIsPayer = r.paid_by_member_id === currentMemberId

    let members: RecurringBillMemberStatus[] = []
    let viewerOwesAmount = 0
    let viewerCollectTotal = 0
    let viewerCollectUnsettledTotal = 0

    if (!cycleExpense) {
      members = r.splits.map((s) => {
        const shareAmount = roundAmount(Number(s.amount) || roundAmount((Number(s.percentage) / 100) * Number(r.amount)))
        const isPayer = s.household_member_id === r.paid_by_member_id
        const isViewer = s.household_member_id === currentMemberId

        if (viewerIsPayer && !isPayer) {
          viewerCollectTotal += shareAmount
          viewerCollectUnsettledTotal += shareAmount
        } else if (!viewerIsPayer && isViewer) {
          viewerOwesAmount += shareAmount
        }

        return {
          member_id: s.household_member_id,
          member_name: s.member?.nickname ?? 'Unknown',
          share_amount: shareAmount,
          is_payer: isPayer,
          is_viewer: isViewer,
          is_settled: null,
          split_id: null,
        }
      })
    } else {
      const splitByMember = new Map(
        cycleExpense.expense_splits.map((s) => [s.household_member_id, s]),
      )

      members = r.splits.map((s) => {
        const expenseSplit = splitByMember.get(s.household_member_id)
        const shareAmount = expenseSplit
          ? roundAmount(Number(expenseSplit.calculated_amount))
          : roundAmount(Number(s.amount) || roundAmount((Number(s.percentage) / 100) * Number(r.amount)))
        const isPayer = s.household_member_id === r.paid_by_member_id
        const isViewer = s.household_member_id === currentMemberId
        const isSettled = expenseSplit?.is_settled ?? (isPayer ? true : false)

        if (viewerIsPayer && !isPayer) {
          viewerCollectTotal += shareAmount
          if (!isSettled) viewerCollectUnsettledTotal += shareAmount
        } else if (!viewerIsPayer && isViewer && !isSettled) {
          viewerOwesAmount += shareAmount
        }

        return {
          member_id: s.household_member_id,
          member_name: s.member?.nickname ?? expenseSplit?.member?.nickname ?? 'Unknown',
          share_amount: shareAmount,
          is_payer: isPayer,
          is_viewer: isViewer,
          is_settled: isSettled,
          split_id: expenseSplit?.id ?? null,
        }
      })
    }

    return {
      recurring_expense_id: r.id,
      description: r.description,
      category_name: r.category?.name ?? null,
      total_amount: roundAmount(Number(r.amount)),
      due_day_of_month: r.due_day_of_month,
      alert_days_before: r.alert_days_before,
      is_active: r.is_active,
      payer,
      cycle_status: cycleExpense ? 'logged' : 'not_logged',
      cycle_due_date: cycleDueDate,
      cycle_expense_id: cycleExpense?.id ?? null,
      members,
      viewer_owes_amount: roundAmount(viewerOwesAmount),
      viewer_is_payer: viewerIsPayer,
      viewer_collect_total: roundAmount(viewerCollectTotal),
      viewer_collect_unsettled_total: roundAmount(viewerCollectUnsettledTotal),
    }
  })

  bills.sort((a, b) => {
    const dateCmp = a.cycle_due_date.localeCompare(b.cycle_due_date)
    return dateCmp !== 0 ? dateCmp : a.description.localeCompare(b.description)
  })

  return { data: bills, error: null }
}

export async function confirmRecurringExpenseForCycle(
  supabase: SupabaseClient,
  recurringId: string,
  userId: string,
): Promise<{ data: { expense_id: string } | null; error: string | null; status?: number }> {
  const { data: recurring, error: fetchErr } = await supabase
    .from('recurring_expenses')
    .select(`
      id,
      household_id,
      category_id,
      description,
      amount,
      paid_by_member_id,
      due_day_of_month,
      recurring_expense_splits ( household_member_id, percentage, amount )
    `)
    .eq('id', recurringId)
    .eq('is_active', true)
    .maybeSingle()

  if (fetchErr || !recurring) {
    return { data: null, error: FINANCES.ERRORS.NOT_FOUND, status: 404 }
  }

  type RecurringRow = {
    id: string
    household_id: string
    category_id: string | null
    description: string
    amount: number
    paid_by_member_id: string
    due_day_of_month: number
    recurring_expense_splits: { household_member_id: string; percentage: number; amount: number }[]
  }

  const rec = recurring as unknown as RecurringRow

  const memberId = await getMemberIdForUser(supabase, rec.household_id, userId)
  if (!memberId) {
    return { data: null, error: FINANCES.ERRORS.FORBIDDEN, status: 403 }
  }

  const cycleDueDate = getCurrentCycleDueDate(rec.due_day_of_month)

  const { data: existingExpenses, error: existingErr } = await supabase
    .from('expenses')
    .select('id, date')
    .eq('recurring_expense_id', rec.id)
    .eq('household_id', rec.household_id)

  if (existingErr) return { data: null, error: existingErr.message, status: 400 }

  const alreadyConfirmed = (existingExpenses ?? []).some((e) =>
    isDateInCycle(e.date as string, cycleDueDate),
  )
  if (alreadyConfirmed) {
    return {
      data: null,
      error: FINANCES.ERRORS.ALREADY_CONFIRMED_THIS_CYCLE,
      status: 409,
    }
  }

  const { data: expense, error: expenseErr } = await supabase
    .from('expenses')
    .insert({
      household_id: rec.household_id,
      category_id: rec.category_id,
      description: rec.description,
      total_amount: rec.amount,
      paid_by_member_id: rec.paid_by_member_id,
      recurring_expense_id: rec.id,
      date: cycleDueDate,
    })
    .select('id')
    .single()

  if (expenseErr || !expense) {
    return { data: null, error: expenseErr?.message ?? FINANCES.ERRORS.CONFIRM_FAILED, status: 400 }
  }

  const splitRows = rec.recurring_expense_splits.map((s) => {
    const calculatedAmount =
      s.amount != null && Number(s.amount) > 0
        ? roundAmount(Number(s.amount))
        : roundAmount((Number(s.percentage) / 100) * Number(rec.amount))

    return {
      expense_id: expense.id,
      household_member_id: s.household_member_id,
      percentage_override: s.percentage,
      calculated_amount: calculatedAmount,
      is_settled: s.household_member_id === rec.paid_by_member_id,
    }
  })

  const { error: splitsErr } = await supabase.from('expense_splits').insert(splitRows)
  if (splitsErr) {
    await supabase.from('expenses').delete().eq('id', expense.id)
    return { data: null, error: splitsErr.message, status: 400 }
  }

  return { data: { expense_id: expense.id }, error: null }
}

export async function settleRecurringMemberForCycle(
  supabase: SupabaseClient,
  recurringId: string,
  householdId: string,
  targetMemberId: string,
  userId: string,
): Promise<{ data: null; error: string | null; status?: number }> {
  const currentMemberId = await getMemberIdForUser(supabase, householdId, userId)
  if (!currentMemberId) {
    return { data: null, error: FINANCES.ERRORS.FORBIDDEN, status: 403 }
  }

  const { data: recurring, error: recurringErr } = await supabase
    .from('recurring_expenses')
    .select('id, household_id, paid_by_member_id, due_day_of_month')
    .eq('id', recurringId)
    .eq('household_id', householdId)
    .eq('is_active', true)
    .maybeSingle()

  if (recurringErr || !recurring) {
    return { data: null, error: FINANCES.ERRORS.NOT_FOUND, status: 404 }
  }

  if (recurring.paid_by_member_id !== currentMemberId) {
    return { data: null, error: FINANCES.ERRORS.FORBIDDEN, status: 403 }
  }

  const cycleDueDate = getCurrentCycleDueDate(recurring.due_day_of_month)

  const { data: cycleExpenses, error: expenseErr } = await supabase
    .from('expenses')
    .select('id, date')
    .eq('household_id', householdId)
    .eq('recurring_expense_id', recurringId)

  if (expenseErr) {
    return { data: null, error: expenseErr.message, status: 400 }
  }

  const cycleExpense = (cycleExpenses ?? []).find((e) =>
    isDateInCycle(e.date as string, cycleDueDate),
  )

  if (!cycleExpense) {
    return { data: null, error: FINANCES.ERRORS.NOT_FOUND, status: 404 }
  }

  const { error: settleErr } = await supabase
    .from('expense_splits')
    .update({ is_settled: true })
    .eq('expense_id', cycleExpense.id)
    .eq('household_member_id', targetMemberId)

  if (settleErr) {
    return { data: null, error: settleErr.message, status: 400 }
  }

  return { data: null, error: null }
}

// ─── Settled expenses history ──────────────────────────────────────────────

export async function getSettledExpenses(
  supabase: SupabaseClient,
  householdId: string,
  currentMemberId: string,
  days = 30,
): Promise<{ data: SettledItem[] | null; error: string | null }> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  type MySettledRow = {
    id: string
    calculated_amount: number
    expenses: {
      id: string
      description: string
      date: string
      paid_by_member_id: string
      payer: { id: string; nickname: string } | null
    } | null
  }

  type TheirSettledRow = {
    id: string
    description: string
    date: string
    expense_splits: {
      id: string
      calculated_amount: number
      household_member_id: string
      debtor: { id: string; nickname: string } | null
    }[]
  }

  const [myResult, theirResult] = await Promise.all([
    supabase
      .from('expense_splits')
      .select('id, calculated_amount, expenses!inner(id, description, date, paid_by_member_id, payer:household_members!paid_by_member_id(id, nickname))')
      .eq('household_member_id', currentMemberId)
      .eq('is_settled', true)
      .eq('expenses.household_id', householdId)
      .gte('expenses.date', cutoffStr)
      .neq('expenses.paid_by_member_id', currentMemberId)
      .limit(30),

    supabase
      .from('expenses')
      .select('id, description, date, expense_splits!inner(id, calculated_amount, household_member_id, debtor:household_members!household_member_id(id, nickname))')
      .eq('paid_by_member_id', currentMemberId)
      .eq('household_id', householdId)
      .gte('date', cutoffStr)
      .eq('expense_splits.is_settled', true)
      .not('expense_splits.household_member_id', 'is', null)
      .neq('expense_splits.household_member_id', currentMemberId)
      .order('date', { ascending: false })
      .limit(30),
  ])

  if (myResult.error) return { data: null, error: myResult.error.message }
  if (theirResult.error) return { data: null, error: theirResult.error.message }

  const youPaid: SettledItem[] = ((myResult.data ?? []) as unknown as MySettledRow[])
    .filter((r) => r.expenses?.payer != null)
    .map((r) => ({
      split_id: r.id,
      expense_id: r.expenses!.id,
      description: r.expenses!.description,
      date: r.expenses!.date,
      amount: Number(r.calculated_amount),
      other_party: { id: r.expenses!.payer!.id, nickname: r.expenses!.payer!.nickname },
      you_paid: true,
    }))

  const theyPaid: SettledItem[] = ((theirResult.data ?? []) as unknown as TheirSettledRow[])
    .flatMap((e) =>
      e.expense_splits
        .filter((s) => s.debtor != null)
        .map((s) => ({
          split_id: s.id,
          expense_id: e.id,
          description: e.description,
          date: e.date,
          amount: Number(s.calculated_amount),
          other_party: { id: s.debtor!.id, nickname: s.debtor!.nickname },
          you_paid: false,
        })),
    )

  const all = [...youPaid, ...theyPaid].sort((a, b) => b.date.localeCompare(a.date))

  return { data: all, error: null }
}
