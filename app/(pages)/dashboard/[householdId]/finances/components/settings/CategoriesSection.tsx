'use client'

import { useState } from 'react'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import type { ExpenseCategory, HouseholdMemberSummary, CategorySplit } from '@/lib/types/finances'
import { FINANCES } from '@/locales/en'
import SplitEditor from '../SplitEditor'

interface CategoriesSectionProps {
  householdId: string
  categories: ExpenseCategory[]
  members: HouseholdMemberSummary[]
  onCategoriesChanged: (updater: (cats: ExpenseCategory[]) => ExpenseCategory[]) => void
}

function buildDefaultSplits(members: HouseholdMemberSummary[]): { household_member_id: string; percentage: number }[] {
  if (members.length === 0) return []
  const base = Math.floor((100 / members.length) * 100) / 100
  const remainder = Math.round((100 - base * members.length) * 100) / 100
  return members.map((m, i) => ({
    household_member_id: m.id,
    percentage: i === members.length - 1 ? base + remainder : base,
  }))
}

interface CategoryRowProps {
  category: ExpenseCategory
  members: HouseholdMemberSummary[]
  onUpdated: (updated: ExpenseCategory) => void
  onDeleted: (id: string) => void
}

function CategoryRow({ category, members, onUpdated, onDeleted }: CategoryRowProps) {
  const [editing, setEditing] = useState(false)
  const [nameValue, setNameValue] = useState(category.name)
  const [payerId, setPayerId] = useState(category.paid_by_member_id ?? '')
  const [splits, setSplits] = useState<{ household_member_id: string; percentage: number }[]>(
    category.splits?.map((s) => ({ household_member_id: s.household_member_id, percentage: s.percentage })) ??
      buildDefaultSplits(members),
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const splitsValid = Math.abs(splits.reduce((s, x) => s + x.percentage, 0) - 100) <= 0.01

  function resetEditing() {
    setEditing(false)
    setNameValue(category.name)
    setPayerId(category.paid_by_member_id ?? '')
    setSplits(
      category.splits?.map((s) => ({ household_member_id: s.household_member_id, percentage: s.percentage })) ??
        buildDefaultSplits(members),
    )
    setError('')
  }

  async function handleSaveCategory() {
    if (!nameValue.trim() || !splitsValid) return
    setSaving(true)
    setError('')
    try {
      const res = await apiClient.patch<{ data: ExpenseCategory }>(
        `/api/finances/categories/${category.id}`,
        { name: nameValue.trim(), paid_by_member_id: payerId || null },
      )
      await apiClient.put(`/api/finances/categories/${category.id}/splits`, { splits })
      const updatedSplits: CategorySplit[] = splits.map((s, i) => ({
        id: category.splits?.[i]?.id ?? `temp-${i}`,
        category_id: category.id,
        household_member_id: s.household_member_id,
        percentage: s.percentage,
        member: members.find((m) => m.id === s.household_member_id),
      }))
      onUpdated({
        ...res.data.data,
        splits: updatedSplits,
        payer: members.find((m) => m.id === payerId),
      })
      setEditing(false)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete category "${category.name}"?`)) return
    setDeleting(true)
    setError('')
    try {
      await apiClient.delete(`/api/finances/categories/${category.id}`)
      onDeleted(category.id)
    } catch (err) {
      setError(getErrorMessage(err))
      setDeleting(false)
    }
  }

  return (
    <div className="rounded-xl bg-white/5 border border-white/8 p-4 flex flex-col gap-3">
      {editing ? (
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50">{FINANCES.SETTINGS.PAYER_LABEL}</span>
            <select
              value={payerId}
              onChange={(e) => setPayerId(e.target.value)}
              className="flex-1 rounded-lg bg-[#1c1c24] border border-white/10 px-2 py-1.5 text-sm text-white outline-none focus:border-indigo-500"
            >
              <option value="">{FINANCES.SETTINGS.NO_OWNER}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.nickname}</option>
              ))}
            </select>
          </div>
          <SplitEditor members={members} value={splits} onChange={setSplits} />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={resetEditing}
              disabled={saving}
              className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-white/60 enabled:hover:text-white transition-colors disabled:opacity-50"
            >
              {FINANCES.ACTIONS.CANCEL}
            </button>
            <button
              onClick={handleSaveCategory}
              disabled={saving || !nameValue.trim() || !splitsValid}
              className="flex-1 py-2 rounded-lg bg-indigo-500 enabled:hover:bg-indigo-400 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {saving ? FINANCES.ACTIONS.SAVING : FINANCES.ACTIONS.SAVE}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-semibold text-white">{category.name}</span>
            {category.payer && (
              <span className="ml-2 text-xs text-white/40">{category.payer.nickname} pays</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-white/40 hover:text-white transition-colors"
            >
              {FINANCES.ACTIONS.EDIT}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs text-white/40 enabled:hover:text-red-400 transition-colors disabled:opacity-50"
            >
              {deleting ? FINANCES.ACTIONS.DELETING : FINANCES.ACTIONS.DELETE}
            </button>
          </div>
        </div>
      )}

      {!editing && (
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-1.5">
            {(category.splits ?? []).map((s) => (
              <span key={s.household_member_id} className="text-xs text-white/50 bg-white/5 rounded-full px-2 py-0.5">
                {s.member?.nickname ?? s.household_member_id} {s.percentage}%
              </span>
            ))}
            {(category.splits ?? []).length === 0 && (
              <span className="text-xs text-white/30">No splits configured</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function CategoriesSection({ householdId, categories, members, onCategoriesChanged }: CategoriesSectionProps) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPayerId, setNewPayerId] = useState('')
  const [newSplits, setNewSplits] = useState(() => buildDefaultSplits(members))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const newSplitsValid = Math.abs(newSplits.reduce((s, x) => s + x.percentage, 0) - 100) <= 0.01

  async function handleAddCategory() {
    if (!newName.trim() || !newSplitsValid) return
    setSubmitting(true)
    setError('')
    try {
      const res = await apiClient.post<{ data: ExpenseCategory }>('/api/finances/categories', {
        name: newName.trim(),
        paid_by_member_id: newPayerId || null,
        household_id: householdId,
      })
      const newCat = res.data.data

      await apiClient.put(`/api/finances/categories/${newCat.id}/splits`, { splits: newSplits })

      const splitsWithMembers: CategorySplit[] = newSplits.map((s, i) => ({
        id: `new-${i}`,
        category_id: newCat.id,
        household_member_id: s.household_member_id,
        percentage: s.percentage,
        member: members.find((m) => m.id === s.household_member_id),
      }))

      onCategoriesChanged((prev) => [...prev, { ...newCat, splits: splitsWithMembers, payer: members.find((m) => m.id === newPayerId) }])
      setAdding(false)
      setNewName('')
      setNewPayerId('')
      setNewSplits(buildDefaultSplits(members))
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {categories.map((cat) => (
        <CategoryRow
          key={cat.id}
          category={cat}
          members={members}
          onUpdated={(updated) => onCategoriesChanged((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))}
          onDeleted={(id) => onCategoriesChanged((prev) => prev.filter((c) => c.id !== id))}
        />
      ))}

      {adding ? (
        <div className="rounded-xl bg-white/5 border border-white/8 p-4 flex flex-col gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Category name"
            autoFocus
            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-indigo-500"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50">{FINANCES.SETTINGS.PAYER_LABEL}</span>
            <select
              value={newPayerId}
              onChange={(e) => setNewPayerId(e.target.value)}
              className="flex-1 rounded-lg bg-[#1c1c24] border border-white/10 px-2 py-1.5 text-sm text-white outline-none focus:border-indigo-500"
            >
              <option value="">{FINANCES.SETTINGS.NO_OWNER}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.nickname}</option>
              ))}
            </select>
          </div>
          <SplitEditor members={members} value={newSplits} onChange={setNewSplits} />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => { setAdding(false); setError('') }}
              disabled={submitting}
              className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-white/60 enabled:hover:text-white transition-colors disabled:opacity-50"
            >
              {FINANCES.ACTIONS.CANCEL}
            </button>
            <button
              onClick={handleAddCategory}
              disabled={submitting || !newName.trim() || !newSplitsValid}
              className="flex-1 py-2 rounded-lg bg-indigo-500 enabled:hover:bg-indigo-400 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {submitting ? FINANCES.ACTIONS.ADDING : FINANCES.ACTIONS.ADD}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors py-2"
        >
          <span className="text-lg leading-none">+</span>
          {FINANCES.SETTINGS.ADD_CATEGORY}
        </button>
      )}
    </div>
  )
}
