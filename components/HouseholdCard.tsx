'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ROUTES } from '@/lib/constants/routes'
import { HOUSEHOLDS } from '@/locales/en'
import type { HouseholdWithMemberCount } from '@/lib/types/household'

interface HouseholdCardProps {
  household: HouseholdWithMemberCount
}

export default function HouseholdCard({ household }: HouseholdCardProps) {
  const [copied, setCopied] = useState(false)

  function handleCopy(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    navigator.clipboard.writeText(household.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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
        <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
          <span className="font-medium">{HOUSEHOLDS.INVITE_CODE_LABEL}:</span>
          <span className="font-mono tracking-wide">{household.invite_code}</span>
          <button
            type="button"
            onClick={handleCopy}
            aria-label={HOUSEHOLDS.ACTIONS.COPY_INVITE_CODE}
            className="ml-0.5 rounded p-0.5 transition-colors hover:text-indigo-500 focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400"
          >
            {copied ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-emerald-500">
                <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                <path fillRule="evenodd" d="M11 3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v9A1.5 1.5 0 0 0 3.5 14H6v-1.5H3.5a.25.25 0 0 1-.25-.25v-9a.25.25 0 0 1 .25-.25h6a.25.25 0 0 1 .25.25V5H11V3.5Z" clipRule="evenodd" />
                <path fillRule="evenodd" d="M6.5 5.5A1.5 1.5 0 0 0 5 7v5.5A1.5 1.5 0 0 0 6.5 14h6A1.5 1.5 0 0 0 14 12.5V7A1.5 1.5 0 0 0 12.5 5.5h-6Zm-.25 1.5a.25.25 0 0 1 .25-.25h6a.25.25 0 0 1 .25.25v5.5a.25.25 0 0 1-.25.25h-6a.25.25 0 0 1-.25-.25V7Z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          {copied && (
            <span className="text-emerald-500 font-medium">{HOUSEHOLDS.ACTIONS.COPIED}</span>
          )}
        </div>
      </div>
    </Link>
  )
}
