'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import type { OweSummary, ActivityItem, RecurringBillOverview } from '@/lib/types/finances'
import { FINANCES } from '@/locales/en'
import OwedToYouSection from './overview/OwedToYouSection'
import YouOweSection from './overview/YouOweSection'
import RecurringBillsSection from './overview/RecurringBillsSection'
import RecentActivity from './overview/RecentActivity'

interface OverviewTabProps {
  householdId: string
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wide">{title}</h3>
  )
}

export default function OverviewTab({ householdId }: OverviewTabProps) {
  const [oweSummary, setOweSummary] = useState<OweSummary | null>(null)
  const [recurringBills, setRecurringBills] = useState<RecurringBillOverview[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [balancesRes, recurringRes, activityRes] = await Promise.all([
        apiClient.get<{ data: OweSummary }>(`/api/finances/balances?householdId=${householdId}`),
        apiClient.get<{ data: RecurringBillOverview[] }>(
          `/api/finances/recurring/overview?householdId=${householdId}`,
        ),
        apiClient.get<{ data: ActivityItem[] }>(`/api/finances/activity?householdId=${householdId}`),
      ])
      setOweSummary(balancesRes.data.data)
      setRecurringBills(recurringRes.data.data ?? [])
      setActivity(activityRes.data.data ?? [])
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
      {/* Owed to You */}
      <div className="flex flex-col gap-3">
        <SectionHeader title={FINANCES.OVERVIEW.OWED_TO_YOU_TITLE} />
        <OwedToYouSection
          items={oweSummary?.owed_to_you ?? []}
          householdId={householdId}
          onSettled={fetchAll}
        />
      </div>

      {/* You Owe */}
      <div className="flex flex-col gap-3">
        <SectionHeader title={FINANCES.OVERVIEW.YOU_OWE_TITLE} />
        <YouOweSection items={oweSummary?.you_owe ?? []} />
      </div>

      {/* Recurring Bills */}
      <div className="flex flex-col gap-3">
        <SectionHeader title={FINANCES.OVERVIEW.RECURRING_BILLS_TITLE} />
        <RecurringBillsSection
          bills={recurringBills}
          householdId={householdId}
          onChanged={fetchAll}
        />
      </div>

      {/* Recent Activity */}
      <div className="flex flex-col gap-3">
        <SectionHeader title={FINANCES.OVERVIEW.ACTIVITY_TITLE} />
        <RecentActivity items={activity} />
      </div>
    </div>
  )
}
