export default function RecipesLoading() {
  return (
    <div className="flex flex-col gap-5 pb-24 md:pb-8">
      {/* Header skeleton */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="h-7 w-40 bg-[--color-background-secondary] animate-pulse rounded" />
          <div className="h-4 w-56 bg-[--color-background-secondary] animate-pulse rounded" />
        </div>
        <div className="h-8 w-28 bg-[--color-background-secondary] animate-pulse rounded-md" />
      </div>

      {/* Divider skeleton */}
      <div className="h-px w-full bg-[--color-border-secondary]" />

      {/* Controls skeleton */}
      <div className="flex gap-2.5">
        <div className="flex-1 h-8 bg-[--color-background-secondary] animate-pulse rounded-md" />
        <div className="h-8 w-32 bg-[--color-background-secondary] animate-pulse rounded-md" />
      </div>

      {/* Chips skeleton */}
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-6 w-16 bg-[--color-background-secondary] animate-pulse rounded-full"
          />
        ))}
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(185px,1fr))] gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl overflow-hidden border border-[--color-border-secondary]"
          >
            <div className="aspect-[4/3] w-full bg-[--color-background-secondary] animate-pulse" />
            <div className="px-3.5 py-3 flex flex-col gap-2">
              <div className="h-3.5 bg-[--color-background-secondary] animate-pulse rounded w-3/4" />
              <div className="h-3 bg-[--color-background-secondary] animate-pulse rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
