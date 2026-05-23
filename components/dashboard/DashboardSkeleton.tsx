interface SkeletonProps {
  className?: string
}

function SkeletonLine({ className = '' }: SkeletonProps) {
  return <div className={`animate-pulse rounded bg-white/10 ${className}`} />
}

function SkeletonCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-[#1c1c24] p-5">
      {children}
    </div>
  )
}

export function RentStatusSkeleton() {
  return (
    <SkeletonCard>
      <div className="flex items-center justify-between mb-4">
        <SkeletonLine className="h-3 w-12" />
        <SkeletonLine className="h-3 w-20" />
      </div>
      <SkeletonLine className="h-16 w-24 mb-4" />
      <div className="flex gap-2">
        <SkeletonLine className="h-7 w-7 rounded-full" />
        <SkeletonLine className="h-7 w-7 rounded-full" />
        <SkeletonLine className="h-7 w-7 rounded-full" />
      </div>
    </SkeletonCard>
  )
}

export function BalancesSkeleton() {
  return (
    <SkeletonCard>
      <SkeletonLine className="h-3 w-16 mb-4" />
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SkeletonLine className="h-8 w-8 rounded-full" />
              <SkeletonLine className="h-3 w-20" />
            </div>
            <SkeletonLine className="h-3 w-14" />
          </div>
        ))}
      </div>
    </SkeletonCard>
  )
}

export function ActivitySkeleton() {
  return (
    <SkeletonCard>
      <SkeletonLine className="h-3 w-28 mb-4" />
      <div className="flex flex-col gap-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <SkeletonLine className="h-7 w-7 rounded-full shrink-0" />
            <div className="flex-1 flex flex-col gap-1.5">
              <SkeletonLine className="h-3 w-3/4" />
              <SkeletonLine className="h-2.5 w-12" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonCard>
  )
}
