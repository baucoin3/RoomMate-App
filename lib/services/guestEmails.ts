import type { SupabaseClient } from '@supabase/supabase-js'
import { RESEND_API_KEY, EMAIL_FROM_ADDRESS, APP_NAME } from '@/lib/config'
import { GUESTS } from '@/locales/en'

interface GuestEmailPayload {
  to: string
  guestName: string
  payerName: string
  payerEmail: string
  merchantName: string
  receiptDate: string
  guestAmount: number
  householdName: string
}

async function sendEmail(payload: GuestEmailPayload): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn('[guestEmails] RESEND_API_KEY not set — skipping email')
    return
  }

  const subject = GUESTS.EMAIL.SUBJECT(payload.payerName)
  const body = GUESTS.EMAIL.BODY(
    payload.payerName,
    payload.merchantName,
    payload.receiptDate,
    `$${payload.guestAmount.toFixed(2)}`,
  )
  const payTo = GUESTS.EMAIL.PAY_TO(payload.payerName, payload.payerEmail)
  const footer = GUESTS.EMAIL.FOOTER(payload.householdName)

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a2e;">
      <h2 style="margin-bottom: 8px;">${GUESTS.EMAIL.HEADING}</h2>
      <p style="font-size: 16px; line-height: 1.5;">${body}</p>
      <p style="font-size: 16px; font-weight: bold; margin-top: 16px;">
        ${payTo}
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="font-size: 12px; color: #6b7280;">${footer}</p>
    </div>
  `

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${APP_NAME} <${EMAIL_FROM_ADDRESS}>`,
      to: payload.to,
      subject,
      html,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('[guestEmails] Resend error', res.status, text)
  }
}

export async function sendGuestSplitEmails(
  supabase: SupabaseClient,
  expenseId: string,
  householdId: string,
): Promise<void> {
  try {
    const { data: expense, error: expenseErr } = await supabase
      .from('expenses')
      .select(
        'id, total_amount, date, description, paid_by_member_id, paid_by_guest_id, ' +
        'household_members!paid_by_member_id(nickname, user_id), ' +
        'household_guests!paid_by_guest_id(name, email), ' +
        'expense_splits(calculated_amount, guest_id, household_guests(name, email))',
      )
      .eq('id', expenseId)
      .single()

    if (expenseErr || !expense) {
      console.error('[guestEmails] failed to fetch expense', expenseErr)
      return
    }

    const raw = expense as unknown as Record<string, unknown>
    const payerMember = raw.household_members as { nickname: string; user_id: string } | null
    const payerGuest = raw.household_guests as { name: string; email: string | null } | null

    let payerName: string
    let payerEmail: string

    if (payerMember) {
      payerName = payerMember.nickname
      const { data: payerProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', payerMember.user_id)
        .maybeSingle()
      payerEmail = (payerProfile as { email: string } | null)?.email ?? ''
    } else if (payerGuest) {
      payerName = payerGuest.name
      payerEmail = payerGuest.email ?? ''
    } else {
      return
    }

    const { data: household } = await supabase
      .from('households')
      .select('name')
      .eq('id', householdId)
      .single()

    const householdName = (household as { name: string } | null)?.name ?? APP_NAME

    const splits = (raw.expense_splits ?? []) as Array<{
      calculated_amount: number
      guest_id: string | null
      household_guests: { name: string; email: string | null } | null
    }>

    const guestSplits = splits.filter((s) => s.guest_id && s.household_guests?.email)

    await Promise.all(
      guestSplits.map((s) =>
        sendEmail({
          to: s.household_guests!.email!,
          guestName: s.household_guests!.name,
          payerName,
          payerEmail,
          merchantName: (raw.description as string) ?? 'a purchase',
          receiptDate: (raw.date as string) ?? new Date().toISOString().slice(0, 10),
          guestAmount: s.calculated_amount,
          householdName,
        }),
      ),
    )
  } catch (err) {
    console.error('[guestEmails] unexpected error', err)
  }
}
