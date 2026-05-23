'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { RECIPES } from '@/locales/en'
import { ROUTES } from '@/lib/constants/routes'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import type { RecipeDetail as RecipeDetailType } from '@/lib/types/recipe'


const PLACEHOLDERS = [
  { bg: 'from-[#FAC775] to-[#EF9F27]', icon: 'ti-bread' },
  { bg: 'from-[#C0DD97] to-[#5DCAA5]', icon: 'ti-salad' },
  { bg: 'from-[#F5C4B3] to-[#F0997B]', icon: 'ti-meat' },
  { bg: 'from-[#CECBF6] to-[#AFA9EC]', icon: 'ti-cookie' },
  { bg: 'from-[#B5D4F4] to-[#85B7EB]', icon: 'ti-fish' },
] as const

function OrnamentalDivider() {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px bg-[--color-border-secondary]" />
      <span className="text-[--color-text-tertiary] text-xs tracking-widest">✦ ✦ ✦</span>
      <div className="flex-1 h-px bg-[--color-border-secondary]" />
    </div>
  )
}

interface RecipeDetailProps {
  recipe: RecipeDetailType
  householdId: string
}

export default function RecipeDetail({ recipe, householdId }: RecipeDetailProps) {
  const router = useRouter()
  const [deleteState, setDeleteState] = useState<'idle' | 'confirm' | 'deleting'>('idle')
  const [deleteError, setDeleteError] = useState('')

  const placeholder = PLACEHOLDERS[recipe.id.charCodeAt(0) % 5]

  async function handleDelete() {
    if (deleteState === 'idle') {
      setDeleteState('confirm')
      return
    }
    if (deleteState === 'confirm') {
      setDeleteState('deleting')
      setDeleteError('')
      try {
        await apiClient.delete(`/api/recipes/${recipe.id}`)
        router.push(ROUTES.HOUSEHOLD_RECIPES(householdId))
      } catch (err) {
        setDeleteError(getErrorMessage(err))
        setDeleteState('confirm')
      }
    }
  }

  const deleteLabel =
    deleteState === 'confirm'
      ? RECIPES.DETAIL.DELETE_CONFIRM
      : deleteState === 'deleting'
        ? RECIPES.DETAIL.DELETE_CONFIRM
        : RECIPES.DETAIL.DELETE

  return (
    <div className="flex flex-col pb-24 md:pb-8 max-w-2xl mx-auto">
      {/* Back link */}
      <Link
        href={ROUTES.HOUSEHOLD_RECIPES(householdId)}
        className="text-sm text-[--color-text-tertiary] hover:text-[--color-text-secondary] transition-colors mb-5 self-start"
      >
        {RECIPES.DETAIL.BACK}
      </Link>

      {/* Hero image */}
      <div className="w-full aspect-[16/6] rounded-xl overflow-hidden relative mb-6">
        {recipe.image_url ? (
          <Image src={recipe.image_url} alt={recipe.name} fill className="object-cover" />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${placeholder.bg} flex items-center justify-center`}
          >
            <i className={`${placeholder.icon} text-5xl text-white/70`} />
          </div>
        )}

        {recipe.category_tag && (
          <span className="absolute top-3 left-3 rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-white/85 text-[#2C2C2A] backdrop-blur-sm">
            {recipe.category_tag}
          </span>
        )}
      </div>

      {/* Title + actions row */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <div className="min-w-0">
          <h1
            className="text-[26px] font-[500] leading-tight"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {recipe.name}
          </h1>
          <p
            className="text-[16px] text-[--color-text-secondary] mt-0.5"
            style={{ fontFamily: "'Caveat', cursive" }}
          >
            {RECIPES.BY_AUTHOR(recipe.created_by_name)}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 mt-1">
          <button
            onClick={() => router.push(ROUTES.RECIPE_EDIT(householdId, recipe.id))}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-[--color-border-secondary] text-[--color-text-secondary] hover:border-[--color-border-primary] hover:text-[--color-text-primary] transition-colors"
          >
            <i className="ti-edit text-[13px]" />
            {RECIPES.DETAIL.EDIT}
          </button>

          <button
            onClick={handleDelete}
            disabled={deleteState === 'deleting'}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            {deleteState === 'idle' && <i className="ti-trash text-[13px]" />}
            {deleteLabel}
          </button>
        </div>
      </div>

      {deleteError && (
        <p className="text-sm text-red-400 mt-1" role="alert">
          {deleteError}
        </p>
      )}

      <OrnamentalDivider />

      {/* Description */}
      {recipe.notes && (
        <p className="text-sm text-[--color-text-secondary] leading-relaxed mb-5">{recipe.notes}</p>
      )}

      {/* Ingredients */}
      {recipe.recipe_ingredients.length > 0 && (
        <section className="mb-5">
          <h2
            className="text-[17px] font-[500] mb-3"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {RECIPES.DETAIL.INGREDIENTS_HEADING}
          </h2>
          <div className="bg-[--color-background-secondary] rounded-xl p-4">
            {recipe.recipe_ingredients.map((ing, idx) => (
              <div
                key={ing.id}
                className={`flex items-center gap-3 py-2.5 ${
                  idx < recipe.recipe_ingredients.length - 1
                    ? 'border-b border-[--color-border-tertiary]'
                    : ''
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400/70 flex-shrink-0" />
                <span className="text-sm flex-1">{ing.name}</span>
                {(ing.quantity || ing.unit) && (
                  <span
                    className="text-[17px] text-[--color-text-secondary]"
                    style={{ fontFamily: "'Caveat', cursive" }}
                  >
                    {[ing.quantity, ing.unit].filter(Boolean).join(' ')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <OrnamentalDivider />

      {/* Steps */}
      {recipe.recipe_steps.length > 0 && (
        <section>
          <h2
            className="text-[17px] font-[500] mb-4"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {RECIPES.DETAIL.STEPS_HEADING}
          </h2>
          <div className="flex flex-col gap-2.5">
            {recipe.recipe_steps.map((step) => (
              <div key={step.id} className="flex gap-3.5 items-start">
                <span className="w-[26px] h-[26px] rounded-full border border-[--color-border-secondary] flex items-center justify-center text-[12px] font-medium text-[--color-text-secondary] flex-shrink-0 mt-0.5">
                  {step.step_number}
                </span>
                <p className="text-sm text-[--color-text-secondary] leading-relaxed pt-0.5">
                  {step.instruction}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
