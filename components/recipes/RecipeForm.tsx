'use client'

import { useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { RECIPES } from '@/locales/en'
import { ROUTES } from '@/lib/constants/routes'
import { RECIPES_BUCKET, RECIPE_IMAGE_MAX_BYTES } from '@/lib/config'
import { apiClient, getErrorMessage } from '@/lib/api/client'
import { createClient } from '@/lib/supabase/client'
import type { RecipeDetail, CreateRecipePayload, UpdateRecipePayload, RecipeTag } from '@/lib/types/recipe'

interface IngredientRow {
  name: string
  quantity: string
}

interface StepRow {
  instruction: string
}

interface RecipeFormProps {
  mode: 'create' | 'edit'
  householdId: string
  initialData?: RecipeDetail
  existingTags: RecipeTag[]
}

const inputClass =
  'px-3 py-2 text-sm rounded-lg border border-[--color-border-secondary] bg-[--color-background-secondary] text-[--color-text-primary] placeholder:text-[--color-text-tertiary] focus:outline-none focus:border-[--color-border-primary] transition-colors w-full'

function GripHandle() {
  return (
    <svg
      width="10"
      height="16"
      viewBox="0 0 10 16"
      fill="currentColor"
      className="text-[--color-text-tertiary] cursor-grab active:cursor-grabbing"
    >
      <circle cx="2" cy="2" r="1.5" />
      <circle cx="2" cy="7" r="1.5" />
      <circle cx="2" cy="12" r="1.5" />
      <circle cx="8" cy="2" r="1.5" />
      <circle cx="8" cy="7" r="1.5" />
      <circle cx="8" cy="12" r="1.5" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
      />
    </svg>
  )
}

function OrnamentalDivider() {
  return (
    <div className="flex items-center gap-3 my-6">
      <div className="flex-1 h-px bg-[--color-border-secondary]" />
      <span className="text-[--color-text-tertiary] text-xs tracking-widest">✦ ✦ ✦</span>
      <div className="flex-1 h-px bg-[--color-border-secondary]" />
    </div>
  )
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getFileExtension(file: File): string {
  const parts = file.name.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'jpg'
}

export default function RecipeForm({ mode, householdId, initialData, existingTags }: RecipeFormProps) {
  const router = useRouter()

  const [name, setName] = useState(initialData?.name ?? '')
  const [categoryTag, setCategoryTag] = useState(initialData?.category_tag ?? '')
  const [notes, setNotes] = useState(initialData?.notes ?? '')
  const [ingredients, setIngredients] = useState<IngredientRow[]>(
    initialData?.recipe_ingredients.length
      ? initialData.recipe_ingredients.map((i) => ({
          name: i.name,
          quantity: [i.quantity, i.unit].filter(Boolean).join(' '),
        }))
      : [{ name: '', quantity: '' }],
  )
  const [steps, setSteps] = useState<StepRow[]>(
    initialData?.recipe_steps.length
      ? initialData.recipe_steps.map((s) => ({ instruction: s.instruction }))
      : [{ instruction: '' }],
  )

  // Image state
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(initialData?.image_url ?? null)
  const [removeImage, setRemoveImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // ── Category dropdown ──────────────────────────────────────────────────────

  const tagNames = existingTags.map((t) => t.name)
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const [tagInput, setTagInput] = useState(initialData?.category_tag ?? '')

  const filteredTags = tagNames.filter((t) =>
    t.toLowerCase().includes(tagInput.toLowerCase()),
  )
  const isNewTag = tagInput.trim() !== '' && !tagNames.includes(tagInput.trim())

  function handleTagSelect(tag: string) {
    setTagInput(tag)
    setCategoryTag(tag)
    setShowTagDropdown(false)
  }

  function handleTagInputChange(value: string) {
    setTagInput(value)
    setCategoryTag(value)
    setShowTagDropdown(true)
  }

  // ── Image handlers ─────────────────────────────────────────────────────────

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > RECIPE_IMAGE_MAX_BYTES) {
      setFormError(RECIPES.FORM.ERROR_IMAGE_TOO_LARGE)
      return
    }
    setFormError('')
    setImageFile(file)
    setRemoveImage(false)
    setImagePreview(URL.createObjectURL(file))
  }

  function handleRemoveImage() {
    setImageFile(null)
    setRemoveImage(true)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Upload image to Supabase Storage ───────────────────────────────────────

  const uploadImage = useCallback(
    async (recipeId: string): Promise<string | null> => {
      if (!imageFile) return null
      const supabase = createClient()
      const ext = getFileExtension(imageFile)
      const slug = slugify(name || recipeId)
      const path = `${recipeId}/${slug}-${recipeId}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from(RECIPES_BUCKET)
        .upload(path, imageFile, { upsert: true })

      if (uploadError) {
        console.error('[RecipeForm] storage upload failed', uploadError)
        return null
      }

      const { data: urlData } = supabase.storage.from(RECIPES_BUCKET).getPublicUrl(path)
      return urlData.publicUrl
    },
    [imageFile, name],
  )

  // ── Ingredient helpers ─────────────────────────────────────────────────────

  function addIngredient() {
    setIngredients((prev) => [...prev, { name: '', quantity: '' }])
  }

  function removeIngredient(idx: number) {
    if (ingredients.length <= 1) return
    setIngredients((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateIngredient(idx: number, field: keyof IngredientRow, value: string) {
    setIngredients((prev) => prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)))
  }

  // ── Ingredient drag-and-drop ───────────────────────────────────────────────

  const dragIndexRef = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  function handleIngredientDragStart(idx: number) {
    dragIndexRef.current = idx
  }

  function handleIngredientDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    if (dragIndexRef.current !== null && dragIndexRef.current !== idx) {
      setDragOverIndex(idx)
    }
  }

  function handleIngredientDrop(idx: number) {
    const from = dragIndexRef.current
    if (from === null || from === idx) {
      dragIndexRef.current = null
      setDragOverIndex(null)
      return
    }
    const updated = [...ingredients]
    const [moved] = updated.splice(from, 1)
    updated.splice(idx, 0, moved)
    setIngredients(updated)
    dragIndexRef.current = null
    setDragOverIndex(null)
  }

  function handleIngredientDragEnd() {
    dragIndexRef.current = null
    setDragOverIndex(null)
  }

  // ── Step helpers ───────────────────────────────────────────────────────────

  function addStep() {
    setSteps((prev) => [...prev, { instruction: '' }])
  }

  function removeStep(idx: number) {
    if (steps.length <= 1) return
    setSteps((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateStep(idx: number, value: string) {
    setSteps((prev) => prev.map((row, i) => (i === idx ? { instruction: value } : row)))
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    setFormError('')

    if (!name.trim()) {
      setFormError(RECIPES.FORM.ERROR_TITLE_REQUIRED)
      return
    }
    if (!ingredients.some((i) => i.name.trim())) {
      setFormError(RECIPES.FORM.ERROR_INGREDIENT_REQUIRED)
      return
    }
    if (ingredients.some((i) => i.name.trim() && !i.quantity.trim())) {
      setFormError(RECIPES.FORM.ERROR_INGREDIENT_AMOUNT_REQUIRED)
      return
    }
    if (!steps.some((s) => s.instruction.trim())) {
      setFormError(RECIPES.FORM.ERROR_STEP_REQUIRED)
      return
    }

    setSaving(true)

    try {
      const ingredientPayload = ingredients
        .filter((i) => i.name.trim())
        .map((i) => ({ name: i.name.trim(), quantity: i.quantity.trim() || null }))

      const stepPayload = steps
        .filter((s) => s.instruction.trim())
        .map((s) => ({ instruction: s.instruction.trim() }))

      if (mode === 'create') {
        const payload: CreateRecipePayload = {
          name: name.trim(),
          notes: notes.trim() || null,
          category_tag: categoryTag.trim() || null,
          household_id: householdId,
          ingredients: ingredientPayload,
          steps: stepPayload,
        }

        const res = await apiClient.post<{ data: { id: string } }>('/api/recipes', payload)
        const recipeId = res.data.data.id

        // Upload image if selected
        if (imageFile) {
          const publicUrl = await uploadImage(recipeId)
          if (publicUrl) {
            try {
              await apiClient.patch(`/api/recipes/${recipeId}`, { image_url: publicUrl, name: name.trim(), notes: notes.trim() || null, category_tag: categoryTag.trim() || null, ingredients: ingredientPayload, steps: stepPayload })
            } catch (patchErr) {
              console.error('[RecipeForm] image_url patch failed', patchErr)
              setFormError(RECIPES.FORM.ERROR_IMAGE_UPLOAD)
            }
          } else {
            setFormError(RECIPES.FORM.ERROR_IMAGE_UPLOAD)
          }
        }

        // Upsert new category tag if it's a brand-new one
        if (categoryTag.trim() && isNewTag) {
          try {
            await apiClient.post('/api/recipes/tags', { household_id: householdId, name: categoryTag.trim() })
          } catch {
            // Non-fatal — recipe already saved
          }
        }

        router.push(ROUTES.RECIPE_DETAIL(householdId, recipeId))
      } else {
        // Edit mode
        const recipeId = initialData!.id
        let imageUrl: string | null | undefined = undefined

        if (imageFile) {
          const publicUrl = await uploadImage(recipeId)
          if (publicUrl) {
            imageUrl = publicUrl
          } else {
            setFormError(RECIPES.FORM.ERROR_IMAGE_UPLOAD)
          }
        } else if (removeImage) {
          imageUrl = null
        }

        const payload: UpdateRecipePayload = {
          name: name.trim(),
          notes: notes.trim() || null,
          category_tag: categoryTag.trim() || null,
          image_url: imageUrl,
          ingredients: ingredientPayload,
          steps: stepPayload,
        }

        await apiClient.patch(`/api/recipes/${recipeId}`, payload)

        // Upsert new category tag if it's a brand-new one
        if (categoryTag.trim() && isNewTag) {
          try {
            await apiClient.post('/api/recipes/tags', { household_id: householdId, name: categoryTag.trim() })
          } catch {
            // Non-fatal
          }
        }

        router.push(ROUTES.RECIPE_DETAIL(householdId, recipeId))
      }
    } catch (err) {
      setFormError(getErrorMessage(err) || RECIPES.FORM.ERROR_SAVE_FAILED)
      setSaving(false)
    }
  }

  const pageTitle = mode === 'create' ? RECIPES.NEW.PAGE_TITLE : RECIPES.EDIT.PAGE_TITLE
  const pageSubtitle = mode === 'create' ? RECIPES.NEW.PAGE_SUBTITLE : RECIPES.EDIT.PAGE_SUBTITLE
  const saveLabel = saving
    ? RECIPES.FORM.SAVING
    : mode === 'create'
      ? RECIPES.FORM.SAVE_CREATE
      : RECIPES.FORM.SAVE_EDIT

  return (
    <div className="flex flex-col pb-24 md:pb-8 max-w-2xl mx-auto">
      {/* Back link */}
      <Link
        href={ROUTES.HOUSEHOLD_RECIPES(householdId)}
        className="text-sm text-[--color-text-tertiary] hover:text-[--color-text-secondary] transition-colors mb-5 self-start"
      >
        {RECIPES.DETAIL.BACK}
      </Link>

      {/* Page header */}
      <div className="mb-1">
        <h1
          className="text-[26px] font-[500] leading-tight"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {pageTitle}
        </h1>
        <p
          className="text-[16px] text-[--color-text-secondary] mt-0.5"
          style={{ fontFamily: "'Caveat', cursive" }}
        >
          {pageSubtitle}
        </p>
      </div>

      <OrnamentalDivider />

      {/* Basic info card */}
      <div className="rounded-xl border border-[--color-border-secondary] bg-[--color-background-card] p-5 flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Recipe name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-[--color-text-secondary]">
              {RECIPES.FORM.NAME_LABEL}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={RECIPES.FORM.NAME_PLACEHOLDER}
              className={inputClass}
            />
          </div>

          {/* Category tag — combobox */}
          <div className="flex flex-col gap-1.5 relative">
            <label className="text-[13px] font-medium text-[--color-text-secondary]">
              {RECIPES.FORM.CATEGORY_LABEL}
            </label>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => handleTagInputChange(e.target.value)}
              onFocus={() => setShowTagDropdown(true)}
              onBlur={() => setTimeout(() => setShowTagDropdown(false), 150)}
              placeholder={RECIPES.FORM.CATEGORY_PLACEHOLDER}
              className={inputClass}
              autoComplete="off"
            />
            {showTagDropdown && (filteredTags.length > 0 || isNewTag) && (
              <ul className="absolute top-full left-0 right-0 mt-1 z-20 rounded-lg border border-[--color-border-secondary] bg-[--color-background-card] shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                {filteredTags.map((tag) => (
                  <li key={tag}>
                    <button
                      type="button"
                      onMouseDown={() => handleTagSelect(tag)}
                      className="w-full text-left px-3 py-2 text-sm text-[--color-text-primary] hover:bg-[--color-background-secondary] transition-colors"
                    >
                      {tag}
                    </button>
                  </li>
                ))}
                {isNewTag && (
                  <li>
                    <button
                      type="button"
                      onMouseDown={() => handleTagSelect(tagInput.trim())}
                      className="w-full text-left px-3 py-2 text-sm text-amber-400 hover:bg-[--color-background-secondary] transition-colors"
                    >
                      {RECIPES.FORM.CATEGORY_NEW_OPTION(tagInput.trim())}
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[--color-text-secondary] flex items-center gap-1.5">
            {RECIPES.FORM.DESCRIPTION_LABEL}
            <span className="text-[11px] text-[--color-text-tertiary] font-normal">
              {RECIPES.FORM.DESCRIPTION_OPTIONAL}
            </span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={RECIPES.FORM.DESCRIPTION_PLACEHOLDER}
            rows={3}
            style={{ resize: 'none', minHeight: '72px' }}
            className={inputClass}
          />
        </div>

        {/* Photo upload */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-[--color-text-secondary] flex items-center gap-1.5">
            {RECIPES.FORM.IMAGE_LABEL}
            <span className="text-[11px] text-[--color-text-tertiary] font-normal">
              {RECIPES.FORM.IMAGE_OPTIONAL}
            </span>
          </label>

          {imagePreview ? (
            <div className="relative w-full aspect-[16/6] rounded-lg overflow-hidden group">
              <Image src={imagePreview} alt="Recipe preview" fill className="object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs rounded-md bg-white/90 text-[#2C2C2A] font-medium hover:bg-white transition-colors"
                >
                  {RECIPES.FORM.IMAGE_CHANGE}
                </button>
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="px-3 py-1.5 text-xs rounded-md bg-red-500/80 text-white font-medium hover:bg-red-500 transition-colors"
                >
                  {RECIPES.FORM.IMAGE_REMOVE}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 w-full h-24 rounded-lg border border-dashed border-[--color-border-secondary] bg-[--color-background-secondary] text-[--color-text-tertiary] hover:border-[--color-border-primary] hover:text-[--color-text-secondary] transition-colors text-sm"
            >
              <i className="ti-camera text-base" />
              {RECIPES.FORM.IMAGE_CHOOSE}
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
            aria-label={RECIPES.FORM.IMAGE_LABEL}
          />
        </div>
      </div>

      <OrnamentalDivider />

      {/* Ingredients card */}
      <section className="rounded-xl border border-[--color-border-secondary] bg-[--color-background-card] p-5">
        <h2
          className="text-[17px] font-[500] mb-4"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {RECIPES.FORM.INGREDIENTS_HEADING}
        </h2>

        <div className="grid grid-cols-[16px_2fr_1fr_28px] gap-2 mb-2">
          <span />
          <span className="text-[12px] text-[--color-text-tertiary]">
            {RECIPES.FORM.INGREDIENT_COL_NAME}
          </span>
          <span className="text-[12px] text-[--color-text-tertiary]">
            {RECIPES.FORM.INGREDIENT_COL_AMOUNT}
          </span>
          <span />
        </div>

        {ingredients.map((row, idx) => (
          <div
            key={idx}
            draggable
            onDragStart={() => handleIngredientDragStart(idx)}
            onDragOver={(e) => handleIngredientDragOver(e, idx)}
            onDrop={() => handleIngredientDrop(idx)}
            onDragEnd={handleIngredientDragEnd}
            className={`grid grid-cols-[16px_2fr_1fr_28px] gap-2 items-center mb-2 rounded-lg transition-colors ${
              dragOverIndex === idx ? 'bg-amber-400/10 ring-1 ring-amber-400/40' : ''
            }`}
          >
            <div className="flex items-center justify-center h-full">
              <GripHandle />
            </div>
            <input
              type="text"
              value={row.name}
              onChange={(e) => updateIngredient(idx, 'name', e.target.value)}
              placeholder={RECIPES.FORM.INGREDIENT_NAME_PLACEHOLDER}
              className={inputClass}
            />
            <input
              type="text"
              value={row.quantity}
              onChange={(e) => updateIngredient(idx, 'quantity', e.target.value)}
              placeholder={RECIPES.FORM.INGREDIENT_QTY_PLACEHOLDER}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => removeIngredient(idx)}
              disabled={ingredients.length <= 1}
              className="flex items-center justify-center w-7 h-7 rounded-md text-red-400 hover:text-red-300 hover:bg-red-400/15 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
              aria-label={RECIPES.FORM.INGREDIENT_REMOVE_LABEL}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addIngredient}
          className="flex items-center gap-1 text-[13px] text-[#C8882E] hover:text-[#A96F1F] transition-colors mt-2"
        >
          <i className="ti-plus text-[11px]" />
          {RECIPES.FORM.ADD_INGREDIENT}
        </button>
      </section>

      <OrnamentalDivider />

      {/* Steps card */}
      <section className="rounded-xl border border-[--color-border-secondary] bg-[--color-background-card] p-5">
        <h2
          className="text-[17px] font-[500] mb-4"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {RECIPES.FORM.STEPS_HEADING}
        </h2>

        <div className="flex flex-col gap-2.5">
          {steps.map((row, idx) => (
            <div key={idx} className="flex gap-2.5 items-center">
              <span className="w-[26px] h-[26px] rounded-full border border-[--color-border-secondary] flex items-center justify-center text-[12px] font-medium text-[--color-text-secondary] flex-shrink-0">
                {idx + 1}
              </span>
              <textarea
                value={row.instruction}
                onChange={(e) => updateStep(idx, e.target.value)}
                placeholder={RECIPES.FORM.STEP_PLACEHOLDER}
                rows={2}
                style={{ resize: 'none', minHeight: '52px' }}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => removeStep(idx)}
                disabled={steps.length <= 1}
                className="flex items-center justify-center w-7 h-7 rounded-md text-red-400 hover:text-red-300 hover:bg-red-400/15 transition-colors disabled:opacity-20 disabled:cursor-not-allowed flex-shrink-0"
                aria-label={RECIPES.FORM.STEP_REMOVE_LABEL}
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addStep}
          className="flex items-center gap-1 text-[13px] text-[#C8882E] hover:text-[#A96F1F] transition-colors mt-4"
        >
          <i className="ti-plus text-[11px]" />
          {RECIPES.FORM.ADD_STEP}
        </button>
      </section>

      <OrnamentalDivider />

      {/* Form error */}
      {formError && (
        <p className="text-sm text-red-400 mb-3 -mt-2" role="alert">
          {formError}
        </p>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-end gap-2.5">
        <Link
          href={ROUTES.HOUSEHOLD_RECIPES(householdId)}
          className="px-4 py-1.5 text-sm rounded-md border border-[--color-border-secondary] text-[--color-text-secondary] hover:border-[--color-border-primary] hover:text-[--color-text-primary] transition-colors"
        >
          {RECIPES.FORM.CANCEL}
        </Link>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-md bg-[#C8882E] hover:bg-[#A96F1F] text-white font-medium transition-colors disabled:opacity-60"
        >
          {!saving && <i className="ti-check text-[13px]" />}
          {saveLabel}
        </button>
      </div>
    </div>
  )
}
