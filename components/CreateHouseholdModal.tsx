'use client'

import { useState, useEffect, useRef } from 'react'
import { useCreateHousehold } from '@/hooks/useCreateHousehold'
import { HOUSEHOLDS } from '@/locales/en'
import { HOUSEHOLD_IMAGE_MAX_BYTES } from '@/lib/config'

interface CreateHouseholdModalProps {
  onClose: () => void
}

export default function CreateHouseholdModal({ onClose }: CreateHouseholdModalProps) {
  const [name, setName] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageError, setImageError] = useState('')
  const { createHousehold, loading, error, clearError } = useCreateHousehold(onClose)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null)
      return
    }
    const url = URL.createObjectURL(imageFile)
    setImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setImageError('')
    if (!file) return
    if (file.size > HOUSEHOLD_IMAGE_MAX_BYTES) {
      setImageError(HOUSEHOLDS.ERRORS.IMAGE_TOO_LARGE)
      e.target.value = ''
      return
    }
    setImageFile(file)
  }

  function handleRemoveImage() {
    setImageFile(null)
    setImageError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await createHousehold(name, imageFile)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 id="modal-title" className="text-base font-semibold text-gray-900">
            {HOUSEHOLDS.ACTIONS.NEW_HOUSEHOLD}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <svg
              className="h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {(error || imageError) && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
            >
              {error || imageError}
            </div>
          )}

          <div>
            <label
              htmlFor="household-name"
              className="block text-sm font-medium text-gray-700"
            >
              {HOUSEHOLDS.LABELS.HOUSEHOLD_NAME}
            </label>
            <input
              ref={inputRef}
              id="household-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (error) clearError()
              }}
              placeholder={HOUSEHOLDS.LABELS.HOUSEHOLD_NAME_PLACEHOLDER}
              required
              disabled={loading}
              className="mt-1.5 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
            />
          </div>

          <div>
            <span className="block text-sm font-medium text-gray-700">
              {HOUSEHOLDS.LABELS.COVER_PHOTO}
            </span>
            <p className="mt-0.5 text-xs text-gray-400">{HOUSEHOLDS.LABELS.COVER_PHOTO_HINT}</p>

            {imagePreview ? (
              <div className="mt-2 relative">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="Cover photo preview"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60"
                  >
                    {HOUSEHOLDS.LABELS.COVER_PHOTO_CHANGE}
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    disabled={loading}
                    className="rounded-lg border border-red-100 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 disabled:opacity-60"
                  >
                    {HOUSEHOLDS.LABELS.COVER_PHOTO_REMOVE}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="mt-2 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-8 text-gray-400 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-500 disabled:opacity-60"
              >
                <svg
                  className="h-7 w-7"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M13.5 12h.008v.008H13.5V12zm-4.5 9h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0018.75 4.5h-15A2.25 2.25 0 001.5 6.75v13.5A2.25 2.25 0 003.75 21z"
                  />
                </svg>
                <span className="text-xs font-medium">Click to upload a photo</span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
              disabled={loading}
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60"
            >
              {HOUSEHOLDS.ACTIONS.CANCEL}
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading && (
                <svg
                  className="h-4 w-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {loading ? HOUSEHOLDS.ACTIONS.CREATING : HOUSEHOLDS.ACTIONS.CREATE}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
