import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getCurrentCycleDueDate,
  isDateInCycle,
} from '@/lib/utils/recurringCycle'
import { RESEND_API_KEY, EMAIL_FROM_ADDRESS, APP_NAME } from '@/lib/config'
import { BILL_REMINDERS } from '@/locales/en'

interface BillReminderTarget {
  recipientUserId: string
  recipientNickname: string
  payerNickname: string
  description: string
  shareAmount: number
  dueDate: string
  householdName: string
  isPayerReminder: boolean
}

interface MemberRow {
  id: string
  nickname: string
  user_id: string
}

interface RecurringExpenseRow {
  id: string
  description: string
  amount: number
  due_day_of_month: number
  alert_days_before: number
  household: { name: string } | null
  payer: MemberRow | null
  recurring_expense_splits: Array<{
    household_member_id: string
    amount: number
    member: MemberRow | null
  }>
}

interface CycleExpenseSplit {
  household_member_id: string
  is_settled: boolean
  calculated_amount: number
  member: MemberRow | null
}

interface CycleExpenseRow {
  id: string
  date: string
  recurring_expense_id: string
  paid_by_member_id: string
  expense_splits: CycleExpenseSplit[]
}

export async function getBillRemindersForToday(
  supabase: SupabaseClient,
): Promise<BillReminderTarget[]> {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const { data: bills, error } = await supabase
    .from('recurring_expenses')
    .select(
      'id, description, amount, due_day_of_month, alert_days_before, ' +
        'household:households!household_id(name), ' +
        'payer:household_members!paid_by_member_id(id, nickname, user_id), ' +
        'recurring_expense_splits(household_member_id, amount, member:household_members!household_member_id(id, nickname, user_id))',
    )
    .eq('is_active', true)

  if (error || !bills) {
    console.error('[billReminderEmails] failed to fetch recurring expenses', error)
    return []
  }

  const typedBills = bills as unknown as RecurringExpenseRow[]

  const billsInWindow = typedBills.filter((bill) => {
    const cycleDueDateStr = getCurrentCycleDueDate(bill.due_day_of_month, today)
    const [y, m, d] = cycleDueDateStr.split('-').map(Number)
    const alertStart = new Date(y, m - 1, d)
    alertStart.setDate(alertStart.getDate() - bill.alert_days_before)
    const alertStartStr = [
      alertStart.getFullYear(),
      String(alertStart.getMonth() + 1).padStart(2, '0'),
      String(alertStart.getDate()).padStart(2, '0'),
    ].join('-')
    return todayStr >= alertStartStr
  })

  if (billsInWindow.length === 0) return []

  const { data: cycleExpenses, error: cycleErr } = await supabase
    .from('expenses')
    .select(
      'id, date, recurring_expense_id, paid_by_member_id, ' +
        'expense_splits(household_member_id, is_settled, calculated_amount, member:household_members!household_member_id(id, nickname, user_id))',
    )
    .in('recurring_expense_id', billsInWindow.map((b) => b.id))

  if (cycleErr) {
    console.error('[billReminderEmails] failed to fetch cycle expenses', cycleErr)
    return []
  }

  const cycleExpenseMap = new Map<string, CycleExpenseRow>()
  for (const exp of (cycleExpenses ?? []) as unknown as CycleExpenseRow[]) {
    if (!exp.recurring_expense_id) continue
    const bill = billsInWindow.find((b) => b.id === exp.recurring_expense_id)
    if (!bill) continue
    const cycleDueDate = getCurrentCycleDueDate(bill.due_day_of_month, today)
    if (isDateInCycle(exp.date, cycleDueDate)) {
      cycleExpenseMap.set(exp.recurring_expense_id, exp)
    }
  }

  const targets: BillReminderTarget[] = []

  for (const bill of billsInWindow) {
    if (!bill.payer) continue
    const cycleDueDate = getCurrentCycleDueDate(bill.due_day_of_month, today)
    const householdName = bill.household?.name ?? APP_NAME
    const cycleExpense = cycleExpenseMap.get(bill.id)

    if (!cycleExpense) {
      targets.push({
        recipientUserId: bill.payer.user_id,
        recipientNickname: bill.payer.nickname,
        payerNickname: bill.payer.nickname,
        description: bill.description,
        shareAmount: bill.amount,
        dueDate: cycleDueDate,
        householdName,
        isPayerReminder: true,
      })
      continue
    }

    const unsettledSplits = cycleExpense.expense_splits.filter(
      (s) => !s.is_settled && s.household_member_id !== cycleExpense.paid_by_member_id,
    )
    for (const split of unsettledSplits) {
      if (!split.member) continue
      targets.push({
        recipientUserId: split.member.user_id,
        recipientNickname: split.member.nickname,
        payerNickname: bill.payer.nickname,
        description: bill.description,
        shareAmount: split.calculated_amount,
        dueDate: cycleDueDate,
        householdName,
        isPayerReminder: false,
      })
    }
  }

  return targets
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn('[billReminderEmails] RESEND_API_KEY not set — skipping email')
    return
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${APP_NAME} <${EMAIL_FROM_ADDRESS}>`,
      to,
      subject,
      html,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    console.error('[billReminderEmails] Resend error', res.status, text)
  }
}

export async function sendBillReminderEmails(targets: BillReminderTarget[]): Promise<void> {
  if (targets.length === 0) return
  const adminClient = createAdminClient()

  await Promise.all(
    targets.map(async (target) => {
      try {
        const {
          data: { user },
        } = await adminClient.auth.admin.getUserById(target.recipientUserId)
        const email = user?.email
        if (!email) {
          console.warn('[billReminderEmails] no email for user', target.recipientUserId)
          return
        }

        const formattedAmount = `$${target.shareAmount.toFixed(2)}`
        const formattedDate = new Date(`${target.dueDate}T00:00:00`).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
        })

        const subject = target.isPayerReminder
          ? BILL_REMINDERS.PAYER_SUBJECT(target.description)
          : BILL_REMINDERS.MEMBER_SUBJECT(target.payerNickname, target.description)

        const heading = target.isPayerReminder
          ? BILL_REMINDERS.PAYER_HEADING
          : BILL_REMINDERS.MEMBER_HEADING

        const body = target.isPayerReminder
          ? BILL_REMINDERS.PAYER_BODY(target.description, formattedAmount, formattedDate)
          : BILL_REMINDERS.MEMBER_BODY(target.payerNickname, target.description, formattedAmount)

        const footer = BILL_REMINDERS.FOOTER(target.householdName)

        const html = `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a2e;">
            <h2 style="margin-bottom: 8px;">${heading}</h2>
            <p style="font-size: 16px; line-height: 1.5;">${body}</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
            <p style="font-size: 12px; color: #6b7280;">${footer}</p>
          </div>
        `

        await sendEmail(email, subject, html)
      } catch (err) {
        console.error('[billReminderEmails] error for user', target.recipientUserId, err)
      }
    }),
  )
}
