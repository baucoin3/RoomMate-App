'use client'

import { useState, useEffect, useRef } from 'react'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import type { HouseholdItemRule, ExpenseCategory, HouseholdMemberSummary } from '@/lib/types/finances'
import { FINANCES } from '@/locales/en'
import SplitEditor from '../SplitEditor'

interface ItemRulesSectionProps {
  householdId: string
  rules: HouseholdItemRule[]
  categories: ExpenseCategory[]
  members: HouseholdMemberSummary[]
  onRulesChanged: (updater: (rules: HouseholdItemRule[]) => HouseholdItemRule[]) => void
}

function buildDefaultSplits(members: HouseholdMemberSummary[]) {
  if (members.length === 0) return []
  const base = Math.floor((100 / members.length) * 100) / 100
  const remainder = Math.round((100 - base * members.length) * 100) / 100
  return members.map((m, i) => ({
    household_member_id: m.id,
    percentage: i === members.length - 1 ? base + remainder : base,
  }))
}

interface AddRuleFormProps {
  householdId: string
  categories: ExpenseCategory[]
  members: HouseholdMemberSummary[]
  initialRule?: HouseholdItemRule
  onSaved: (rule: HouseholdItemRule) => void
  onCancel: () => void
}

function RuleForm({ householdId, categories, members, initialRule, onSaved, onCancel }: AddRuleFormProps) {
  const isEditing = Boolean(initialRule)
  const [name, setName] = useState(initialRule?.name ?? '')
  const [categoryId, setCategoryId] = useState(initialRule?.category_id ?? '')
  const [group, setGroup] = useState(initialRule?.item_group ?? '')
  const [useCustomSplit, setUseCustomSplit] = useState(Boolean(initialRule?.split_overrides))
  const [splits, setSplits] = useState(() => initialRule?.split_overrides
    ? initialRule.split_overrides.map((s) => ({ household_member_id: s.member_id, percentage: s.percentage }))
    : buildDefaultSplits(members))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [groupSuggestions, setGroupSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const splitsValid = !useCustomSplit || Math.abs(splits.reduce((s, x) => s + x.percentage, 0) - 100) <= 0.01

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!group.trim()) { setGroupSuggestions([]); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await apiClient.get<{ data: string[] }>(
          `/api/finances/item-rules/groups?householdId=${householdId}`,
        )
        setGroupSuggestions((res.data.data ?? []).filter((g) => g.toLowerCase().includes(group.toLowerCase())))
      } catch { setGroupSuggestions([]) }
    }, 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [group, householdId])

  async function handleSubmit() {
    if (!name.trim() || !splitsValid) return
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        name: name.trim(),
        category_id: categoryId || null,
        item_group: group.trim() || null,
        split_overrides: useCustomSplit ? splits.map((s) => ({ member_id: s.household_member_id, percentage: s.percentage })) : null,
        household_id: householdId,
      }
      const res = initialRule
        ? await apiClient.patch<{ data: HouseholdItemRule }>(`/api/finances/item-rules/${initialRule.id}`, payload)
        : await apiClient.post<{ data: HouseholdItemRule }>('/api/finances/item-rules', payload)
      const catName = categories.find((c) => c.id === categoryId)?.name
      onSaved({ ...res.data.data, category_name: catName })
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
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Item name (e.g. green beans)"
        autoFocus
        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-indigo-500"
      />

      <select
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        className="w-full rounded-lg bg-[#1c1c24] border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
      >
        <option value="">No category</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <div className="relative">
        <input
          type="text"
          value={group}
          onChange={(e) => { setGroup(e.target.value); setShowSuggestions(true) }}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder="Group (e.g. veggies)"
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-indigo-500"
        />
        {showSuggestions && groupSuggestions.length > 0 && (
          <ul className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl border border-white/10 bg-[#2a2a32] shadow-xl overflow-hidden">
            {groupSuggestions.map((g) => (
              <li key={g}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setGroup(g); setShowSuggestions(false) }}
                  className="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/5"
                >
                  {g}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Split override toggle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setUseCustomSplit(false)}
          className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${!useCustomSplit ? 'bg-white/10 border-white/20 text-white' : 'border-white/10 text-white/40 hover:text-white/70'}`}
        >
          {FINANCES.SETTINGS.USE_CATEGORY_DEFAULT}
        </button>
        <button
          type="button"
          onClick={() => setUseCustomSplit(true)}
          className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${useCustomSplit ? 'bg-white/10 border-white/20 text-white' : 'border-white/10 text-white/40 hover:text-white/70'}`}
        >
          {FINANCES.SETTINGS.CUSTOM_SPLIT}
        </button>
      </div>

      {useCustomSplit && <SplitEditor members={members} value={splits} onChange={setSplits} />}

      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onCancel} disabled={submitting} className="flex-1 py-2 rounded-lg border border-white/10 text-sm text-white/60 enabled:hover:text-white transition-colors disabled:opacity-50">
          {FINANCES.ACTIONS.CANCEL}
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || !name.trim() || !splitsValid}
          className="flex-1 py-2 rounded-lg bg-indigo-500 enabled:hover:bg-indigo-400 text-white text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {submitting ? FINANCES.ACTIONS.SAVING : (isEditing ? FINANCES.ACTIONS.SAVE : FINANCES.ACTIONS.ADD)}
        </button>
      </div>
    </div>
  )
}

