import Image from 'next/image'
import Link from 'next/link'
import { ROUTES } from '@/lib/constants/routes'
import { HOUSEHOLDS } from '@/locales/en'
import type { HouseholdWithMemberCount } from '@/lib/types/household'

interface HouseholdCardProps {
  household: HouseholdWithMemberCount
}

export default function HouseholdCard({ household }: HouseholdCardProps) {
  return (
    <Link
      href={ROUTES.HOUSEHOLD(household.id)}
      className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-xl hover:border-indigo-200"
    >
      <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100">
        {household.image_url ? (
          <Image
            src={household.image_url}
            alt={household.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover"
            priority={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              className="h-12 w-12 text-indigo-200"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
              />
            </svg>
          </div>
        )}
      </div>

      <div className="px-4 py-3">
        <h2 className="truncate text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
          {household.name}
        </h2>
        <p className="mt-1 text-xs text-gray-400">
          <span className="font-medium">{HOUSEHOLDS.INVITE_CODE_LABEL}:</span>{' '}
          <span className="font-mono tracking-wide">{household.invite_code}</span>
        </p>
      </div>
    </Link>
  )
}
