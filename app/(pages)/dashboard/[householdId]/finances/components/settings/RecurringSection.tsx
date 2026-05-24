'use client'

import { useState } from 'react'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import type { RecurringExpense, ExpenseCategory, HouseholdMemberSummary, RecurringExpenseSplit } from '@/lib/types/finances'
import { FINANCES } from '@/locales/en'
import SplitEditor, { type SplitValue } from '@/components/SplitEditor'
import { buildDefaultSplits } from '@/lib/utils/splits'

interface RecurringSectionProps {
  householdId: string
  recurring: RecurringExpense[]
  categories: ExpenseCategory[]
  members: HouseholdMemberSummary[]
  onRecurringChanged: (updater: (r: RecurringExpense[]) => RecurringExpense[]) => void
}

function buildSplitsFromExpense(expense: RecurringExpense, members: HouseholdMemberSummary[]): SplitValue[] {
  return expense.splits.length > 0
    ? expense.splits.map((s) => ({ household_member_id: s.household_member_id, percentage: s.percentage, amount: s.amount }))
    : (buildDefaultSplits(members) as SplitValue[])
}

const RECURRING_MIN_DUE_DAY = 1
const RECURRING_MAX_DUE_DAY = 31

function getCurrentDueDay(day = new Date().getDate()): string {
  const clampedDay = Math.min(Math.max(day, RECURRING_MIN_DUE_DAY), RECURRING_MAX_DUE_DAY)
  return String(clampedDay)
}

interface RecurringCardProps {
  expense: RecurringExpense
  householdId: string
  categories: ExpenseCategory[]
  members: HouseholdMemberSummary[]
  onUpdated: (updated: RecurringExpense) => void
  onDeleted: (id: string) => void
}

