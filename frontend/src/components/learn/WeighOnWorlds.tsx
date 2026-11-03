import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { breaksDown, EARTH_G, type LearnData } from './data'

/** Gravity made personal: type a weight on Earth, read the scale on the Moon and on Mars. */
export function WeighOnWorlds({ data, onTry }: { data: LearnData | null; onTry: () => void }) {
  const reduced = useReducedMotion()
  const [kg, setKg] = useState('40')
  const [tried, setTried] = useState(false)
  const value = Number(kg)
  const valid = kg.trim() !== '' && Number.isFinite(value) && value > 0 && value <= 300
  const g = (body: 'moon' | 'mars', fallback: number) => breaksDown(data?.targets.find((t) => t.body === body), 'gravity_m_s2') ?? fallback
  const worlds = [
    { name: 'Earth', g: EARTH_G, tone: 'text-data', bar: 'bg-data' },
    { name: 'Mars', g: g('mars', 3.73), tone: 'text-mars', bar: 'bg-mars' },
    { name: 'Moon', g: g('moon', 1.62), tone: 'text-reference', bar: 'bg-reference' },
  ]
  return (
    <div className="rounded-2xl border border-border bg-ink-850 p-5 sm:p-8">
      <h3 className="text-balance text-2xl font-semibold tracking-tight text-slate-100">Weigh yourself on three worlds</h3>
      <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-slate-300">
        A bathroom scale measures how hard gravity pulls you down. Your body stays the same, but the pull changes from world to world. No place on Earth can copy this, so every analog breaks down here.
      </p>
      <form
        className="mt-5 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid) return
          setTried(true)
          onTry()
        }}
      >
        <label className="flex flex-col gap-1.5 text-sm text-slate-300">
          What a scale shows on Earth (kg)
          <input
            type="number"
            inputMode="decimal"
            min={1}
            max={300}
            step="any"
            value={kg}
            onChange={(e) => {
              setKg(e.target.value)
              setTried(false)
            }}
            aria-invalid={!valid}
            className="h-11 w-36 rounded-md border border-border bg-ink-900 px-3 text-lg text-slate-100 tabular"
          />
        </label>
        <Button type="submit" size="lg" disabled={!valid}>
          Weigh me
        </Button>
        {!valid && <p className="w-full text-sm text-slate-400">Type a number from 1 to 300.</p>}
      </form>
      <ul className="mt-6 space-y-3" aria-live="polite">
        {worlds.map((w, n) => {
          const reading = valid && tried ? (value * w.g) / EARTH_G : null
          return (
            <li key={w.name} className="grid grid-cols-[4.5rem_minmax(0,1fr)_5.5rem] items-center gap-3">
              <span className={`text-[15px] ${w.tone}`}>{w.name}</span>
              <span className="h-3 overflow-hidden rounded-full bg-ink-700">
                <motion.span
                  className={`block h-full rounded-full ${w.bar}`}
                  initial={false}
                  animate={{ width: reading === null ? '0%' : `${(w.g / EARTH_G) * 100}%` }}
                  transition={{ duration: reduced ? 0 : 0.9, delay: reduced ? 0 : n * 0.15, ease: [0.16, 1, 0.3, 1] }}
                />
              </span>
              <span className="tabular text-right text-xl font-semibold text-slate-100">{reading === null ? '–' : `${reading.toFixed(1)} kg`}</span>
            </li>
          )
        })}
      </ul>
      {tried && valid && (
        <p className="mt-5 text-[15px] leading-relaxed text-slate-300">
          On the Moon you could jump about {Math.round(EARTH_G / worlds[2]!.g)} times higher. Astronauts practise for this underwater or on special harnesses, because no desert can do it.
        </p>
      )}
    </div>
  )
}
