'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type FacingMode = 'environment' | 'user'

const STORAGE_KEY = 'roomate-camera-facing'

function readStoredFacing(): FacingMode {
  if (typeof window === 'undefined') return 'environment'
  const val = window.localStorage.getItem(STORAGE_KEY)
  return val === 'user' ? 'user' : 'environment'
}

export interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement>
  facingMode: FacingMode
  isStarting: boolean
  isReady: boolean
  error: string
  capture: () => File | null
  flipCamera: () => void
}

export function useCamera(active: boolean): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facingMode, setFacingMode] = useState<FacingMode>(readStoredFacing)
  const [isStarting, setIsStarting] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState('')

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setIsReady(false)
  }, [])

  const startStream = useCallback(
    async (facing: FacingMode) => {
      stopStream()
      setError('')
      setIsStarting(true)

      if (!navigator.mediaDevices?.getUserMedia) {
        setError('not_supported')
        setIsStarting(false)
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        })
        streamRef.current = stream
        stream.getTracks().forEach((track) => {
          track.onended = () => {
            setIsReady(false)
            setError('stream_error')
          }
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => {
            videoRef.current
              ?.play()
              .then(() => setIsReady(true))
              .catch(() => setIsReady(false))
          }
        }
      } catch (err) {
        const name = (err as DOMException).name
        setError(
          name === 'NotAllowedError' || name === 'PermissionDeniedError'
            ? 'permission_denied'
            : 'stream_error',
        )
      } finally {
        setIsStarting(false)
      }
    },
    [stopStream],
  )

  useEffect(() => {
    if (active) startStream(facingMode)
    else stopStream()
    return stopStream
  }, [active, facingMode, startStream, stopStream])

  const flipCamera = useCallback(() => {
    setFacingMode((prev) => {
      const next: FacingMode = prev === 'environment' ? 'user' : 'environment'
      try {
        window.localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // localStorage unavailable (e.g. private browsing) — preference won't persist
      }
      return next
    })
  }, [])

  const capture = useCallback((): File | null => {
    const video = videoRef.current
    if (!video || !isReady) return null

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    const byteString = atob(dataUrl.split(',')[1])
    const buffer = new Uint8Array(byteString.length)
    for (let i = 0; i < byteString.length; i++) buffer[i] = byteString.charCodeAt(i)
    const blob = new Blob([buffer], { type: 'image/jpeg' })
    return new File([blob], `receipt-${Date.now()}.jpg`, { type: 'image/jpeg' })
  }, [isReady])

  return { videoRef, facingMode, isStarting, isReady, error, capture, flipCamera }
}
