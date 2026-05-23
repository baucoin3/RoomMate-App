'use client'

import Link from 'next/link'

interface FeatureCardProps {
  title: string
  description: string
  href: string
  icon: React.ReactNode
  comingSoon?: boolean
}

export default function FeatureCard({ title, description, href, icon, comingSoon }: FeatureCardProps) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md"
      aria-disabled={comingSoon}
      tabIndex={comingSoon ? -1 : undefined}
      onClick={comingSoon ? (e) => e.preventDefault() : undefined}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-100">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600">
          {title}
        </h3>
        <p className="mt-0.5 text-xs text-gray-500">{description}</p>
      </div>
      {comingSoon && (
        <span className="absolute right-3 top-3 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-400">
          Coming soon
        </span>
      )}
    </Link>
  )
}
