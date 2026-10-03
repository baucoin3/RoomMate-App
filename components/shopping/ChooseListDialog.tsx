'use client'

import { useEffect, useRef } from 'react'
import { SHOPPING } from '@/locales/en'
import type { ShoppingList } from '@/lib/types/shopping'

interface ChooseListDialogProps {
  open: boolean
  lists: ShoppingList[]
  currentUserId: string
  onChoose: (list: ShoppingList) => void
  onClose: () => void
}

export default function ChooseListDialog({ open, lists, currentUserId, onChoose, onClose }: ChooseListDialogProps) {
  const firstButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) firstButtonRef.current?.focus()
  }, [open])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (open) window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(8,10,18,0.55)',
          backdropFilter: 'blur(6px)',
          zIndex: 850,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity .3s ease',
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: open ? 'translate(-50%,-50%) scale(1)' : 'translate(-50%,-48%) scale(0.96)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'transform .35s cubic-bezier(.2,.85,.2,1), opacity .3s ease',
          zIndex: 860,
          width: 'min(360px, calc(100vw - 32px))',
          background: 'linear-gradient(160deg,#2a2c3e,#181a28)',
          border: '1px solid rgba(145,132,217,0.35)',
          borderRadius: 20,
          padding: '28px 24px 20px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 0 40px rgba(145,132,217,0.1)',
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 400, color: '#e9e9ed', marginBottom: 20 }}>
          {SHOPPING.CHOOSE_LIST_TITLE}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto', marginBottom: 16 }}>
          {lists.map((list, idx) => {
            const isMine = list.owner_type === 'user' && list.user_id === currentUserId
            return (
              <button
                key={list.id}
                ref={idx === 0 ? firstButtonRef : undefined}
                type="button"
                onClick={() => onChoose(list)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  borderRadius: 12,
                  background: 'rgba(233,233,237,0.05)',
                  border: '1px solid rgba(233,233,237,0.08)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background .15s ease, border-color .15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(145,132,217,0.12)'
                  e.currentTarget.style.borderColor = 'rgba(145,132,217,0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(233,233,237,0.05)'
                  e.currentTarget.style.borderColor = 'rgba(233,233,237,0.08)'
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 500, color: '#e9e9ed' }}>{list.name}</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    padding: '3px 8px',
                    borderRadius: 20,
                    background: isMine ? 'rgba(59,130,246,0.18)' : 'rgba(234,179,8,0.18)',
                    color: isMine ? '#93c5fd' : '#fde047',
                    border: isMine ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(234,179,8,0.3)',
                  }}
                >
                  {isMine ? SHOPPING.BADGES.MINE : SHOPPING.BADGES.HOUSEHOLD}
                </span>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%', height: 40, borderRadius: 10,
            cursor: 'pointer', background: 'transparent',
            border: '1px solid rgba(233,233,237,0.1)',
            color: '#75798c', fontSize: 14,
          }}
        >
          {SHOPPING.CHOOSE_LIST_CANCEL}
        </button>
      </div>
    </>
  )
}
