import facts from '@/data/site_facts.json'

/** Timeline of the 30-second explainer on /learn: six scenes, each with a chapter name and a caption. */
export const LENGTH = 30
export const TIBET = { lat: 37.05, lon: 86.75 }

export type Scene = { start: number; end: number; chapter: string; caption: (n: Numbers) => string }
export type Numbers = { analogs: number | null; sai: number | null }

export const SCENES: Scene[] = [
  { start: 0, end: 5, chapter: 'The Moon', caption: () => 'NASA has picked nine regions near the Moon’s south pole where the Artemis III astronauts could land.' },
  { start: 5, end: 10, chapter: 'Mars', caption: () => 'On Mars, the Perseverance rover is exploring Jezero Crater, which held a lake long ago.' },
  { start: 10, end: 15, chapter: 'Analogs', caption: (n) => `Before a mission, teams practise in places on Earth that are a bit like these worlds. ${n.analogs ?? 'Dozens of'} places are already used.` },
  { start: 15, end: 21, chapter: 'NASA data', caption: () => `SolMate reads ${facts.nasa_layers} NASA data layers and scores about 1.9 million squares of land on seven characteristics.` },
  { start: 21, end: 26, chapter: 'A new lead', caption: (n) => `A high, cold, dry corner of the Tibetan Plateau scores ${n.sai === null ? '…' : Math.round(n.sai)} out of 100 as a match for Jezero.` },
  { start: 26, end: 30, chapter: 'Your turn', caption: () => 'Your turn: work through the levels and find Earth’s best training grounds yourself.' },
]

/** Index of the scene playing at time t (the last scene holds at the end). */
export function sceneAt(t: number): number {
  const n = SCENES.findIndex((s) => t >= s.start && t < s.end)
  return n === -1 ? SCENES.length - 1 : n
}

/** A "tap to learn more" point on the picture for each scene (the last scene has buttons instead). */
export type Fact = { left: string; top: string; title: string; text: string }
export const FACTS: (Fact | null)[] = [
  {
    left: '60%',
    top: '80%',
    title: 'Why the south pole?',
    text: 'Some craters there are always in shadow. They are colder than −160 °C and may hold water ice, which astronauts could turn into drinking water, air and rocket fuel.',
  },
  {
    left: '55%',
    top: '45%',
    title: 'Why Jezero?',
    text: 'Billions of years ago a river flowed into Jezero and filled it with a lake. Perseverance is collecting rocks there that may hold signs of ancient life.',
  },
  {
    left: '20%',
    top: '34%',
    title: 'Who practises here?',
    text: 'NASA, ESA and other teams test rovers, spacesuits and tools at these places: deserts, volcanoes, glaciers and craters.',
  },
  {
    left: '50%',
    top: '58%',
    title: 'Where does the data come from?',
    text: 'NASA satellites such as Terra and Aqua circle the Earth about every 99 minutes, measuring heat, snow, dust and more.',
  },
  {
    left: '22%',
    top: '72%',
    title: 'Why Tibet?',
    text: 'The plateau is high, cold and dry, with bare rocky ground, so it shares several things with Jezero. It still has air and Earth’s gravity, which Mars does not.',
  },
  null,
]

// ---- Sound -------------------------------------------------------------------------------------
// The clip's music is generated in the browser (Web Audio), so there is no audio file and no licence
// to worry about. Times below follow the animation in Explainer.tsx so sounds land on what you see.

/** One chord per scene, as MIDI notes: a slow D-minor journey that resolves to D major at the end. */
export const CHORDS: number[][] = [
  [50, 57, 64, 65], // Moon: Dm(add9)
  [46, 53, 57, 62], // Mars: Bbmaj7
  [41, 48, 57, 64], // Analogs: Fmaj7
  [48, 55, 62, 64], // Data: C(add9)
  [43, 50, 58, 62], // A new lead: Gm
  [50, 57, 62, 66], // Your turn: D
]

export type Cue =
  | { t: number; kind: 'quindar'; hz: number } // the Apollo-era radio beep that opened and closed NASA transmissions
  | { t: number; kind: 'pluck'; midi: number }
  | { t: number; kind: 'blip'; midi: number }
  | { t: number; kind: 'sweep'; dur: number }
  | { t: number; kind: 'whoosh' }
  | { t: number; kind: 'rise'; dur: number }
  | { t: number; kind: 'chime' }

const PENTA = [62, 65, 67, 69, 72, 74, 77, 79, 81, 84] // D minor pentatonic

/** Every sound effect in the clip, in time order. */
export function soundCues(analogs: number): Cue[] {
  const cues: Cue[] = [{ t: 0.15, kind: 'quindar', hz: 2525 }]
  // scene 1: the nine region dots appear at p = 0.5 + 0.03 n
  for (let n = 0; n < 9; n++) cues.push({ t: 2.5 + 0.15 * n, kind: 'pluck', midi: PENTA[n % PENTA.length]! })
  // scene 2: the globe gives way to Jezero
  cues.push({ t: 7.2, kind: 'whoosh' })
  // scene 3: analog dots pop in at p = 0.1 + 0.6 n / count (every third one gets a note)
  const count = Math.max(1, analogs)
  for (let n = 0; n < count; n += 3) cues.push({ t: 10 + 5 * (0.1 + (0.6 * n) / count), kind: 'pluck', midi: PENTA[(n / 3) % PENTA.length]! })
  // scene 4: the scan sweeps across, and each characteristic lights when span(p, 0.1, 0.85) * 7 reaches it
  cues.push({ t: 15.3, kind: 'sweep', dur: 4.2 })
  for (let k = 1; k <= 7; k++) {
    const x = 1 - (1 - k / 7) ** (1 / 3)
    cues.push({ t: 15 + 6 * (0.1 + 0.75 * x), kind: 'blip', midi: PENTA[k + 1]! })
  }
  // scene 5: the score counts up (p 0.2 to 0.7), then lands
  cues.push({ t: 22, kind: 'rise', dur: 2.5 }, { t: 24.5, kind: 'chime' })
  // end: the closing beep
  cues.push({ t: 29.4, kind: 'quindar', hz: 2475 })
  return cues.sort((a, b) => a.t - b.t)
}
