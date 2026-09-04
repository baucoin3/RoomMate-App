'use client'

import { useEffect } from 'react'

interface BurstAnimationProps {
  color: string
  onDone: () => void
}

export default function BurstAnimation({ color, onDone }: BurstAnimationProps) {
  useEffect(() => {
    const timer = setTimeout(onDone, 1000)
    return () => clearTimeout(timer)
  }, [onDone])

  const sparks = Array.from({ length: 12 }, (_, i) => {
    const ang = (i / 12) * Math.PI * 2
    return {
      dx: Math.round(Math.cos(ang) * 190),
      dy: Math.round(Math.sin(ang) * 190),
    }
  })

  const center = { left: 0, top: 148 }

  return (
    <div style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: 400 }}>
      {/* Ring 1 */}
      <div
        style={{
          position: 'absolute',
          ...center,
          width: 240,
          height: 240,
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
          width: 240,
          height: 240,
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
          width: 420,
          height: 420,
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
