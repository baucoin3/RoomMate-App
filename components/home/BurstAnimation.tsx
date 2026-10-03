'use client'

import { useEffect } from 'react'

interface BurstAnimationProps {
  color: string
  onDone: () => void
  scale?: number  // 1.0 = full, 0.45 = partial tap
}

export default function BurstAnimation({ color, onDone, scale = 1 }: BurstAnimationProps) {
  useEffect(() => {
    const timer = setTimeout(onDone, 1000)
    return () => clearTimeout(timer)
  }, [onDone])

  const radius = Math.round(190 * scale)
  const sparks = Array.from({ length: scale < 0.6 ? 8 : 12 }, (_, i) => {
    const count = scale < 0.6 ? 8 : 12
    const ang = (i / count) * Math.PI * 2
    return {
      dx: Math.round(Math.cos(ang) * radius),
      dy: Math.round(Math.sin(ang) * radius),
    }
  })

  const ringSize = Math.round(240 * scale)
  const flashSize = Math.round(420 * scale)
  const center = { left: Math.round((240 - ringSize) / 2), top: Math.round(148 * scale) }

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: 400 }}>
      {/* Ring 1 */}
      <div
        style={{
          position: 'absolute',
          ...center,
          width: ringSize,
          height: ringSize,
          borderRadius: '50%',
          border: `2px solid ${color}`,
          animation: 'burstRing .85s cubic-bezier(.15,.7,.3,1) forwards',
        }}
      />
      {/* Ring 2 */}
      <div
        style={{
          position: 'absolute',
          ...center,
          width: ringSize,
          height: ringSize,
          borderRadius: '50%',
          border: `1px solid ${color}`,
          animation: 'burstRing 1s cubic-bezier(.15,.7,.3,1) .12s forwards',
        }}
      />
      {/* Flash */}
      <div
        style={{
          position: 'absolute',
          ...center,
          width: flashSize,
          height: flashSize,
          borderRadius: '50%',
          background: `radial-gradient(circle,${color},transparent 62%)`,
          animation: 'burstFlash .7s ease-out forwards',
        }}
      />
      {/* Sparks */}
      {sparks.map(({ dx, dy }, i) => (
        <div
          key={i}
          style={
            {
              position: 'absolute',
              ...center,
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: color,
              boxShadow: `0 0 10px ${color}`,
              '--dx': `${dx}px`,
              '--dy': `${dy}px`,
              animation: 'sparkOut .9s cubic-bezier(.15,.7,.3,1) forwards',
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
