'use client'

import { useState, useEffect } from 'react'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import type { HouseholdMemberSummary } from '@/lib/types/finances'
import { FINANCES } from '@/locales/en'
import OverviewTab from './components/OverviewTab'
import SettingsTab from './components/SettingsTab'
import { useParams } from 'next/navigation'

type Tab = 'overview' | 'settings'

export default function FinancesPage() {
  const { householdId } = useParams<{ householdId: string }>()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [members, setMembers] = useState<HouseholdMemberSummary[]>([])
  const [membersError, setMembersError] = useState('')

  useEffect(() => {
    async function fetchMembers() {
      try {
        const res = await apiClient.get<{ data: HouseholdMemberSummary[] }>(
          `/api/households/${householdId}/members`,
        )
        console.log(`IN GET FINANCES MEMBERES = ${JSON.stringify(res.data.data)}`)
        setMembers(res.data.data ?? [])
      } catch (err) {
        setMembersError(getErrorMessage(err))
      }
    }
    void fetchMembers()
  }, [householdId])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: FINANCES.TABS.OVERVIEW },
    { key: 'settings', label: FINANCES.TABS.SETTINGS },
  ]

  return (
    <div className="flex flex-col gap-4 pt-1 pb-24 md:pb-6">
      {/* Tab bar */}
      <div className="flex items-center gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-black'
                : 'border border-white/15 text-white/50 hover:text-white/80 hover:border-white/30'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {membersError && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
          <p className="text-xs text-red-400">{membersError}</p>
        </div>
      )}

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab householdId={householdId} />}
      {activeTab === 'settings' && <SettingsTab householdId={householdId} members={members} />}
    </div>
  )
}
