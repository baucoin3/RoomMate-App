'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { RECIPES, MEAL_LOGS } from '@/locales/en'
import { ROUTES } from '@/lib/constants/routes'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import type { RecipeDetail as RecipeDetailType, MealLog } from '@/lib/types/recipe'
import {
  CheckIcon,
  MealMadeIcon,
  PencilSquareIcon,
  RECIPE_IMAGE_PLACEHOLDERS,
  ShoppingCartIcon,
  TrashIcon,
  UserIcon,
  XMarkIcon,
} from '@/components/icons'
import AddToShoppingListModal from '@/components/recipes/AddToShoppingListModal'

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
  initialMealLogs?: MealLog[]
}

type LogState = 'idle' | 'logging' | 'done' | 'error'

export default function RecipeDetail({ recipe, householdId, initialMealLogs = [] }: RecipeDetailProps) {
  const router = useRouter()
  const [deleteState, setDeleteState] = useState<'idle' | 'confirm' | 'deleting'>('idle')
  const [deleteError, setDeleteError] = useState('')
  const [excludedIngredients, setExcludedIngredients] = useState<Set<string>>(new Set())
  const [excludedSteps, setExcludedSteps] = useState<Set<string>>(new Set())
  const [logState, setLogState] = useState<LogState>('idle')
  const [mealLogs, setMealLogs] = useState<MealLog[]>(initialMealLogs)
  const [showAddToList, setShowAddToList] = useState(false)

  async function handleMarkMadeToday() {
    setLogState('logging')
    try {
      await apiClient.post(`/api/recipes/${recipe.id}/meal-logs`, {
        household_id: householdId,
        made_at: new Date().toLocaleDateString('en-CA'),
      })
      setLogState('done')
      const today = new Date().toLocaleDateString('en-CA')
      setMealLogs((prev) => [
        { id: 'optimistic', household_id: householdId, recipe_id: recipe.id, recipe_name: recipe.name, made_by_member_id: '', made_by_name: 'You', made_at: today, notes: null },
        ...prev,
      ].slice(0, 3))
      setTimeout(() => setLogState('idle'), 2500)
    } catch {
      setLogState('error')
      setTimeout(() => setLogState('idle'), 2500)
    }
  }

  function excludeIngredient(id: string) {
    setExcludedIngredients((prev) => new Set(prev).add(id))
  }

  function excludeStep(id: string) {
    setExcludedSteps((prev) => new Set(prev).add(id))
  }

  const visibleIngredients = recipe.recipe_ingredients.filter((i) => !excludedIngredients.has(i.id))
  const visibleSteps = recipe.recipe_steps.filter((s) => !excludedSteps.has(s.id))

  const placeholder = RECIPE_IMAGE_PLACEHOLDERS[recipe.id.charCodeAt(0) % 5]
  const PlaceholderIcon = placeholder.Icon

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
            <PlaceholderIcon className="h-12 w-12 text-white/70" />
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
            <UserIcon className="h-[18px] w-[18px] text-amber-400/80" />
            {RECIPES.BY_AUTHOR(recipe.created_by_name)}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 mt-1 flex-wrap">
          <button
            onClick={() => void handleMarkMadeToday()}
            disabled={logState === 'logging'}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-base rounded-md border transition-colors disabled:opacity-60 ${
              logState === 'done'
                ? 'border-green-500/40 text-green-400 bg-green-500/10'
                : logState === 'error'
                  ? 'border-red-500/40 text-red-400'
                  : 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10'
            }`}
          >
            {logState === 'done' ? (
              <CheckIcon className="h-[15px] w-[15px]" />
            ) : (
              <MealMadeIcon className="h-[15px] w-[15px]" />
            )}
            {logState === 'logging'
              ? MEAL_LOGS.MARKING
              : logState === 'done'
                ? MEAL_LOGS.DONE
                : logState === 'error'
                  ? MEAL_LOGS.ERROR
                  : MEAL_LOGS.MARK_MADE_TODAY}
          </button>

          {recipe.recipe_ingredients.length > 0 && (
            <button
              onClick={() => setShowAddToList(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-base rounded-md border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 transition-colors"
            >
              <ShoppingCartIcon className="h-[15px] w-[15px]" />
              {RECIPES.DETAIL.ADD_TO_LIST}
            </button>
          )}

          <button
            onClick={() => router.push(ROUTES.RECIPE_EDIT(householdId, recipe.id))}
            className="flex items-center gap-1.5 px-3.5 py-2 text-base rounded-md border border-[--color-border-secondary] text-[--color-text-secondary] hover:border-[--color-border-primary] hover:text-[--color-text-primary] transition-colors"
          >
            <PencilSquareIcon className="h-[15px] w-[15px]" />
            {RECIPES.DETAIL.EDIT}
          </button>

          <button
            onClick={handleDelete}
            disabled={deleteState === 'deleting'}
            className="flex items-center gap-1.5 px-3.5 py-2 text-base rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            {deleteState === 'idle' && <TrashIcon className="h-[15px] w-[15px]" />}
            {deleteLabel}
          </button>
        </div>
      </div>

      {deleteError && (
        <p className="text-sm text-red-400 mt-1" role="alert">
          {deleteError}
        </p>
      )}

      {/* Recent meal logs */}
      {mealLogs.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {mealLogs.map((log) => {
            const daysAgo = Math.round(
              (Date.now() - new Date(log.made_at).getTime()) / (1000 * 60 * 60 * 24),
            )
            return (
              <span
                key={log.id}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] bg-[#5DCAA5]/10 border border-[#5DCAA5]/20 text-[#5DCAA5]"
              >
                <MealMadeIcon className="h-[11px] w-[11px]" />
                {MEAL_LOGS.LAST_MADE(log.made_by_name, daysAgo)}
              </span>
            )
          })}
        </div>
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
                  <XMarkIcon className="h-[11px] w-[11px]" />
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
                  <XMarkIcon className="h-[11px] w-[11px]" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {showAddToList && (
        <AddToShoppingListModal
          householdId={householdId}
          recipeName={recipe.name}
          ingredients={recipe.recipe_ingredients}
          onClose={() => setShowAddToList(false)}
        />
      )}
    </div>
  )
}
