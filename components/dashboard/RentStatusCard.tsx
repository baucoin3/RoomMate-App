import type { RentStatus, RentMember } from '@/lib/types/dashboard'
import { HOUSEHOLD_DASHBOARD } from '@/locales/en'

interface RentStatusCardProps {
  data: RentStatus | null
}

function getDaysColor(days: number): string {
  if (days <= 3) return 'text-red-400'
  if (days <= 14) return 'text-amber-400'
  return 'text-white'
}

function getMemberRow(
  member: RentMember,
  paidByMemberId: string,
  currentMemberId: string,
  payerName: string,
): string {
  const amount = member.shareAmount.toFixed(2)
  const isViewer = member.memberId === currentMemberId
  const viewerPaid = paidByMemberId === currentMemberId

  if (viewerPaid) {
    if (isViewer) return ''
    return member.hasPaid
      ? HOUSEHOLD_DASHBOARD.RENT.OWES_YOU_PAID(member.memberName)
      : HOUSEHOLD_DASHBOARD.RENT.OWES_YOU(member.memberName, amount)
  }

  if (isViewer) {
    return member.hasPaid
      ? HOUSEHOLD_DASHBOARD.RENT.YOU_HAVE_PAID
      : HOUSEHOLD_DASHBOARD.RENT.YOU_OWE(payerName, amount)
  }

  return member.hasPaid
    ? HOUSEHOLD_DASHBOARD.RENT.THIRD_PARTY_PAID(member.memberName)
    : HOUSEHOLD_DASHBOARD.RENT.THIRD_PARTY_OWES(member.memberName, payerName, amount)
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

  const payerMember = data.members.find((m) => m.memberId === data.paidByMemberId)
  const payerName = payerMember?.memberName ?? 'Unknown'

  const visibleMembers = data.paidByMemberId === data.currentMemberId
    ? data.members.filter((m) => m.memberId !== data.currentMemberId)
    : data.members

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
          <p className="text-xs text-white/40 mt-1">{daysLabel}</p>
        </div>

        <div className="flex flex-col items-end gap-1.5 max-w-[200px]">
          {visibleMembers.map((member) => {
            const label = getMemberRow(member, data.paidByMemberId, data.currentMemberId, payerName)
            if (!label) return null
            return (
              <p
                key={member.memberId}
                className={`text-xs text-right ${member.hasPaid ? 'text-emerald-400/70' : 'text-white/50'}`}
              >
                {label}
              </p>
            )
          })}
        </div>
      </div>
    </div>
  )
}
