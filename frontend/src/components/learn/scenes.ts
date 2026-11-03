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
