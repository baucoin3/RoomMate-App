'use client'

import { useEffect, useRef, useState } from 'react'
import { GUESTS } from '@/locales/en'
import { apiClient } from '@/lib/api/client'
import GuestChip from './GuestChip'
import AddGuestModal from '@/components/guests/AddGuestModal'
import type { HouseholdGuest, HouseholdGuestGroup } from '@/lib/types/guests'

interface Props {
  householdId: string
  availableGuests: HouseholdGuest[]
  selectedGuests: HouseholdGuest[]
  onChange: (guests: HouseholdGuest[]) => void
  onGuestCreated?: (guest: HouseholdGuest) => void
}

export default function AddParticipantsControl({
  householdId,
  availableGuests,
  selectedGuests,
  onChange,
  onGuestCreated,
}: Props) {
  const [groups, setGroups] = useState<HouseholdGuestGroup[]>([])
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showGroupPicker, setShowGroupPicker] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const selectedIds = new Set(selectedGuests.map((g) => g.id))

  useEffect(() => {
    let cancelled = false
    apiClient
      .get<{ data: HouseholdGuestGroup[] }>(`/api/guests/groups?householdId=${householdId}`)
      .then((res) => {
        if (!cancelled) setGroups(res.data.data ?? [])
      })
      .catch((err) => console.error('[AddParticipantsControl] load guest groups', err))
      .finally(() => {
        if (!cancelled) setGroupsLoading(false)
      })
    return () => { cancelled = true }
  }, [householdId])

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const filteredGuests = availableGuests.filter(
    (g) =>
      !selectedIds.has(g.id) &&
      (search === '' || g.name.toLowerCase().includes(search.toLowerCase())),
  )

  function addGuest(guest: HouseholdGuest) {
    if (!selectedIds.has(guest.id)) {
      onChange([...selectedGuests, guest])
    }
    setSearch('')
    setShowDropdown(false)
  }

  function removeGuest(guestId: string) {
    onChange(selectedGuests.filter((g) => g.id !== guestId))
  }

  async function handleCreateGuest(data: { name: string; email: string | null; expires_at: string | null }) {
    const res = await apiClient.post<{ data: HouseholdGuest }>('/api/guests', {
      household_id: householdId,
      ...data,
    })
    const newGuest = res.data.data
    onGuestCreated?.(newGuest)
    addGuest(newGuest)
  }

  function addGroup(group: HouseholdGuestGroup) {
    const membersToAdd = (group.members ?? []).filter((m) => !selectedIds.has(m.id))
    onChange([...selectedGuests, ...membersToAdd])
    setShowGroupPicker(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setSearch('')
            setShowDropdown(true)
          }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-400/25 text-indigo-200 text-sm font-medium hover:bg-indigo-500/15 hover:border-indigo-400/35 hover:text-indigo-100 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
          </svg>
          {GUESTS.WIZARD_STEP.ADD_INDIVIDUAL}
        </button>

        {groups.length > 0 && (
          <button
            type="button"
            onClick={() => setShowGroupPicker(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-violet-500/10 border border-violet-400/25 text-violet-200 text-sm font-medium hover:bg-violet-500/15 hover:border-violet-400/35 hover:text-violet-100 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
            {GUESTS.WIZARD_STEP.ADD_GROUP}
          </button>
        )}
      </div>

      {showDropdown && (
        <div ref={searchRef} className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={GUESTS.WIZARD_STEP.SEARCH_PLACEHOLDER}
            autoFocus
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          {(filteredGuests.length > 0 || search.trim()) && (
            <ul className="absolute left-0 right-0 top-full mt-1 z-20 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-[#2a2a32] shadow-xl">
              {filteredGuests.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addGuest(g)}
                    className="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/5 flex items-center gap-2"
                  >
                    <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-semibold text-indigo-300">
                        {g.name[0]?.toUpperCase()}
                      </span>
                    </div>
                    <span className="font-medium">{g.name}</span>
                    {g.email && (
                      <span className="text-xs text-white/35 ml-auto truncate">{g.email}</span>
                    )}
                  </button>
                </li>
              ))}
              {search.trim() && !filteredGuests.some(
                (g) => g.name.toLowerCase() === search.trim().toLowerCase(),
              ) && (
                <li>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setShowDropdown(false)
                      setShowCreateModal(true)
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-indigo-300/80 hover:bg-white/5 border-t border-white/5"
                  >
                    + {GUESTS.WIZARD_STEP.CREATE_NEW}: &ldquo;{search.trim()}&rdquo;
                  </button>
                </li>
              )}
              {filteredGuests.length === 0 && !search.trim() && (
                <li className="px-4 py-3 text-sm text-white/30">
                  {groupsLoading ? GUESTS.LOADING : GUESTS.WIZARD_STEP.NO_GUESTS}
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      {selectedGuests.length > 0 && (
        <div>
          <p className="text-xs text-white/40 mb-2">{GUESTS.WIZARD_STEP.SELECTED}</p>
          <div className="flex flex-wrap gap-2">
            {selectedGuests.map((g) => (
              <GuestChip key={g.id} guest={g} onRemove={removeGuest} />
            ))}
          </div>
        </div>
      )}

      {showGroupPicker && (
        <div className="flex flex-col gap-2 p-4 rounded-xl bg-white/[0.03] border border-white/10">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium text-white/80">{GUESTS.GROUP_PICKER_TITLE}</p>
            <button
              type="button"
              onClick={() => setShowGroupPicker(false)}
              className="text-white/40 hover:text-white transition-colors text-sm"
              aria-label={GUESTS.CLOSE}
            >
              ✕
            </button>
          </div>
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => addGroup(group)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-violet-300">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-white/80">{group.name}</p>
                <p className="text-xs text-white/40">
                  {GUESTS.GROUP_MEMBER_COUNT(group.members?.length ?? 0)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {showCreateModal && (
        <AddGuestModal
          onSave={handleCreateGuest}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  )
}
