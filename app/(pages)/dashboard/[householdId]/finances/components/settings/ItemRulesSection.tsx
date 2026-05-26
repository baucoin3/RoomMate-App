'use client'

import { useState, useEffect, useRef } from 'react'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import type { ExpenseCategory, HouseholdMemberSummary } from '@/lib/types/finances'
import type { HouseholdItem, HouseholdItemAlias } from '@/lib/types/householdItems'
import { FINANCES } from '@/locales/en'
import SplitEditor from '@/components/SplitEditor'
import { buildDefaultSplits, splitsSumTo100 } from '@/lib/utils/splits'

interface ItemRulesSectionProps {
  householdId: string
  items: HouseholdItem[]
  categories: ExpenseCategory[]
  members: HouseholdMemberSummary[]
  onItemsChanged: (updater: (items: HouseholdItem[]) => HouseholdItem[]) => void
}

interface ItemFormProps {
  householdId: string
  categories: ExpenseCategory[]
  members: HouseholdMemberSummary[]
  initialItem?: HouseholdItem
  onSaved: (item: HouseholdItem) => void
  onCancel: () => void
}

function ItemForm({ householdId, categories, members, initialItem, onSaved, onCancel }: ItemFormProps) {
  const isEditing = Boolean(initialItem)
  const [name, setName] = useState(initialItem?.name ?? '')
  const [categoryId, setCategoryId] = useState(initialItem?.default_category_id ?? '')
  const [group, setGroup] = useState(initialItem?.item_group ?? '')
  const [useCustomSplit, setUseCustomSplit] = useState(Boolean(initialItem?.split_overrides))
  const [splits, setSplits] = useState(() => initialItem?.split_overrides
    ? initialItem.split_overrides.map((s) => ({ household_member_id: s.member_id, percentage: s.percentage }))
    : buildDefaultSplits(members))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [groupSuggestions, setGroupSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const splitsValid = !useCustomSplit || splitsSumTo100(splits)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!group.trim()) { setGroupSuggestions([]); return }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await apiClient.get<{ data: string[] }>(
          `/api/household-items/groups?householdId=${householdId}`,
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
        default_category_id: categoryId || null,
        item_group: group.trim() || null,
        split_overrides: useCustomSplit ? splits.map((s) => ({ member_id: s.household_member_id, percentage: s.percentage })) : null,
        household_id: householdId,
      }
      const res = initialItem
        ? await apiClient.patch<{ data: HouseholdItem }>(`/api/household-items/${initialItem.id}`, payload)
        : await apiClient.post<{ data: HouseholdItem }>('/api/household-items', payload)
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
        placeholder={FINANCES.SETTINGS.ITEM_NAME_PLACEHOLDER}
        autoFocus
        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-indigo-500"
      />

      <select
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        className="w-full rounded-lg bg-[#1c1c24] border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
      >
        <option value="">{FINANCES.SETTINGS.NO_CATEGORY}</option>
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
          placeholder={FINANCES.SETTINGS.GROUP_PLACEHOLDER}
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

interface AliasesPanelProps {
  item: HouseholdItem
  onAliasAdded: (alias: HouseholdItemAlias) => void
  onAliasDeleted: (aliasId: string) => void
}

function AliasesPanel({ item, onAliasAdded, onAliasDeleted }: AliasesPanelProps) {
  const [open, setOpen] = useState(false)
  const [newAlias, setNewAlias] = useState('')
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleAddAlias() {
    const text = newAlias.trim()
    if (!text) return
    setAdding(true)
    setError('')
    try {
      const res = await apiClient.post<{ data: HouseholdItemAlias }>(
        `/api/household-items/${item.id}/aliases`,
        { display_text: text },
      )
      onAliasAdded(res.data.data)
      setNewAlias('')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setAdding(false)
    }
  }

  async function handleDeleteAlias(aliasId: string) {
    setDeleting(aliasId)
    setError('')
    try {
      await apiClient.delete(`/api/household-items/aliases/${aliasId}`)
      onAliasDeleted(aliasId)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="mt-2 border-t border-white/8 pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-white/40 hover:text-white/70 transition-colors"
      >
        {FINANCES.SETTINGS.ALIASES_SECTION} ({(item.aliases ?? []).length})
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2">
          <div className="max-h-28 overflow-y-auto flex flex-col gap-1">
            {(item.aliases ?? []).length === 0 ? (
              <p className="text-xs text-white/30">{FINANCES.SETTINGS.NO_ALIASES}</p>
            ) : (
              (item.aliases ?? []).map((alias) => (
                <div key={alias.id} className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-white/3">
                  <span className="text-xs text-white/70 truncate">{alias.display_text}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteAlias(alias.id)}
                    disabled={deleting === alias.id}
                    className="text-[10px] text-white/30 enabled:hover:text-red-400 disabled:opacity-50"
                  >
                    {deleting === alias.id ? FINANCES.ACTIONS.DELETING : FINANCES.SETTINGS.DELETE_ALIAS}
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              placeholder={FINANCES.SETTINGS.ADD_ALIAS_PLACEHOLDER}
              className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-white placeholder:text-white/25 outline-none focus:border-indigo-500"
            />
            <button
              type="button"
              onClick={handleAddAlias}
              disabled={adding || !newAlias.trim()}
              className="px-2.5 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs disabled:opacity-50"
            >
              {adding ? FINANCES.ACTIONS.ADDING : FINANCES.SETTINGS.ADD_ALIAS}
            </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}
    </div>
  )
}

interface ItemRowProps {
  item: HouseholdItem
  householdId: string
  categories: ExpenseCategory[]
  members: HouseholdMemberSummary[]
  deleting: boolean
  onUpdated: (item: HouseholdItem) => void
  onDelete: (id: string) => void
}

function ItemRow({ item, householdId, categories, members, deleting, onUpdated, onDelete }: ItemRowProps) {
  const [editing, setEditing] = useState(false)
  const [localItem, setLocalItem] = useState(item)

  useEffect(() => {
    setLocalItem(item)
  }, [item])

  if (editing) {
    return (
      <ItemForm
        householdId={householdId}
        categories={categories}
        members={members}
        initialItem={localItem}
        onSaved={(updated) => {
          onUpdated(updated)
          setEditing(false)
        }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/8">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <span className="text-sm text-white font-medium">{localItem.name}</span>
          {localItem.category_name && (
            <span className="ml-2 text-xs text-indigo-400 bg-indigo-400/10 rounded-full px-2 py-0.5">
              {localItem.category_name}
            </span>
          )}
          <div className="mt-0.5 text-xs text-white/40">
            {localItem.split_overrides
              ? localItem.split_overrides.map((s) => {
                  const m = members.find((mb) => mb.id === s.member_id)
                  return `${m?.nickname ?? s.member_id} ${s.percentage}%`
                }).join(' / ')
              : (() => {
                  const cat = localItem.default_category_id
                    ? categories.find((c) => c.id === localItem.default_category_id)
                    : null
                  const catSplits = cat?.splits ?? []
                  if (catSplits.length === 0) return FINANCES.SETTINGS.USES_DEFAULT
                  return catSplits.map((s) => {
                    const m = members.find((mb) => mb.id === s.household_member_id)
                    return `${m?.nickname ?? s.household_member_id} ${s.percentage}%`
                  }).join(' / ') + ` (${FINANCES.SETTINGS.VIA_CATEGORY(cat!.name)})`
                })()}
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
            onClick={() => onDelete(localItem.id)}
            disabled={deleting}
            className="text-xs text-white/30 enabled:hover:text-red-400 transition-colors disabled:opacity-50"
          >
            {deleting ? FINANCES.ACTIONS.DELETING : FINANCES.ACTIONS.DELETE}
          </button>
        </div>
      </div>
      <AliasesPanel
        item={localItem}
        onAliasAdded={(alias) => {
          const updated = { ...localItem, aliases: [...(localItem.aliases ?? []), alias] }
          setLocalItem(updated)
          onUpdated(updated)
        }}
        onAliasDeleted={(aliasId) => {
          const updated = {
            ...localItem,
            aliases: (localItem.aliases ?? []).filter((a) => a.id !== aliasId),
          }
          setLocalItem(updated)
          onUpdated(updated)
        }}
      />
    </div>
  )
}

export default function ItemRulesSection({ householdId, items, categories, members, onItemsChanged }: ItemRulesSectionProps) {
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')

  async function handleDelete(id: string) {
    if (!confirm(FINANCES.SETTINGS.DELETE_HOUSEHOLD_ITEM_CONFIRM)) return
    setDeleting(id)
    setDeleteError('')
    try {
      await apiClient.delete(`/api/household-items/${id}`)
      onItemsChanged((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      setDeleteError(getErrorMessage(err))
    } finally {
      setDeleting(null)
    }
  }

  const grouped = items.reduce<Record<string, HouseholdItem[]>>((acc, item) => {
    const key = item.item_group ?? '__ungrouped__'
    return { ...acc, [key]: [...(acc[key] ?? []), item] }
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
          {grouped[groupKey].map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              householdId={householdId}
              categories={categories}
              members={members}
              deleting={deleting === item.id}
              onUpdated={(updated) => onItemsChanged((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ))}

      {deleteError && <p className="text-xs text-red-400">{deleteError}</p>}

      {items.length === 0 && !adding && (
        <p className="text-sm text-white/30 py-2">{FINANCES.SETTINGS.NO_HOUSEHOLD_ITEMS}</p>
      )}

      {adding ? (
        <ItemForm
          householdId={householdId}
          categories={categories}
          members={members}
          onSaved={(item) => { onItemsChanged((prev) => [...prev, item]); setAdding(false) }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors py-2"
        >
          <span className="text-lg leading-none">+</span>
          {FINANCES.SETTINGS.ADD_HOUSEHOLD_ITEM}
        </button>
      )}
    </div>
  )
}
