import type { Balance } from '@/lib/types/dashboard'
import { HOUSEHOLD_DASHBOARD } from '@/locales/en'

interface BalancesCardProps {
  data: Balance[]
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Math.abs(amount))
}

function BalanceRow({ balance }: { balance: Balance }) {
  const isPositive = balance.netAmount >= 0
  const label = isPositive
    ? HOUSEHOLD_DASHBOARD.BALANCES.OWES_YOU(balance.memberName, formatAmount(balance.netAmount))
    : HOUSEHOLD_DASHBOARD.BALANCES.YOU_OWE(balance.memberName, formatAmount(balance.netAmount))

  return (
    <div className="flex items-center justify-between py-1" aria-label={label}>
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-white/10 text-xs font-semibold text-white/70 shrink-0">
          {balance.memberName.charAt(0).toUpperCase()}
        </div>
        <span className="text-sm text-white/80">{balance.memberName}</span>
      </div>
      <span
        className={`text-sm font-semibold tabular-nums ${
          isPositive ? 'text-emerald-400' : 'text-red-400'
        }`}
      >
        {isPositive ? '+' : '-'}{formatAmount(balance.netAmount)}
      </span>
    </div>
  )
}

export default function BalancesCard({ data }: BalancesCardProps) {
  return (
    <div className="rounded-2xl bg-[#1c1c24] p-5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-3">
        {HOUSEHOLD_DASHBOARD.BALANCES.TITLE}
      </p>

      {data.length === 0 ? (
        <p className="text-sm text-white/40">{HOUSEHOLD_DASHBOARD.BALANCES.EMPTY}</p>
      ) : (
        <div className="flex flex-col divide-y divide-white/5">
          {data.map((balance) => (
            <BalanceRow key={balance.memberId} balance={balance} />
          ))}
        </div>
      )}
    </div>
  )
}
