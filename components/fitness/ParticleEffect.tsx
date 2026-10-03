'use client'

import confetti from 'canvas-confetti'
import type { EffectStyle } from '@/lib/types/fitness'

// ── Sound synthesis ───────────────────────────────────────────────────────────

function playTone(
  frequency: number,
  type: OscillatorType,
  duration: number,
  gainStart: number,
  gainEnd: number,
  delay = 0,
) {
  try {
    const ctx = new AudioContext()
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + delay)
    gainNode.gain.setValueAtTime(gainStart, ctx.currentTime + delay)
    gainNode.gain.exponentialRampToValueAtTime(gainEnd, ctx.currentTime + delay + duration)

    oscillator.start(ctx.currentTime + delay)
    oscillator.stop(ctx.currentTime + delay + duration)
    oscillator.onended = () => ctx.close()
  } catch {
    // AudioContext blocked (e.g., no user gesture yet) — silently skip
  }
}

function soundArcade() {
  playTone(880, 'square', 0.08, 0.15, 0.001)
  playTone(1320, 'square', 0.08, 0.15, 0.001, 0.08)
  playTone(1760, 'square', 0.1, 0.15, 0.001, 0.16)
}

function soundSleek() {
  playTone(600, 'sine', 0.12, 0.1, 0.001)
}

function soundEnergy() {
  playTone(80, 'sawtooth', 0.15, 0.25, 0.001)
  playTone(160, 'sawtooth', 0.12, 0.2, 0.001, 0.05)
}

function soundNeon() {
  playTone(440, 'sawtooth', 0.05, 0.18, 0.001)
  playTone(880, 'sine', 0.15, 0.001, 0.001, 0.04)
}

// ── Effect configs ────────────────────────────────────────────────────────────
// Add new effects here — each entry is self-contained.

interface EffectConfig {
  style: EffectStyle
  fire: (x: number, y: number) => void
  sound: () => void
}

const EFFECT_CONFIGS: EffectConfig[] = [
  {
    style: 'arcade',
    fire: (x, y) => {
      confetti({
        particleCount: 60,
        spread: 55,
        origin: { x, y },
        colors: ['#ff0000', '#ffff00', '#00ff00', '#0000ff', '#ff00ff'],
        shapes: ['square'],
        scalar: 0.8,
        gravity: 1.2,
      })
    },
    sound: soundArcade,
  },
  {
    style: 'sleek',
    fire: (x, y) => {
      confetti({
        particleCount: 25,
        spread: 25,
        origin: { x, y },
        colors: ['#ffffff', '#e0e0e0', '#c0c0c0', '#a0a0a0'],
        shapes: ['circle'],
        scalar: 0.5,
        gravity: 2,
        drift: 0,
        ticks: 80,
      })
    },
    sound: soundSleek,
  },
  {
    style: 'energy',
    fire: (x, y) => {
      confetti({
        particleCount: 80,
        spread: 80,
        origin: { x, y },
        colors: ['#ff6a00', '#ffd700', '#ff4500', '#ffae00'],
        scalar: 1.1,
        gravity: 1.5,
        ticks: 120,
      })
      confetti({
        particleCount: 30,
        spread: 30,
        origin: { x, y },
        colors: ['#ff2200', '#ff8800'],
        scalar: 0.6,
        gravity: 2.5,
        ticks: 60,
      })
    },
    sound: soundEnergy,
  },
  {
    style: 'neon',
    fire: (x, y) => {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { x, y },
        colors: ['#9b59b6', '#00d2ff', '#a855f7', '#22d3ee', '#e040fb'],
        shapes: ['circle'],
        scalar: 0.7,
        ticks: 150,
        gravity: 0.8,
      })
    },
    sound: soundNeon,
  },
]

// ── Public API ────────────────────────────────────────────────────────────────

export function triggerEffect(
  originEl?: HTMLElement | null,
  style?: EffectStyle,
) {
  const config = style
    ? EFFECT_CONFIGS.find((c) => c.style === style) ?? EFFECT_CONFIGS[0]
    : EFFECT_CONFIGS[Math.floor(Math.random() * EFFECT_CONFIGS.length)]

  // Derive normalised origin from element position, fallback to centre
  let x = 0.5
  let y = 0.5
  if (originEl) {
    const rect = originEl.getBoundingClientRect()
    x = (rect.left + rect.width / 2) / window.innerWidth
    y = (rect.top + rect.height / 2) / window.innerHeight
  }

  config.fire(x, y)
  config.sound()
}
