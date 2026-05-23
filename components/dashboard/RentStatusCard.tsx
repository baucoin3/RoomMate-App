import type { RentStatus } from '@/lib/types/dashboard'
import { HOUSEHOLD_DASHBOARD } from '@/locales/en'

interface RentStatusCardProps {
  data: RentStatus | null
}

function MemberAvatar({ name, hasPaid }: { name: string; hasPaid: boolean }) {
  return (
    <div
      title={`${name}: ${hasPaid ? 'paid' : 'unpaid'}`}
      className={`flex items-center justify-center h-7 w-7 rounded-full text-[10px] font-bold ring-2 ${
        hasPaid
          ? 'bg-emerald-500/20 text-emerald-400 ring-emerald-500/30'
          : 'bg-white/10 text-white/50 ring-white/10'
      }`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function getDaysColor(days: number): string {
  if (days <= 3) return 'text-red-400'
  if (days <= 14) return 'text-amber-400'
  return 'text-white'
}

export default function RentStatusCard({ data }: RentStatusCardProps) {
  if (!data) {
    return (
      <div className="rounded-2xl bg-[#1c1c24] p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-3">
          {HOUSEHOLD_DASHBOARD.RENT.TITLE}
        </p>
        <p className="text-sm text-white/40">{HOUSEHOLD_DASHBOARD.RENT.EMPTY}</p>
      </div>
    )
  }

  const daysColor = getDaysColor(data.daysUntilDue)
  const daysLabel =
    data.daysUntilDue === 1
      ? HOUSEHOLD_DASHBOARD.RENT.DAY_UNTIL_DUE
      : HOUSEHOLD_DASHBOARD.RENT.DAYS_UNTIL_DUE(data.daysUntilDue)

  return (
    <div className="rounded-2xl bg-[#1c1c24] p-5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
          {HOUSEHOLD_DASHBOARD.RENT.TITLE}
        </p>
        <p className="text-xs text-white/40">
          {HOUSEHOLD_DASHBOARD.RENT.PAID_STATUS(data.paidCount, data.totalCount)}
        </p>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/10 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all"
          style={{ width: `${(data.paidCount / data.totalCount) * 100}%` }}
        />
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className={`text-5xl font-bold leading-none tabular-nums ${daysColor}`}>
            {data.daysUntilDue}
          </p>
          <p className="text-xs text-white/40 mt-1">days until due</p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap justify-end max-w-[140px]">
          {data.members.map((member) => (
            <MemberAvatar key={member.memberId} name={member.memberName} hasPaid={member.hasPaid} />
          ))}
        </div>
      </div>
    </div>
  )
}
