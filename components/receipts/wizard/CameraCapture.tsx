'use client'

import { useCallback, useEffect } from 'react'
import { RECEIPTS } from '@/locales/en'
import { CameraFlipIcon } from '@/components/icons'
import { useCamera } from '@/hooks/useCamera'

interface CameraCaptureProps {
  active: boolean
  onCapture: (file: File) => void
  onUnsupported: () => void
}

function errorMessage(code: string): string {
  if (code === 'permission_denied') return RECEIPTS.CAMERA.PERMISSION_DENIED
  if (code === 'not_supported') return RECEIPTS.CAMERA.NOT_SUPPORTED
  if (code === '') return ''
  return RECEIPTS.CAMERA.STREAM_ERROR
}

export default function CameraCapture({ active, onCapture, onUnsupported }: CameraCaptureProps) {
  const { videoRef, isStarting, isReady, error, capture, flipCamera } = useCamera(active)

  useEffect(() => {
    if (error === 'not_supported') onUnsupported()
  }, [error, onUnsupported])

  const handleCapture = useCallback(() => {
    const file = capture()
    if (file) onCapture(file)
  }, [capture, onCapture])

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="relative w-full rounded-xl overflow-hidden border border-white/10 bg-black aspect-[4/3]">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          aria-label="Camera preview"
        />

        {isStarting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <span className="text-white/60 text-sm">{RECEIPTS.CAMERA.STARTING}</span>
          </div>
        )}

        {error && !isStarting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 px-6 text-center">
            <p className="text-red-400 text-sm">{errorMessage(error)}</p>
          </div>
        )}

        {isReady && (
          <button
            type="button"
            onClick={flipCamera}
            aria-label={RECEIPTS.CAMERA.FLIP_CAMERA}
            className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm border border-white/20 text-white/80 hover:text-white hover:bg-black/70 transition-all"
          >
            <CameraFlipIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-center py-2">
        <button
          type="button"
          onClick={handleCapture}
          disabled={!isReady}
          aria-label={RECEIPTS.CAMERA.CAPTURE}
          className="w-16 h-16 rounded-full border-4 border-white/30 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-transform shadow-lg"
        />
      </div>
    </div>
  )
}
