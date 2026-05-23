import type { ActivityItem } from '@/lib/types/dashboard'
import { HOUSEHOLD_DASHBOARD } from '@/locales/en'

interface RecentActivityFeedProps {
  data: ActivityItem[]
}

function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffDay >= 1) return HOUSEHOLD_DASHBOARD.ACTIVITY.TIME_AGO(`${diffDay}d`)
  if (diffHr >= 1) return HOUSEHOLD_DASHBOARD.ACTIVITY.TIME_AGO(`${diffHr}h`)
  if (diffMin >= 1) return HOUSEHOLD_DASHBOARD.ACTIVITY.TIME_AGO(`${diffMin}m`)
  return 'just now'
}

function ActivityRow({ item }: { item: ActivityItem }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex items-center justify-center h-7 w-7 rounded-full bg-white/10 text-[10px] font-semibold text-white/60 shrink-0 mt-0.5">
        {item.actorName.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/80 leading-snug">
          <span className="font-medium text-white">{item.actorName}</span>
          {' '}
          {item.description}
          {item.amount !== undefined && (
            <span className="text-white/50">
              {' · '}
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.amount)}
            </span>
          )}
        </p>
        <p className="text-[11px] text-white/30 mt-0.5">{formatRelativeTime(item.createdAt)}</p>
      </div>
    </div>
  )
}

export default function RecentActivityFeed({ data }: RecentActivityFeedProps) {
  return (
    <div className="rounded-2xl bg-[#1c1c24] p-5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-3">
        {HOUSEHOLD_DASHBOARD.ACTIVITY.TITLE}
      </p>

      {data.length === 0 ? (
        <p className="text-sm text-white/40">{HOUSEHOLD_DASHBOARD.ACTIVITY.EMPTY}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {data.slice(0, 5).map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
