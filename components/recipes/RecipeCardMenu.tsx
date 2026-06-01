'use client'

import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api/client'
import { MEAL_LOGS } from '@/locales/en'
import { ROUTES } from '@/lib/constants/routes'

interface RecipeCardMenuProps {
  recipeId: string
  householdId: string
}

type LogState = 'idle' | 'logging' | 'done' | 'error'

export default function RecipeCardMenu({ recipeId, householdId }: RecipeCardMenuProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [logState, setLogState] = useState<LogState>('idle')
  const menuRef = useRef<HTMLDivElement>(null)

  // Two-frame reveal so CSS transition has a starting keyframe to animate from
  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setRevealed(true))
      return () => cancelAnimationFrame(id)
    } else {
      setRevealed(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  async function handleMarkMadeToday() {
    setLogState('logging')
    setOpen(false)
    try {
      await apiClient.post(`/api/recipes/${recipeId}/meal-logs`, {
        household_id: householdId,
        made_at: new Date().toLocaleDateString('en-CA'),
      })
      setLogState('done')
      setTimeout(() => setLogState('idle'), 2000)
    } catch {
      setLogState('error')
      setTimeout(() => setLogState('idle'), 2500)
    }
  }

  const triggerBg =
    logState === 'done'
      ? 'bg-green-500/80 border-green-400/30'
      : logState === 'error'
        ? 'bg-red-500/80 border-red-400/30'
        : 'bg-black/40 border-white/15 hover:bg-black/65 hover:border-white/30'

  const triggerIcon =
    logState === 'done' ? 'ti-check' : logState === 'error' ? 'ti-x' : 'ti-dots'

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger — 3-dot button */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (logState === 'idle') setOpen((v) => !v)
        }}
        className={`relative z-50 flex items-center justify-center w-7 h-7 rounded-full border text-white backdrop-blur-sm transition-all duration-150 ${triggerBg} opacity-0 group-hover:opacity-100 focus:opacity-100 ${open ? 'opacity-100' : ''}`}
        aria-label="Recipe options"
      >
        <i className={`${triggerIcon} text-[13px]`} />
      </button>

      {/* Popup — appears to the RIGHT of the card */}
      <div
        className="absolute top-0 z-50 pointer-events-none"
        style={{ left: 'calc(100% + 10px)' }}
      >
        <div
          style={{
            opacity: open && revealed ? 1 : 0,
            transform: open && revealed ? 'scale(1) translateX(0)' : 'scale(0.92) translateX(-6px)',
            transformOrigin: 'left top',
            transition: 'opacity 180ms ease, transform 200ms cubic-bezier(0.34,1.56,0.64,1)',
            pointerEvents: open ? 'auto' : 'none',
          }}
          className="flex flex-col gap-1 rounded-2xl border border-white/12 bg-[#18181f]/90 backdrop-blur-xl shadow-2xl p-1.5 min-w-[170px]"
        >
          {/* Edit */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setOpen(false)
              router.push(ROUTES.RECIPE_EDIT(householdId, recipeId))
            }}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-white/80 hover:text-white hover:bg-white/8 transition-colors text-left w-full"
          >
            <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-white/8">
              <i className="ti-pencil text-[12px]" />
            </span>
            {MEAL_LOGS.MENU_EDIT}
          </button>

          {/* Divider */}
          <div className="mx-2 h-px bg-white/8" />

          {/* Mark as Made Today */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void handleMarkMadeToday()
            }}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-white/80 hover:text-white hover:bg-white/8 transition-colors text-left w-full"
          >
            <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-[#5DCAA5]/20">
              <i className="ti-chef-hat text-[12px] text-[#5DCAA5]" />
            </span>
            {MEAL_LOGS.MENU_MARK_MADE}
          </button>
        </div>
      </div>
    </div>
  )
}
