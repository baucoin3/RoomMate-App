import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants/routes'
import { ERRORS } from '@/locales/en'
import { getDailyTasks, getWeeklyCompletionRate, getCalendarEventsForDateRange, getTaskStruggleStats } from '@/lib/services/dailyTasks'
import { getTaskCategories } from '@/lib/services/taskCategories'
import NocturneHome from '@/components/home/NocturneHome'
import NocturneMobile from '@/components/home/NocturneMobile'

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

  const [tasksResult, weeklyRate, categoriesResult, eventsResult, struggleResult] = await Promise.all([
    getDailyTasks(supabase, params.householdId, user.id),
    getWeeklyCompletionRate(supabase, params.householdId, user.id),
    getTaskCategories(supabase, params.householdId),
    getCalendarEventsForDateRange(supabase, params.householdId, addDays(now, -4), addDays(now, 4), user.id),
    getTaskStruggleStats(supabase, params.householdId, user.id),
  ])

  const tasks = tasksResult.data ?? []
  const events = eventsResult.data ?? {}
  const categories = categoriesResult.data ?? []
  const initialStruggleStats = struggleResult.data ?? []

  const sharedProps = {
    householdId: params.householdId,
    initialTasks: tasks,
    initialEvents: events,
    initialCategories: categories,
    initialWeeklyRate: weeklyRate,
    initialStruggleStats,
  }

  return (
    <>
      {/* ── Tablet / desktop — Nocturne layout ──────────────────────────────────── */}
      <div className="hidden md:block absolute inset-0">
        <NocturneHome {...sharedProps} />
      </div>

      {/* ── Mobile — Nocturne mobile layout ─────────────────────────────────────── */}
      <div className="md:hidden absolute inset-0">
        <NocturneMobile {...sharedProps} />
      </div>
    </>
  )
}
