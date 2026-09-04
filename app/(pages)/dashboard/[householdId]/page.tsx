import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants/routes'
import { ERRORS, NAV } from '@/locales/en'
import { getDashboardData } from '@/lib/services/dashboard'
import { getDailyTasks, getWeeklyCompletionRate, getCalendarEventsForDateRange } from '@/lib/services/dailyTasks'
import { getTaskCategories } from '@/lib/services/taskCategories'
import RecipesCard from '@/components/dashboard/RecipesCard'
import RecentActivityFeed from '@/components/dashboard/RecentActivityFeed'
import HouseholdCalendar from '@/components/dashboard/HouseholdCalendar'
import NocturneHome from '@/components/home/NocturneHome'
import {
  ActivitySkeleton,
  CalendarSkeleton,
} from '@/components/dashboard/DashboardSkeleton'

interface HouseholdHubPageProps {
  params: { householdId: string }
}

function addDays(base: Date, n: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + n)
  return d.toLocaleDateString('en-CA')
}

export default async function HouseholdHubPage({ params }: HouseholdHubPageProps) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(ROUTES.LOGIN)

  const { data: membership } = await supabase
    .from('household_members')
    .select('id')
    .eq('household_id', params.householdId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    return (
      <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-5 py-4 mt-4">
        <p className="text-sm text-red-400">{ERRORS.GENERIC}</p>
      </div>
    )
  }

  const now = new Date()

  const [dashboardResult, tasksResult, weeklyRate, categoriesResult, eventsResult] = await Promise.all([
    getDashboardData(supabase, params.householdId),
    getDailyTasks(supabase, params.householdId, user.id),
    getWeeklyCompletionRate(supabase, params.householdId, user.id),
    getTaskCategories(supabase, params.householdId),
    getCalendarEventsForDateRange(supabase, params.householdId, addDays(now, -4), addDays(now, 4), user.id),
  ])

  const tasks = tasksResult.data ?? []
  const events = eventsResult.data ?? {}
  const categories = categoriesResult.data ?? []

  return (
    <>
      {/* ── Tablet / desktop — Nocturne layout (absolute, fills main) ─────────────── */}
      <div className="hidden md:block absolute inset-0">
        <NocturneHome
          householdId={params.householdId}
          initialTasks={tasks}
          initialEvents={events}
          initialCategories={categories}
          initialWeeklyRate={weeklyRate}
        />
      </div>

      {/* ── Mobile — existing layout ──────────────────────────────────────────────── */}
      <div className="flex md:hidden flex-col gap-4 pt-1 pb-20">
        <Link
          href={ROUTES.DASHBOARD}
          className="self-start text-sm text-white/40 hover:text-white/70 transition-colors"
        >
          {NAV.BACK_TO_HOUSEHOLDS}
        </Link>

        {dashboardResult.data ? (
          <>
            <Suspense fallback={<CalendarSkeleton />}>
              <HouseholdCalendar
                initialData={dashboardResult.data.calendar}
                householdId={params.householdId}
                initialYear={now.getFullYear()}
                initialMonth={now.getMonth()}
              />
            </Suspense>

            <RecipesCard householdId={params.householdId} />

            <Suspense fallback={<ActivitySkeleton />}>
              <RecentActivityFeed data={dashboardResult.data.recentActivity} />
            </Suspense>
          </>
        ) : (
          <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-5 py-4 mt-4">
            <p className="text-sm text-red-400">{dashboardResult.error ?? ERRORS.GENERIC}</p>
          </div>
        )}
      </div>
    </>
  )
}
