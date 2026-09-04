'use client'

import { useEffect } from 'react'
import confetti from 'canvas-confetti'
import { DAILY_TASKS } from '@/locales/en'

interface JackpotOverlayProps {
  onDone: () => void
}

export default function JackpotOverlay({ onDone }: JackpotOverlayProps) {
  useEffect(() => {
    confetti({
      particleCount: 180,
      spread: 100,
      origin: { y: 0.5 },
      colors: ['#9184d9', '#b5abfc', '#d2cefd', '#ffffff', '#ffd700'],
    })
    const t1 = setTimeout(() => {
      confetti({ particleCount: 70, spread: 55, origin: { x: 0.2, y: 0.55 }, colors: ['#9184d9', '#ffd700', '#b5abfc'] })
      confetti({ particleCount: 70, spread: 55, origin: { x: 0.8, y: 0.55 }, colors: ['#9184d9', '#ffd700', '#b5abfc'] })
    }, 350)
    const t2 = setTimeout(onDone, 4500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onDone])

  return (
    <div
      onClick={onDone}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(8,10,18,0.72)',
        backdropFilter: 'blur(10px)',
        cursor: 'pointer',
        animation: 'jkFadeIn 0.35s ease',
      }}
    >
      <div
        style={{
          fontSize: 88,
          fontWeight: 200,
          letterSpacing: '0.18em',
          color: '#e9e9ed',
          textShadow:
            '0 0 40px rgba(145,132,217,0.95), 0 0 90px rgba(145,132,217,0.55), 0 0 160px rgba(145,132,217,0.25)',
          animation: 'jkPop 0.55s cubic-bezier(.2,.85,.2,1)',
          userSelect: 'none',
        }}
      >
        {DAILY_TASKS.JACKPOT}
      </div>
      <div
        style={{
          marginTop: 20,
          fontSize: 13,
          letterSpacing: '0.18em',
          color: 'rgba(233,233,237,0.35)',
          textTransform: 'uppercase',
          animation: 'jkPop 0.7s cubic-bezier(.2,.85,.2,1)',
        }}
      >
        tap to dismiss
      </div>
      <style>{`
        @keyframes jkFadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes jkPop {
          0%   { transform: scale(0.35) translateY(20px); opacity:0 }
          70%  { transform: scale(1.04) translateY(-4px); opacity:1 }
          100% { transform: scale(1) translateY(0); opacity:1 }
        }
      `}</style>
    </div>
  )
}