interface RuleRowProps {
  rule: HouseholdItemRule
  householdId: string
  categories: ExpenseCategory[]
  members: HouseholdMemberSummary[]
  deleting: boolean
  onUpdated: (rule: HouseholdItemRule) => void
  onDelete: (id: string) => void
}

function RuleRow({ rule, householdId, categories, members, deleting, onUpdated, onDelete }: RuleRowProps) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <RuleForm
        householdId={householdId}
        categories={categories}
        members={members}
        initialRule={rule}
        onSaved={(updated) => {
          onUpdated(updated)
          setEditing(false)
        }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/8">
      <div className="flex-1 min-w-0">
        <span className="text-sm text-white font-medium">{rule.name}</span>
        {rule.category_name && (
          <span className="ml-2 text-xs text-indigo-400 bg-indigo-400/10 rounded-full px-2 py-0.5">
            {rule.category_name}
          </span>
        )}
        <div className="mt-0.5 text-xs text-white/40">
          {rule.split_overrides
            ? rule.split_overrides.map((s) => {
                const m = members.find((mb) => mb.id === s.member_id)
                return `${m?.nickname ?? s.member_id} ${s.percentage}%`
              }).join(' / ')
            : FINANCES.SETTINGS.USES_DEFAULT}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-white/30 hover:text-white transition-colors"
        >
          {FINANCES.ACTIONS.EDIT}
        </button>
        <button
          onClick={() => onDelete(rule.id)}
          disabled={deleting}
          className="text-xs text-white/30 enabled:hover:text-red-400 transition-colors disabled:opacity-50"
        >
          {deleting ? FINANCES.ACTIONS.DELETING : FINANCES.ACTIONS.DELETE}
        </button>
      </div>
    </div>
  )
}

export default function ItemRulesSection({ householdId, rules, categories, members, onRulesChanged }: ItemRulesSectionProps) {
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')

  async function handleDelete(id: string) {
    if (!confirm('Delete this item rule?')) return
    setDeleting(id)
    setDeleteError('')
    try {
      await apiClient.delete(`/api/finances/item-rules/${id}`)
      onRulesChanged((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      setDeleteError(getErrorMessage(err))
    } finally {
      setDeleting(null)
    }
  }

  const grouped = rules.reduce<Record<string, HouseholdItemRule[]>>((acc, rule) => {
    const key = rule.item_group ?? '__ungrouped__'
    return { ...acc, [key]: [...(acc[key] ?? []), rule] }
  }, {})

  const sortedGroups = Object.keys(grouped).sort((a, b) => {
    if (a === '__ungrouped__') return 1
    if (b === '__ungrouped__') return -1
    return a.localeCompare(b)
  })

  return (
    <div className="flex flex-col gap-4">
      {sortedGroups.map((groupKey) => (
        <div key={groupKey} className="flex flex-col gap-2">
          <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wide">
            {groupKey === '__ungrouped__' ? FINANCES.SETTINGS.UNGROUPED : groupKey}
          </h4>
          {grouped[groupKey].map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              householdId={householdId}
              categories={categories}
              members={members}
              deleting={deleting === rule.id}
              onUpdated={(updated) => onRulesChanged((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ))}

      {deleteError && <p className="text-xs text-red-400">{deleteError}</p>}

      {rules.length === 0 && !adding && (
        <p className="text-sm text-white/30 py-2">No item rules yet.</p>
      )}

      {adding ? (
        <RuleForm
          householdId={householdId}
          categories={categories}
          members={members}
          onSaved={(rule) => { onRulesChanged((prev) => [...prev, rule]); setAdding(false) }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors py-2"
        >
          <span className="text-lg leading-none">+</span>
          {FINANCES.SETTINGS.ADD_ITEM_RULE}
        </button>
      )}
    </div>
  )
}
