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

export function QuickActionsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl bg-[#1c1c24] p-4 flex flex-col items-center gap-2">
          <SkeletonLine className="h-5 w-5 rounded" />
          <SkeletonLine className="h-2.5 w-14" />
        </div>
      ))}
    </div>
  )
}

export function GetStartedSkeleton() {
  return (
    <SkeletonCard>
      <SkeletonLine className="h-2.5 w-20 mb-4" />
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <SkeletonLine className="h-4 w-4 rounded-full" />
            <SkeletonLine className="h-3 w-40" />
          </div>
        ))}
      </div>
    </SkeletonCard>
  )
}

export function BillAlertsSkeleton() {
  return (
    <SkeletonCard>
      <SkeletonLine className="h-2.5 w-24 mb-4" />
      <div className="flex flex-col gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SkeletonLine className="h-4 w-4 rounded" />
              <SkeletonLine className="h-3 w-24" />
            </div>
            <SkeletonLine className="h-3 w-12" />
          </div>
        ))}
      </div>
    </SkeletonCard>
  )
}

export function CalendarSkeleton() {
  return (
    <SkeletonCard>
      <div className="flex items-center justify-between mb-4">
        <SkeletonLine className="h-3 w-8" />
        <SkeletonLine className="h-3 w-24" />
        <SkeletonLine className="h-3 w-8" />
      </div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {[0,1,2,3,4,5,6].map((i) => (
          <SkeletonLine key={i} className="h-2.5 w-full" />
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <SkeletonLine key={i} className="h-10 rounded-lg" />
        ))}
      </div>
    </SkeletonCard>
  )
}

export function ActivitySkeleton() {
  return (
    <SkeletonCard>
      <SkeletonLine className="h-2.5 w-28 mb-4" />
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
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
