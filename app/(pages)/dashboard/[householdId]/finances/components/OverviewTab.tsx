'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import type { BalanceSummary, UpcomingBill, ActivityItem } from '@/lib/types/finances'
import { FINANCES } from '@/locales/en'
import BalanceCard from './overview/BalanceCard'
import UpcomingBills from './overview/UpcomingBills'
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
  const [balances, setBalances] = useState<BalanceSummary | null>(null)
  const [upcoming, setUpcoming] = useState<UpcomingBill[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [balancesRes, upcomingRes, activityRes] = await Promise.all([
        apiClient.get<{ data: BalanceSummary }>(`/api/finances/balances?householdId=${householdId}`),
        apiClient.get<{ data: UpcomingBill[] }>(`/api/finances/upcoming?householdId=${householdId}`),
        apiClient.get<{ data: ActivityItem[] }>(`/api/finances/activity?householdId=${householdId}`),
      ])
      setBalances(balancesRes.data.data)
      setUpcoming(upcomingRes.data.data ?? [])
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
      {/* Balances */}
      <div className="flex flex-col gap-3">
        <SectionHeader title={FINANCES.OVERVIEW.BALANCES_TITLE} />
        {balances && (
          <BalanceCard
            summary={balances}
            householdId={householdId}
            onSettled={fetchAll}
          />
        )}
      </div>

      {/* Upcoming bills — only show if there are any */}
      {upcoming.length > 0 && (
        <div className="flex flex-col gap-3">
          <SectionHeader title={FINANCES.OVERVIEW.UPCOMING_TITLE} />
          <UpcomingBills bills={upcoming} householdId={householdId} onConfirmed={fetchAll} />
        </div>
      )}

      {/* Recent activity */}
      <div className="flex flex-col gap-3">
        <SectionHeader title={FINANCES.OVERVIEW.ACTIVITY_TITLE} />
        <RecentActivity items={activity} />
      </div>
    </div>
  )
}