function RecurringCard({ expense, householdId, categories, members, onUpdated, onDeleted }: RecurringCardProps) {
  const [editing, setEditing] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleToggleActive() {
    setToggling(true)
    setError('')
    try {
      await apiClient.patch(`/api/finances/recurring/${expense.id}`, { is_active: !expense.is_active })
      onUpdated({ ...expense, is_active: !expense.is_active })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setToggling(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${expense.description}"? This cannot be undone.`)) return
    setDeleting(true)
    setError('')
    try {
      await apiClient.delete(`/api/finances/recurring/${expense.id}`)
      onDeleted(expense.id)
    } catch (err) {
      setError(getErrorMessage(err))
      setDeleting(false)
    }
  }

  const day = expense.due_day_of_month

  if (editing) {
    return (
      <RecurringForm
        householdId={householdId}
        categories={categories}
        members={members}
        initialExpense={expense}
        onSaved={(updated) => {
          onUpdated(updated)
          setEditing(false)
        }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-3 ${expense.is_active ? 'bg-white/5 border-white/8' : 'bg-white/2 border-white/5 opacity-60'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{expense.description}</span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={FINANCES.ACTIONS.EDIT}
              className="text-white/35 hover:text-white transition-colors"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M13.92 2.87a2 2 0 0 1 2.83 2.83l-.7.7-2.83-2.83.7-.7Z" />
                <path d="m12.52 4.27 2.83 2.83-8.78 8.78-3.12.71.71-3.12 8.36-9.2Z" />
              </svg>
            </button>
            <span className={`text-xs px-2 py-0.5 rounded-full ${expense.is_active ? 'text-green-400 bg-green-400/10' : 'text-white/30 bg-white/5'}`}>
              {expense.is_active ? FINANCES.SETTINGS.ACTIVE_BADGE : FINANCES.SETTINGS.INACTIVE_BADGE}
            </span>
          </div>
          {expense.category_name && (
            <span className="text-xs text-indigo-400">{expense.category_name}</span>
          )}
        </div>
        <span className="text-sm font-semibold text-white shrink-0">${Number(expense.amount).toFixed(2)}</span>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-white/50">
        <span>{FINANCES.SETTINGS.DUE_ON(day)}</span>
        <span>{FINANCES.SETTINGS.ALERT_DAYS(expense.alert_days_before)}</span>
        {expense.payer && <span>{expense.payer.nickname} pays</span>}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {expense.splits.map((s) => (
          <span key={s.household_member_id} className="text-xs text-white/50 bg-white/5 rounded-full px-2 py-0.5">
            {s.member?.nickname ?? s.household_member_id} {Number(s.percentage).toFixed(0)}% · ${Number(s.amount).toFixed(2)}
          </span>
        ))}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex items-center gap-2 pt-1 border-t border-white/5">
        <button
          onClick={handleToggleActive}
          disabled={toggling}
          className="flex-1 py-2 rounded-lg border border-white/10 text-xs text-white/60 enabled:hover:text-white transition-colors disabled:opacity-50"
        >
          {toggling ? FINANCES.ACTIONS.SAVING : (expense.is_active ? 'Deactivate' : 'Activate')}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex-1 py-2 rounded-lg border border-red-500/20 text-xs text-red-400/70 enabled:hover:text-red-400 enabled:hover:border-red-500/40 transition-colors disabled:opacity-50"
        >
          {deleting ? FINANCES.ACTIONS.DELETING : FINANCES.ACTIONS.DELETE}
        </button>
      </div>
    </div>
  )
}

interface AddRecurringFormProps {
  householdId: string
  categories: ExpenseCategory[]
  members: HouseholdMemberSummary[]
  initialExpense?: RecurringExpense
  onSaved: (expense: RecurringExpense) => void
  onCancel: () => void
}

function RecurringForm({ householdId, categories, members, initialExpense, onSaved, onCancel }: AddRecurringFormProps) {
  const isEditing = Boolean(initialExpense)
  const [description, setDescription] = useState(initialExpense?.description ?? '')
  const [amount, setAmount] = useState(initialExpense ? String(initialExpense.amount) : '')
  const [categoryId, setCategoryId] = useState(initialExpense?.category_id ?? '')
  const [payerId, setPayerId] = useState(initialExpense?.paid_by_member_id ?? members[0]?.id ?? '')
  const [dueDay, setDueDay] = useState(() => initialExpense ? String(initialExpense.due_day_of_month) : getCurrentDueDay())
  const [alertDays, setAlertDays] = useState(initialExpense ? String(initialExpense.alert_days_before) : '3')
  const [splits, setSplits] = useState<SplitValue[]>(() =>
    initialExpense ? buildSplitsFromExpense(initialExpense, members) : (buildDefaultSplits(members) as SplitValue[]),
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const splitsValid = Math.abs(splits.reduce((s, x) => s + x.percentage, 0) - 100) <= 0.01
  const amountNum = parseFloat(amount)
  const dueDayNum = Number(dueDay)
  const alertDaysNum = parseInt(alertDays) || 3
  const dueDayValid = Number.isInteger(dueDayNum) && dueDayNum >= RECURRING_MIN_DUE_DAY && dueDayNum <= RECURRING_MAX_DUE_DAY
  const splitTotalAmount = !isNaN(amountNum) && amountNum > 0 ? amountNum : undefined

  function handleBillAmountChange(newVal: string) {
    setAmount(newVal)
    const parsed = parseFloat(newVal)
    if (!isNaN(parsed) && parsed > 0) {
      setSplits((prev) =>
        prev.map((s) => ({ ...s, amount: Math.round((s.percentage / 100) * parsed * 100) / 100 })),
      )
    }
  }

  async function handleSubmit() {
    if (!description.trim() || !amount || !payerId || !dueDayValid || !splitsValid) return
    setSubmitting(true)
    setError('')
    try {
      // Ensure every split has a concrete amount before submitting
      const splitsWithAmounts = splits.map((s) => ({
        ...s,
        amount: s.amount !== undefined ? s.amount : Math.round((s.percentage / 100) * amountNum * 100) / 100,
      }))

      const payload = {
        description: description.trim(),
        amount: amountNum,
        category_id: categoryId || null,
        paid_by_member_id: payerId,
        due_day_of_month: dueDayNum,
        alert_days_before: alertDaysNum,
        splits: splitsWithAmounts,
        household_id: householdId,
      }

      const res = initialExpense
        ? await apiClient.patch<{ data: { id: string } }>(`/api/finances/recurring/${initialExpense.id}`, payload)
        : await apiClient.post<{ data: { id: string } }>('/api/finances/recurring', payload)
      const expenseId = res.data.data.id

      const updatedSplits: RecurringExpenseSplit[] = splitsWithAmounts.map((s, i) => ({
        id: initialExpense?.splits[i]?.id ?? `new-${i}`,
        recurring_expense_id: expenseId,
        household_member_id: s.household_member_id,
        percentage: s.percentage,
        amount: s.amount,
        member: members.find((m) => m.id === s.household_member_id),
      }))

      const savedExpense: RecurringExpense = {
        id: expenseId,
        household_id: householdId,
        category_id: categoryId || null,
        category_name: categories.find((c) => c.id === categoryId)?.name,
        description: description.trim(),
        amount: amountNum,
        paid_by_member_id: payerId,
        payer: members.find((m) => m.id === payerId),
        due_day_of_month: dueDayNum,
        alert_days_before: alertDaysNum,
        is_active: initialExpense?.is_active ?? true,
        splits: updatedSplits,
      }
      onSaved(savedExpense)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl bg-white/5 border border-white/8 p-4 flex flex-col gap-3">
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (e.g. Monthly Rent)"
        autoFocus
        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-indigo-500"
      />

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-white/40 mb-1 block">Amount ($)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={amount}
            onChange={(e) => handleBillAmountChange(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-white/40 mb-1 block">Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full h-[38px] rounded-lg bg-[#1c1c24] border border-white/10 px-2 text-sm text-white outline-none focus:border-indigo-500"
          >
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-white/40 mb-1 block">Payer</label>
          <select
            value={payerId}
            onChange={(e) => setPayerId(e.target.value)}
            className="w-full h-[38px] rounded-lg bg-[#1c1c24] border border-white/10 px-2 text-sm text-white outline-none focus:border-indigo-500"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.nickname}</option>
            ))}
          </select>
        </div>
        <div className="w-36">
          <label className="text-xs text-white/40 mb-1 block">{FINANCES.SETTINGS.DUE_DATE_LABEL}</label>
          <input
            type="number"
            min={RECURRING_MIN_DUE_DAY}
            max={RECURRING_MAX_DUE_DAY}
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
          />
        </div>
        <div className="w-24">
          <label className="text-xs text-white/40 mb-1 block">Alert days</label>
          <input
            type="number"
            min={0}
            max={28}
            value={alertDays}
            onChange={(e) => setAlertDays(e.target.value)}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
          />
        </div>
      </div>
      <p className="text-xs text-white/30 -mt-1">{FINANCES.SETTINGS.DUE_DATE_HINT}</p>

      <SplitEditor
        members={members}
        value={splits}
        onChange={setSplits}
        totalAmount={splitTotalAmount}
        showAmountInputs
      />

      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onCancel} disabled={submitting} className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-white/60 enabled:hover:text-white transition-colors disabled:opacity-50">
          {FINANCES.ACTIONS.CANCEL}
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || !description.trim() || !amount || isNaN(amountNum) || amountNum <= 0 || !payerId || !dueDayValid || !splitsValid}
          className="flex-1 py-2 rounded-lg bg-indigo-500 enabled:hover:bg-indigo-400 text-white text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {submitting ? FINANCES.ACTIONS.SAVING : (isEditing ? FINANCES.ACTIONS.SAVE : FINANCES.ACTIONS.ADD)}
        </button>
      </div>
    </div>
  )
}

export default function RecurringSection({ householdId, recurring, categories, members, onRecurringChanged }: RecurringSectionProps) {
  const [adding, setAdding] = useState(false)

  return (
    <div className="flex flex-col gap-3">
      {recurring.map((expense) => (
        <RecurringCard
          key={expense.id}
          expense={expense}
          householdId={householdId}
          categories={categories}
          members={members}
          onUpdated={(updated) => onRecurringChanged((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))}
          onDeleted={(id) => onRecurringChanged((prev) => prev.filter((r) => r.id !== id))}
        />
      ))}

      {recurring.length === 0 && !adding && (
        <p className="text-sm text-white/30 py-2">No recurring bills set up yet.</p>
      )}

      {adding ? (
        <RecurringForm
          householdId={householdId}
          categories={categories}
          members={members}
          onSaved={(expense) => { onRecurringChanged((prev) => [...prev, expense]); setAdding(false) }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors py-2"
        >
          <span className="text-lg leading-none">+</span>
          {FINANCES.SETTINGS.ADD_RECURRING}
        </button>
      )}
    </div>
  )
}
