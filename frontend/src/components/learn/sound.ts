import { CHORDS, LENGTH, SCENES, soundCues, type Cue } from './scenes'

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

/**
 * The explainer's soundtrack, made live with the Web Audio API: a slow ambient pad that changes
 * chord with each scene, NASA's Quindar beeps at the start and end, and small sounds that follow
 * what happens on screen (dots appearing, the data scan, the score counting up). Nothing is
 * downloaded and nothing needs a licence. play(t) starts from any point, so pause, scrubbing and
 * chapter jumps stay in sync.
 */
export class ClipSound {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private reverb: ConvolverNode | null = null
  private noise: AudioBuffer | null = null
  private bus: GainNode | null = null
  private sources: AudioScheduledSourceNode[] = []
  private cues: Cue[]

  constructor(analogs: number) {
    this.cues = soundCues(analogs)
  }

  setAnalogs(analogs: number) {
    this.cues = soundCues(analogs)
  }

  /** Create or wake the audio context. Call from a click or key press (browsers require a gesture). */
  unlock(): boolean {
    const AC = typeof window === 'undefined' ? undefined : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
    if (!AC) return false
    if (!this.ctx) {
      const ctx = new AC()
      this.ctx = ctx
      this.master = ctx.createGain()
      this.master.gain.value = 0.9
      const comp = ctx.createDynamicsCompressor() // keeps the mix gentle on small speakers
      this.master.connect(comp).connect(ctx.destination)
      this.reverb = ctx.createConvolver()
      this.reverb.buffer = impulse(ctx, 3.2)
      const wet = ctx.createGain()
      wet.gain.value = 0.55
      this.reverb.connect(wet).connect(this.master)
      this.noise = noiseBuffer(ctx)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return true
  }

  get ready() {
    return !!this.ctx && this.ctx.state !== 'closed'
  }

  /** Play from clip time `from` (seconds). Replaces anything already playing. */
  play(from: number) {
    this.stop()
    const ctx = this.ctx
    if (!ctx || !this.master || !this.reverb) return
    const now = ctx.currentTime + 0.03
    const at = (t: number) => now + (t - from)
    const bus = ctx.createGain()
    bus.gain.setValueAtTime(0, now)
    bus.gain.linearRampToValueAtTime(1, now + 0.25)
    bus.connect(this.master)
    bus.connect(this.reverb)
    this.bus = bus

    // pad: one chord per scene, crossfading at the cuts
    SCENES.forEach((s, i) => {
      if (s.end <= from) return
      const start = Math.max(s.start, from)
      const end = i === SCENES.length - 1 ? LENGTH + 2.5 : s.end + 1.2
      for (const midi of CHORDS[i]!) this.padVoice(hz(midi), at(start), at(end), start > s.start ? 0.4 : 1.4)
    })
    // a low drone under everything
    this.padVoice(hz(38), at(Math.max(0, from)), at(LENGTH + 2.5), 1.5, 0.05, 'sine')

    for (const c of this.cues) if (c.t >= from) this.cue(c, at(c.t))
  }

  /** Fade out and stop everything quickly (pause, scrub). */
  stop() {
    const ctx = this.ctx
    if (!ctx || !this.bus) return
    const t = ctx.currentTime
    this.bus.gain.cancelScheduledValues(t)
    this.bus.gain.setValueAtTime(this.bus.gain.value, t)
    this.bus.gain.linearRampToValueAtTime(0, t + 0.12)
    for (const s of this.sources) {
      try {
        s.stop(t + 0.15)
      } catch {
        // already stopped
      }
    }
    const old = this.bus
    setTimeout(() => old.disconnect(), 300)
    this.sources = []
    this.bus = null
  }

  dispose() {
    this.stop()
    void this.ctx?.close()
    this.ctx = null
  }

  private track<T extends AudioScheduledSourceNode>(n: T): T {
    this.sources.push(n)
    return n
  }

  private padVoice(f: number, t0: number, t1: number, attack: number, level = 0.035, wave: OscillatorType = 'triangle') {
    const ctx = this.ctx!
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(level, t0 + attack)
    g.gain.setValueAtTime(level, Math.max(t0 + attack, t1 - 1.4))
    g.gain.linearRampToValueAtTime(0, t1)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1100
    lp.Q.value = 0.4
    g.connect(lp).connect(this.bus!)
    for (const detune of [-7, 7]) {
      const o = this.track(ctx.createOscillator())
      o.type = wave
      o.frequency.value = f
      o.detune.value = detune
      o.connect(g)
      o.start(t0)
      o.stop(t1 + 0.05)
    }
  }

  private cue(c: Cue, t: number) {
    const ctx = this.ctx!
    const bus = this.bus!
    const env = (peak: number, attack: number, decay: number) => {
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(peak, t + attack)
      g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
      g.connect(bus)
      return g
    }
    const tone = (type: OscillatorType, f: number, dest: AudioNode, dur: number) => {
      const o = this.track(ctx.createOscillator())
      o.type = type
      o.frequency.value = f
      o.connect(dest)
      o.start(t)
      o.stop(t + dur)
      return o
    }
    switch (c.kind) {
      case 'quindar': {
        const g = ctx.createGain()
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(0.045, t + 0.01)
        g.gain.setValueAtTime(0.045, t + 0.24)
        g.gain.linearRampToValueAtTime(0, t + 0.25)
        g.connect(bus)
        tone('sine', c.hz, g, 0.26)
        break
      }
      case 'pluck':
        tone('triangle', hz(c.midi), env(0.07, 0.006, 0.7), 0.75)
        break
      case 'blip':
        tone('sine', hz(c.midi + 12), env(0.05, 0.004, 0.3), 0.35)
        break
      case 'chime': {
        for (const [m, p] of [
          [74, 0.07],
          [81, 0.045],
          [86, 0.03],
        ] as const)
          tone('sine', hz(m), env(p, 0.005, 2.6), 2.7)
        break
      }
      case 'rise': {
        const g = env(0.03, c.dur * 0.8, c.dur * 0.25)
        const o = tone('sine', 220, g, c.dur + 0.1)
        o.frequency.setValueAtTime(220, t)
        o.frequency.exponentialRampToValueAtTime(880, t + c.dur)
        break
      }
      case 'sweep':
      case 'whoosh': {
        const dur = c.kind === 'sweep' ? c.dur : 1.1
        const src = this.track(ctx.createBufferSource())
        src.buffer = this.noise
        src.loop = true
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.Q.value = c.kind === 'sweep' ? 7 : 1.2
        bp.frequency.setValueAtTime(c.kind === 'sweep' ? 350 : 1800, t)
        bp.frequency.exponentialRampToValueAtTime(c.kind === 'sweep' ? 3200 : 300, t + dur)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, t)
        g.gain.exponentialRampToValueAtTime(c.kind === 'sweep' ? 0.05 : 0.04, t + dur * 0.4)
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
        src.connect(bp).connect(g).connect(bus)
        src.start(t)
        src.stop(t + dur + 0.05)
        break
      }
    }
  }
}

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const d = b.getChannelData(0)
  let seed = 7 // fixed seed: the same noise every time
  for (let i = 0; i < d.length; i++) {
    seed = (seed * 16807) % 2147483647
    d[i] = (seed / 2147483647) * 2 - 1
  }
  return b
}

/** A simple reverb tail: decaying noise in two channels. */
function impulse(ctx: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds)
  const b = ctx.createBuffer(2, len, ctx.sampleRate)
  let seed = 11
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      seed = (seed * 16807) % 2147483647
      d[i] = ((seed / 2147483647) * 2 - 1) * (1 - i / len) ** 2.6
    }
  }
  return b
}
