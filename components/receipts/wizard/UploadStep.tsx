'use client'

import { useState } from 'react'
import { RECEIPTS } from '@/locales/en'
import CameraCapture from '@/components/receipts/wizard/CameraCapture'

interface UploadStepProps {
  fileInputRef: React.RefObject<HTMLInputElement>
  previewUrl: string | null
  uploading: boolean
  imageUrl: string | null
  selectedFile: File | null
  fileError: string
  uploadError: string
  analysisError: string
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClearImage: () => void
  onRetryUpload: () => void
  onAnalyze: () => void
  onSkipToManual: () => void
  onCapturedFile: (file: File) => void
}

export default function UploadStep({
  fileInputRef,
  previewUrl,
  uploading,
  imageUrl,
  selectedFile,
  fileError,
  uploadError,
  analysisError,
  onFileSelect,
  onClearImage,
  onRetryUpload,
  onAnalyze,
  onSkipToManual,
  onCapturedFile,
}: UploadStepProps) {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload'>('camera')

  return (
    <div className="flex flex-col items-center gap-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onFileSelect}
      />

      {!previewUrl && (
        <>
          <div className="flex rounded-xl bg-white/5 border border-white/10 p-1 gap-1 w-full">
            {(['camera', 'upload'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-white text-black'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                {tab === 'camera' ? RECEIPTS.CAMERA.TAB_CAMERA : RECEIPTS.CAMERA.TAB_UPLOAD}
              </button>
            ))}
          </div>

          {activeTab === 'camera' && (
            <CameraCapture
              active
              onCapture={onCapturedFile}
              onUnsupported={() => setActiveTab('upload')}
            />
          )}

          {activeTab === 'upload' && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-3 py-12 rounded-xl border-2 border-dashed border-white/20 hover:border-indigo-500/50 hover:bg-white/5 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-white/40">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
              <span className="text-white/60">{RECEIPTS.ACTIONS.UPLOAD_PHOTO}</span>
            </button>
          )}
        </>
      )}

      {previewUrl && (
        <div className="relative w-full rounded-xl overflow-hidden border border-white/10">
          {/* Blob preview before upload — next/image does not support object URLs */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={RECEIPTS.ACTIONS.PREVIEW_IMAGE_ALT}
            className="w-full object-contain max-h-72"
          />
          {!uploading && (
            <button
              type="button"
              onClick={onClearImage}
              aria-label={RECEIPTS.ACTIONS.REMOVE_IMAGE}
              className="absolute top-2.5 right-2.5 w-9 h-9 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-sm border border-white/20 text-white/70 hover:text-white hover:bg-red-500/80 hover:border-red-400/50 hover:scale-110 transition-all duration-150"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          )}
        </div>
      )}

      {fileError && (
        <p className="text-red-400 text-sm text-center">{fileError}</p>
      )}

      {analysisError && (
        <p className="text-amber-400 text-sm text-center">{analysisError}</p>
      )}

      {uploadError && !uploading && (
        <div className="flex flex-col items-center gap-3 w-full">
          <p className="text-red-400 text-sm text-center">{uploadError}</p>
          <div className="flex gap-2 w-full">
            <button
              type="button"
              onClick={onRetryUpload}
              disabled={!selectedFile}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/30 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm font-medium"
            >
              {RECEIPTS.ACTIONS.RETRY_UPLOAD}
            </button>
            <button
              type="button"
              onClick={onClearImage}
              className="flex-1 py-2.5 rounded-lg border border-white/10 text-white/50 hover:text-white hover:border-white/20 transition-colors text-sm"
            >
              {RECEIPTS.ACTIONS.REMOVE_IMAGE}
            </button>
          </div>
        </div>
      )}

      {previewUrl && !uploadError && (
        <button
          type="button"
          onClick={onAnalyze}
          disabled={uploading || !imageUrl}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold text-sm hover:from-indigo-400 hover:to-violet-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
        >
          {uploading ? RECEIPTS.ACTIONS.UPLOADING : RECEIPTS.ACTIONS.ANALYZE_RECEIPT}
        </button>
      )}

      <button
        type="button"
        onClick={onSkipToManual}
        className="text-sm text-white/40 hover:text-white/70 transition-colors"
      >
        {RECEIPTS.ACTIONS.SKIP_UPLOAD}
      </button>
    </div>
  )
}
