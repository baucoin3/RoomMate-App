'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import type { OweSummary, ActivityItem, RecurringBillOverview, SettledItem } from '@/lib/types/finances'
import { FINANCES } from '@/locales/en'
import OwedToYouSection from './overview/OwedToYouSection'
import YouOweSection from './overview/YouOweSection'
import SettledSection from './overview/SettledSection'
import RecentActivity from './overview/RecentActivity'

interface OverviewTabProps {
  householdId: string
}

function SectionHeader({
  title,
  variant = 'default',
}: {
  title: string
  variant?: 'default' | 'owed' | 'owe' | 'settled'
}) {
  if (variant === 'owed') return <h3 className="text-base font-bold text-green-400 tracking-tight">{title}</h3>
  if (variant === 'owe') return <h3 className="text-base font-bold text-red-400 tracking-tight">{title}</h3>
  if (variant === 'settled') return <h3 className="text-base font-bold text-white/60 tracking-tight">{title}</h3>
  return <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wide">{title}</h3>
}

export default function OverviewTab({ householdId }: OverviewTabProps) {
  const [oweSummary, setOweSummary] = useState<OweSummary | null>(null)
  const [recurringBills, setRecurringBills] = useState<RecurringBillOverview[]>([])
  const [settledItems, setSettledItems] = useState<SettledItem[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [balancesRes, recurringRes, settledRes, activityRes] = await Promise.all([
        apiClient.get<{ data: OweSummary }>(`/api/finances/balances?householdId=${householdId}`),
        apiClient.get<{ data: RecurringBillOverview[] }>(
          `/api/finances/recurring/overview?householdId=${householdId}`,
        ),
        apiClient.get<{ data: SettledItem[] }>(`/api/finances/settled?householdId=${householdId}`),
        apiClient.get<{ data: ActivityItem[] }>(`/api/finances/activity?householdId=${householdId}`),
      ])
      console.log(`\nn\ IN FINANCES FETCH all\n\n`)
      console.log(`balancesRes.data.data: = ${JSON.stringify(balancesRes.data.data)}`)
      console.log(`recurringRes.data.data: = ${JSON.stringify(recurringRes.data.data)}`)
      console.log(`settledRes.data.data: = ${JSON.stringify(settledRes.data.data)}`)
      console.log(`activityRes.data.data: = ${JSON.stringify(activityRes.data.data)}`)
      console.log(`\n\n`)
      setOweSummary(balancesRes.data.data)
      setRecurringBills(recurringRes.data.data ?? [])
      setSettledItems(settledRes.data.data ?? [])
      setActivity(activityRes.data.data ?? [])
      console.log(`the state owe Summary  = ${JSON.stringify(oweSummary)}`)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [householdId])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="h-4 w-24 rounded bg-white/5 animate-pulse" />
            <div className="h-24 rounded-2xl bg-white/5 animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-5 py-4">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Owed to You — recurring bills pinned at top */}
      <div className="flex flex-col gap-3">
        <SectionHeader title={FINANCES.OVERVIEW.OWED_TO_YOU_TITLE} variant="owed" />
        <OwedToYouSection
          items={oweSummary?.owed_to_you ?? []}
          recurringBills={recurringBills}
          householdId={householdId}
          onSettled={fetchAll}
        />
      </div>

      {/* You Owe — recurring bills pinned at top */}
      <div className="flex flex-col gap-3">
        <SectionHeader title={FINANCES.OVERVIEW.YOU_OWE_TITLE} variant="owe" />
        <YouOweSection
          items={oweSummary?.you_owe ?? []}
          recurringBills={recurringBills}
          householdId={householdId}
          onChanged={fetchAll}
        />
      </div>

      {/* Settled history — replaces old Recurring Bills section */}
      <div className="flex flex-col gap-3">
        <SectionHeader title={FINANCES.OVERVIEW.SETTLED_HISTORY_TITLE} variant="settled" />
        <SettledSection items={settledItems} />
      </div>

      {/* Recent Activity */}
      <div className="flex flex-col gap-3">
        <SectionHeader title={FINANCES.OVERVIEW.ACTIVITY_TITLE} />
        <RecentActivity items={activity} />
      </div>
    </div>
  )
}
