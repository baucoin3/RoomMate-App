'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { RECIPES } from '@/locales/en'
import { ROUTES } from '@/lib/constants/routes'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import type { Recipe, RecipeTag } from '@/lib/types/recipe'
import { MagnifyingGlassIcon, PlusIcon } from '@/components/icons'
import RecipeCard from './RecipeCard'

type SortKey = 'newest' | 'az' | 'author'

interface RecipesClientProps {
  householdId: string
  initialRecipes: Recipe[]
  initialTags: RecipeTag[]
  error: string | null
}

function SkeletonCard() {
  return (
    <div className="rounded-xl overflow-hidden border border-[--color-border-secondary]">
      <div className="aspect-[4/3] w-full bg-[--color-background-secondary] animate-pulse" />
      <div className="px-3.5 py-3 flex flex-col gap-2">
        <div className="h-3.5 bg-[--color-background-secondary] animate-pulse rounded w-3/4" />
        <div className="h-3 bg-[--color-background-secondary] animate-pulse rounded w-1/2" />
      </div>
    </div>
  )
}

export default function RecipesClient({
  householdId,
  initialRecipes,
  initialTags,
  error,
}: RecipesClientProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('newest')
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())

  // Tags state — seeded from server, updated optimistically on "Add tag"
  const [tags, setTags] = useState<RecipeTag[]>(initialTags)
  const [showAddTag, setShowAddTag] = useState(false)
  const [newTagValue, setNewTagValue] = useState('')
  const [addTagLoading, setAddTagLoading] = useState(false)
  const [addTagError, setAddTagError] = useState('')
  const addTagInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showAddTag) {
      addTagInputRef.current?.focus()
    }
  }, [showAddTag])

  // Merge tags from existing recipes with tags from the table so both sources show
  const categories = useMemo(() => {
    const fromTags = tags.map((t) => t.name)
    const fromRecipes = initialRecipes
      .map((r) => r.category_tag)
      .filter((t): t is string => t !== null)
    return Array.from(new Set([...fromTags, ...fromRecipes])).sort()
  }, [tags, initialRecipes])

  function toggleTag(tag: string) {
    setActiveTags((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) {
        next.delete(tag)
      } else {
        next.add(tag)
      }
      return next
    })
  }

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return initialRecipes
      .filter((r) => activeTags.size === 0 || (r.category_tag !== null && activeTags.has(r.category_tag)))
      .filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.created_by_name.toLowerCase().includes(q) ||
          r.recipe_ingredients.some((i) => i.name.toLowerCase().includes(q)),
      )
      .sort((a, b) => {
        if (sortBy === 'az') return a.name.localeCompare(b.name)
        if (sortBy === 'author') return a.created_by_name.localeCompare(b.created_by_name)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
  }, [initialRecipes, searchQuery, sortBy, activeTags])

  async function handleAddTag() {
    const trimmed = newTagValue.trim()
    if (!trimmed) {
      setAddTagError(RECIPES.TAGS.ERROR_EMPTY)
      return
    }

    setAddTagLoading(true)
    setAddTagError('')
    try {
      const res = await apiClient.post<{ data: RecipeTag }>('/api/recipes/tags', {
        household_id: householdId,
        name: trimmed,
      })
      setTags((prev) => {
        const exists = prev.some((t) => t.name === res.data.data.name)
        return exists ? prev : [...prev, res.data.data].sort((a, b) => a.name.localeCompare(b.name))
      })
      setNewTagValue('')
      setShowAddTag(false)
    } catch (err) {
      setAddTagError(getErrorMessage(err) || RECIPES.TAGS.ERROR_SAVE_FAILED)
    } finally {
      setAddTagLoading(false)
    }
  }

  function handleAddTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleAddTag()
    if (e.key === 'Escape') {
      setShowAddTag(false)
      setNewTagValue('')
      setAddTagError('')
    }
  }

  return (
    <div className="flex flex-col gap-5 pb-24 md:pb-8">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className="text-[28px] font-[500] leading-tight"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {RECIPES.PAGE_TITLE}
          </h1>
          <p
            className="text-[17px] text-[--color-text-secondary] mt-0.5"
            style={{ fontFamily: "'Caveat', cursive" }}
          >
            {RECIPES.PAGE_SUBTITLE}
          </p>
        </div>

        <button
          onClick={() => router.push(ROUTES.RECIPE_NEW(householdId))}
          className="flex items-center gap-1.5 bg-[#C8882E] hover:bg-[#A96F1F] text-white rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors shrink-0"
        >
          <PlusIcon className="h-[13px] w-[13px]" />
          {RECIPES.ADD_BUTTON}
        </button>
      </div>

      {/* Ornamental divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-[--color-border-secondary]" />
        <span className="text-[--color-text-tertiary] text-xs tracking-widest">✦ ✦ ✦</span>
        <div className="flex-1 h-px bg-[--color-border-secondary]" />
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-[13px] w-[13px] -translate-y-1/2 text-[--color-text-tertiary]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={RECIPES.SEARCH_PLACEHOLDER}
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-[--color-border-secondary] bg-[--color-background-secondary] text-[--color-text-primary] placeholder:text-[--color-text-tertiary] focus:outline-none focus:border-[--color-border-primary] transition-colors"
          />
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="text-sm rounded-md border border-[--color-border-secondary] bg-[--color-background-secondary] text-[--color-text-primary] px-2.5 py-1.5 focus:outline-none focus:border-[--color-border-primary] transition-colors cursor-pointer"
        >
          <option value="newest">{RECIPES.SORT_NEWEST}</option>
          <option value="az">{RECIPES.SORT_AZ}</option>
          <option value="author">{RECIPES.SORT_AUTHOR}</option>
        </select>

        {/* Results count */}
        <span className="text-xs text-[--color-text-tertiary] whitespace-nowrap">
          {RECIPES.RESULTS_COUNT(filtered.length)}
        </span>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide flex-wrap">
        {/* All chip */}
        <button
          onClick={() => setActiveTags(new Set())}
          className={`rounded-full px-3 py-1 text-[13px] cursor-pointer shrink-0 border transition-colors ${
            activeTags.size === 0
              ? 'bg-amber-500/15 text-amber-200 border-amber-500/40'
              : 'border-[--color-border-secondary] bg-transparent text-[--color-text-secondary] hover:bg-[--color-background-secondary]'
          }`}
        >
          {RECIPES.ALL_FILTER}
        </button>

        {categories.map((tag) => (
          <button
            key={tag}
            onClick={() => toggleTag(tag)}
            className={`rounded-full px-3 py-1 text-[13px] cursor-pointer shrink-0 border transition-colors ${
              activeTags.has(tag)
                ? 'bg-amber-500/15 text-amber-200 border-amber-500/40'
                : 'border-[--color-border-secondary] bg-transparent text-[--color-text-secondary] hover:bg-[--color-background-secondary]'
            }`}
          >
            {tag}
          </button>
        ))}

        {/* Add tag — inline input */}
        {showAddTag ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <input
              ref={addTagInputRef}
              type="text"
              value={newTagValue}
              onChange={(e) => {
                setNewTagValue(e.target.value)
                setAddTagError('')
              }}
              onKeyDown={handleAddTagKeyDown}
              placeholder={RECIPES.TAGS.ADD_PLACEHOLDER}
              className="rounded-full px-3 py-1 text-[13px] border border-amber-500/40 bg-[--color-background-secondary] text-[--color-text-primary] placeholder:text-[--color-text-tertiary] focus:outline-none w-36 transition-colors"
            />
            <button
              onClick={handleAddTag}
              disabled={addTagLoading}
              className="rounded-full px-3 py-1 text-[13px] bg-amber-500/15 text-amber-200 border border-amber-500/40 hover:bg-amber-500/25 transition-colors disabled:opacity-50 shrink-0"
            >
              {addTagLoading ? '…' : RECIPES.TAGS.ADD_CONFIRM}
            </button>
            <button
              onClick={() => {
                setShowAddTag(false)
                setNewTagValue('')
                setAddTagError('')
              }}
              className="rounded-full px-3 py-1 text-[13px] border border-[--color-border-secondary] bg-transparent text-[--color-text-tertiary] hover:bg-[--color-background-secondary] transition-colors shrink-0"
            >
              {RECIPES.TAGS.ADD_CANCEL}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddTag(true)}
            className="rounded-full px-3 py-1 text-[13px] cursor-pointer shrink-0 border border-dashed border-[--color-border-secondary] bg-transparent text-[--color-text-tertiary] hover:bg-[--color-background-secondary] transition-colors"
          >
            {RECIPES.ADD_TAG}
          </button>
        )}
      </div>

      {/* Add tag error */}
      {addTagError && (
        <p className="text-xs text-red-400 -mt-3" role="alert">
          {addTagError}
        </p>
      )}

      {/* Error state */}
      {error && (
        <p className="text-center text-sm text-[--color-text-tertiary] py-8">{RECIPES.ERROR}</p>
      )}

      {/* Recipe grid */}
      {!error && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(185px,1fr))] gap-4">
          {filtered.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              id={recipe.id}
              householdId={householdId}
              name={recipe.name}
              created_by_name={recipe.created_by_name}
              image_url={recipe.image_url}
              category_tag={recipe.category_tag}
              cookTimeLabel={null}
            />
          ))}

          {/* Empty state dashed card */}
          <button
            onClick={() => router.push(ROUTES.RECIPE_NEW(householdId))}
            className="rounded-xl min-h-[180px] flex flex-col items-center justify-center gap-2 border border-dashed border-[--color-border-secondary] bg-[--color-background-secondary] cursor-pointer hover:border-[--color-border-primary] transition-colors"
          >
            <PlusIcon className="h-8 w-8 text-[--color-text-tertiary]" />
            <span
              className="text-[15px] text-[--color-text-tertiary]"
              style={{ fontFamily: "'Caveat', cursive" }}
            >
              {RECIPES.EMPTY_CTA}
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
