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
    <div className="flex items-center gap-3 my-6">
      <div className="flex-1 h-px bg-[--color-border-secondary]" />
      <span className="text-[--color-text-tertiary] text-sm tracking-widest">✦ ✦ ✦</span>
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
  const [excludedIngredients, setExcludedIngredients] = useState<Set<string>>(new Set())
  const [excludedSteps, setExcludedSteps] = useState<Set<string>>(new Set())

  function excludeIngredient(id: string) {
    setExcludedIngredients((prev) => new Set(prev).add(id))
  }

  function excludeStep(id: string) {
    setExcludedSteps((prev) => new Set(prev).add(id))
  }

  const visibleIngredients = recipe.recipe_ingredients.filter((i) => !excludedIngredients.has(i.id))
  const visibleSteps = recipe.recipe_steps.filter((s) => !excludedSteps.has(s.id))

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
        className="text-base text-[--color-text-tertiary] hover:text-[--color-text-secondary] transition-colors mb-5 self-start"
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
          <span className="absolute top-3 left-3 rounded-full px-3 py-1 text-xs font-semibold bg-white/90 text-[#2C2C2A] backdrop-blur-sm">
            {recipe.category_tag}
          </span>
        )}
      </div>

      {/* Title + actions row */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <div className="min-w-0">
          <h1
            className="text-[30px] font-[600] leading-tight text-[--color-text-primary]"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {recipe.name}
          </h1>
          <p
            className="flex items-center gap-2 text-xl font-semibold text-amber-400 mt-2 tracking-wide"
            style={{ fontFamily: "'Caveat', cursive" }}
          >
            <i className="ti-user text-[18px] text-amber-400/80" aria-hidden />
            {RECIPES.BY_AUTHOR(recipe.created_by_name)}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 mt-1">
          <button
            onClick={() => router.push(ROUTES.RECIPE_EDIT(householdId, recipe.id))}
            className="flex items-center gap-1.5 px-3.5 py-2 text-base rounded-md border border-[--color-border-secondary] text-[--color-text-secondary] hover:border-[--color-border-primary] hover:text-[--color-text-primary] transition-colors"
          >
            <i className="ti-edit text-[15px]" />
            {RECIPES.DETAIL.EDIT}
          </button>

          <button
            onClick={handleDelete}
            disabled={deleteState === 'deleting'}
            className="flex items-center gap-1.5 px-3.5 py-2 text-base rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            {deleteState === 'idle' && <i className="ti-trash text-[15px]" />}
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
        <p className="text-base text-[--color-text-primary] leading-relaxed mb-5">{recipe.notes}</p>
      )}

      {/* Ingredients */}
      {recipe.recipe_ingredients.length > 0 && (
        <section className="mb-5">
          <div className="flex items-baseline justify-between mb-3">
            <h2
              className="text-xl font-[600] text-[--color-text-primary]"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {RECIPES.DETAIL.INGREDIENTS_HEADING}
            </h2>
            {excludedIngredients.size > 0 && (
              <button
                type="button"
                onClick={() => setExcludedIngredients(new Set())}
                className="text-sm text-[--color-text-tertiary] hover:text-[--color-text-secondary] transition-colors"
              >
                {RECIPES.DETAIL.RESET_EXCLUDED}
              </button>
            )}
          </div>
          <div className="bg-[--color-background-secondary] rounded-xl p-5">
            {visibleIngredients.map((ing, idx) => (
              <div
                key={ing.id}
                className={`flex items-center gap-3 py-3 group ${
                  idx < visibleIngredients.length - 1
                    ? 'border-b border-[--color-border-tertiary]'
                    : ''
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                <span className="text-base font-medium text-[--color-text-primary] flex-1">{ing.name}</span>
                {(ing.quantity || ing.unit) && (
                  <span
                    className="text-xl text-[--color-text-primary]"
                    style={{ fontFamily: "'Caveat', cursive" }}
                  >
                    {[ing.quantity, ing.unit].filter(Boolean).join(' ')}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => excludeIngredient(ing.id)}
                  className="opacity-0 group-hover:opacity-100 text-[--color-text-tertiary] hover:text-red-400 transition-all ml-1 flex-shrink-0"
                  aria-label={RECIPES.DETAIL.INGREDIENT_EXCLUDE_LABEL}
                >
                  <i className="ti-x text-[11px]" />
                </button>
              </div>
            ))}
            {visibleIngredients.length === 0 && (
              <p className="text-base text-[--color-text-tertiary] py-1">{RECIPES.DETAIL.RESET_EXCLUDED}</p>
            )}
          </div>
        </section>
      )}

      <OrnamentalDivider />

      {/* Steps */}
      {recipe.recipe_steps.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2
              className="text-xl font-[600] text-[--color-text-primary]"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {RECIPES.DETAIL.STEPS_HEADING}
            </h2>
            {excludedSteps.size > 0 && (
              <button
                type="button"
                onClick={() => setExcludedSteps(new Set())}
                className="text-sm text-[--color-text-tertiary] hover:text-[--color-text-secondary] transition-colors"
              >
                {RECIPES.DETAIL.RESET_EXCLUDED}
              </button>
            )}
          </div>
          <div className="flex flex-col gap-3.5">
            {visibleSteps.map((step, idx) => (
              <div key={step.id} className="flex gap-4 items-start group">
                <span className="w-[30px] h-[30px] rounded-full border-2 border-[--color-border-primary] bg-[--color-background-secondary] flex items-center justify-center text-sm font-semibold text-[--color-text-primary] flex-shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <p className="text-base text-[--color-text-primary] leading-relaxed pt-1 flex-1">
                  {step.instruction}
                </p>
                <button
                  type="button"
                  onClick={() => excludeStep(step.id)}
                  className="opacity-0 group-hover:opacity-100 text-[--color-text-tertiary] hover:text-red-400 transition-all flex-shrink-0 mt-1"
                  aria-label={RECIPES.DETAIL.STEP_EXCLUDE_LABEL}
                >
                  <i className="ti-x text-[11px]" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
