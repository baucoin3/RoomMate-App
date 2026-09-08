export class SoundEngine {
  private _ac: AudioContext | null = null
  private _enabled: boolean

  constructor(enabled = true) {
    this._enabled = enabled
  }

  setEnabled(enabled: boolean) {
    this._enabled = enabled
  }

  private ctx(): AudioContext | null {
    if (!this._enabled) return null
    if (typeof window === 'undefined') return null
    if (!this._ac) {
      const C =
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext ?? window.AudioContext
      if (!C) return null
      this._ac = new C()
    }
    if (this._ac.state === 'suspended') void this._ac.resume()
    return this._ac
  }

  private glass(freq: number, dur: number, gain: number, delay = 0) {
    const ac = this.ctx()
    if (!ac) return
    const t0 = ac.currentTime + delay
    const out = ac.createGain()
    out.gain.setValueAtTime(0, t0)
    out.gain.linearRampToValueAtTime(gain, t0 + 0.008)
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    const bp = ac.createBiquadFilter()
    bp.type = 'highpass'
    bp.frequency.value = 500
    out.connect(bp)
    bp.connect(ac.destination)
    const partials: [number, number][] = [[1, 1], [2.01, 0.4], [3.02, 0.16]]
    partials.forEach(([mult, amp]) => {
      const o = ac.createOscillator()
      o.type = 'sine'
      o.frequency.value = freq * mult
      const g = ac.createGain()
      g.gain.value = amp
      o.connect(g)
      g.connect(out)
      o.start(t0)
      o.stop(t0 + dur + 0.02)
    })
  }

  playDetent() {
    this.glass(1560, 0.16, 0.045)
    this.glass(2340, 0.1, 0.018, 0.008)
  }

  playTap() {
    this.glass(880, 0.22, 0.05)
  }

  playComplete() {
    const freqs = [1046, 1318, 1568, 2093]
    const delays = [0, 0.07, 0.15, 0.26]
    freqs.forEach((f, i) => {
      this.glass(f, 0.9 - i * 0.12, 0.075 - i * 0.012, delays[i])
    })
  }

  playOpenPanel() {
    this.glass(1320, 0.3, 0.05)
  }

  playClosePanel() {
    this.glass(660, 0.24, 0.04)
  }

  playInvalid() {
    this.glass(320, 0.2, 0.05)
  }

  playSwipe() {
    const ac = this.ctx()
    if (!ac) return
    const t0 = ac.currentTime
    const o = ac.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(1800, t0)
    o.frequency.exponentialRampToValueAtTime(600, t0 + 0.18)
    const gain = ac.createGain()
    gain.gain.setValueAtTime(0, t0)
    gain.gain.linearRampToValueAtTime(0.06, t0 + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18)
    o.connect(gain)
    gain.connect(ac.destination)
    o.start(t0)
    o.stop(t0 + 0.2)
  }

  playFlush() {
    const ac = this.ctx()
    if (!ac) return
    const t0 = ac.currentTime
    const bufferSize = Math.floor(ac.sampleRate * 0.65)
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1

    const source = ac.createBufferSource()
    source.buffer = buffer

    const filter = ac.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(2200, t0)
    filter.frequency.exponentialRampToValueAtTime(180, t0 + 0.55)
    filter.Q.value = 1.8

    const gain = ac.createGain()
    gain.gain.setValueAtTime(0, t0)
    gain.gain.linearRampToValueAtTime(0.18, t0 + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.65)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(ac.destination)
    source.start(t0)
    source.stop(t0 + 0.65)
  }
}
