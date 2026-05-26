'use client'

import { useEffect, useState } from 'react'
import { GUESTS } from '@/locales/en'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import GuestCard from './GuestCard'
import GuestGroupCard from './GuestGroupCard'
import AddGuestModal from './AddGuestModal'
import AddGroupModal from './AddGroupModal'
import type { HouseholdGuest, HouseholdGuestGroup } from '@/lib/types/guests'

interface Props {
  householdId: string
}

export default function GuestsSection({ householdId }: Props) {
  const [guests, setGuests] = useState<HouseholdGuest[]>([])
  const [groups, setGroups] = useState<HouseholdGuestGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showAddGuest, setShowAddGuest] = useState(false)
  const [editingGuest, setEditingGuest] = useState<HouseholdGuest | null>(null)
  const [showAddGroup, setShowAddGroup] = useState(false)
  const [editingGroup, setEditingGroup] = useState<HouseholdGuestGroup | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const [guestsRes, groupsRes] = await Promise.all([
          apiClient.get<{ data: HouseholdGuest[] }>(`/api/guests?householdId=${householdId}`),
          apiClient.get<{ data: HouseholdGuestGroup[] }>(`/api/guests/groups?householdId=${householdId}`),
        ])
        if (!cancelled) {
          setGuests(guestsRes.data.data ?? [])
          setGroups(groupsRes.data.data ?? [])
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [householdId])

  async function handleAddGuest(data: { name: string; email: string | null; expires_at: string | null }) {
    const res = await apiClient.post<{ data: HouseholdGuest }>('/api/guests', {
      household_id: householdId,
      ...data,
    })
    setGuests((prev) => [...prev, res.data.data].sort((a, b) => a.name.localeCompare(b.name)))
  }

  async function handleEditGuest(data: { name: string; email: string | null; expires_at: string | null }) {
    if (!editingGuest) return
    const res = await apiClient.patch<{ data: HouseholdGuest }>(`/api/guests/${editingGuest.id}`, data)
    setGuests((prev) =>
      prev
        .map((g) => (g.id === editingGuest.id ? res.data.data : g))
        .sort((a, b) => a.name.localeCompare(b.name)),
    )
    setEditingGuest(null)
  }

  async function handleDeleteGuest(guest: HouseholdGuest) {
    if (!confirm(`Delete guest "${guest.name}"?`)) return
    try {
      await apiClient.delete(`/api/guests/${guest.id}`)
      setGuests((prev) => prev.filter((g) => g.id !== guest.id))
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  async function handleAddGroup(data: {
    name: string
    expires_at: string | null
    guest_ids: string[]
  }) {
    const res = await apiClient.post<{ data: HouseholdGuestGroup }>('/api/guests/groups', {
      household_id: householdId,
      ...data,
    })
    setGroups((prev) => [...prev, res.data.data].sort((a, b) => a.name.localeCompare(b.name)))
  }

  async function handleEditGroup(data: {
    name: string
    expires_at: string | null
    guest_ids: string[]
  }) {
    if (!editingGroup) return
    const res = await apiClient.patch<{ data: HouseholdGuestGroup }>(
      `/api/guests/groups/${editingGroup.id}`,
      data,
    )
    setGroups((prev) =>
      prev
        .map((g) => (g.id === editingGroup.id ? res.data.data : g))
        .sort((a, b) => a.name.localeCompare(b.name)),
    )
    setEditingGroup(null)
  }

  async function handleDeleteGroup(group: HouseholdGuestGroup) {
    if (!confirm(`Delete group "${group.name}"?`)) return
    try {
      await apiClient.delete(`/api/guests/groups/${group.id}`)
      setGroups((prev) => prev.filter((g) => g.id !== group.id))
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-xl">
          {error}
        </p>
      )}

      {/* Individual guests */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">
            {GUESTS.INDIVIDUAL}
          </h3>
          <button
            type="button"
            onClick={() => setShowAddGuest(true)}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
          >
            + {GUESTS.ACTIONS.ADD_GUEST}
          </button>
        </div>

        {guests.length === 0 ? (
          <div className="px-4 py-5 rounded-xl bg-white/[0.02] border border-dashed border-white/10 text-center">
            <p className="text-sm text-white/40">{GUESTS.EMPTY_GUESTS}</p>
            <p className="text-xs text-white/25 mt-1">{GUESTS.EMPTY_GUESTS_CTA}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {guests.map((g) => (
              <GuestCard
                key={g.id}
                guest={g}
                onEdit={(guest) => setEditingGuest(guest)}
                onDelete={handleDeleteGuest}
              />
            ))}
          </div>
        )}
      </div>

      {/* Guest groups */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">
            {GUESTS.GROUP}s
          </h3>
          <button
            type="button"
            onClick={() => setShowAddGroup(true)}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
          >
            + {GUESTS.ACTIONS.ADD_GROUP}
          </button>
        </div>

        {groups.length === 0 ? (
          <div className="px-4 py-5 rounded-xl bg-white/[0.02] border border-dashed border-white/10 text-center">
            <p className="text-sm text-white/40">{GUESTS.EMPTY_GROUPS}</p>
            <p className="text-xs text-white/25 mt-1">{GUESTS.EMPTY_GROUPS_CTA}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {groups.map((g) => (
              <GuestGroupCard
                key={g.id}
                group={g}
                onEdit={(group) => setEditingGroup(group)}
                onDelete={handleDeleteGroup}
              />
            ))}
          </div>
        )}
      </div>

      {(showAddGuest || editingGuest) && (
        <AddGuestModal
          guest={editingGuest ?? undefined}
          onSave={editingGuest ? handleEditGuest : handleAddGuest}
          onClose={() => {
            setShowAddGuest(false)
            setEditingGuest(null)
          }}
        />
      )}

      {(showAddGroup || editingGroup) && (
        <AddGroupModal
          group={editingGroup ?? undefined}
          availableGuests={guests}
          onSave={editingGroup ? handleEditGroup : handleAddGroup}
          onClose={() => {
            setShowAddGroup(false)
            setEditingGroup(null)
          }}
        />
      )}
    </div>
  )
}
