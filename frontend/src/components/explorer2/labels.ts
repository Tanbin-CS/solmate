import type { Band } from '@/science/v2/aggregate'

export const DIM_ORDER = ['T', 'C', 'Th', 'S', 'M', 'I', 'D', 'O'] as const

export const BAND_STYLE: Record<Band, { label: string; className: string }> = {
  strong: { label: 'Strong', className: 'text-positive' },
  partial: { label: 'Partial', className: 'text-derived' },
  weak: { label: 'Weak', className: 'text-negative' },
  'n/a': { label: 'Not assessed', className: 'text-slate-400' },
}

export const PRESET_INFO: Record<string, { label: string; description: string }> = {
  equal: { label: 'Equal', description: 'Every dimension that applies to the target counts the same. The default and the screening ranking.' },
  expert: { label: 'Expert', description: 'Terrain counts 1.5x and dust half: the team’s prior before validation.' },
  mission_ops: { label: 'Ops', description: 'Adds mission operations (gentle slopes, low wind) at 2x for landing, roving and building.' },
  lunar_ops: {
    label: 'Lunar ops',
    description:
      'Moon only: terrain 2x and operations, with climate, temperature and ice as support. Tested after mentor review; it helps the rugged massifs and hurts the plateaus, so it is not the default (see Method).',
  },
  learned: {
    label: 'Learned',
    description: 'Weights fitted by cross-validated non-negative logistic regression on documented analogs vs controls (see Method).',
  },
}

/** Display names whose plain capitalisation reads wrong (mirrors SITE_NAMES in analysis pipeline/report.py). */
const SITE_NAMES: Readonly<Record<string, string>> = {
  'mdrs-utah': 'MDRS (Utah)',
  'atacama-yungay': 'Atacama (Yungay)',
  'haughton-devon-island': 'Haughton Crater (Devon Island)',
  'qaidam-dalangtan': 'Qaidam Basin (Dalangtan)',
  'qaidam-east': 'Qaidam Basin (east)',
  'licancabur-high-lakes': 'Licancabur (High Lakes)',
  'antarctica-dry-valleys': 'McMurdo Dry Valleys',
  'teide-tenerife': 'Teide (Tenerife)',
  'svalbard-bockfjorden': 'Bockfjorden (Svalbard)',
  'rio-tinto': 'Río Tinto',
  'sf-volcanic-field': 'San Francisco Volcanic Field',
  'mauna-kea-hi-seas': 'Mauna Kea (HI-SEAS)',
}

/** "lake-salda" -> "Lake Salda"; known exceptions from SITE_NAMES. */
export const siteName = (id: string): string =>
  SITE_NAMES[id] ?? id.split(/[-_]/).map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w)).join(' ')

/** Target groups for the picker: NASA's candidate landing regions near the lunar south pole, then Mars. */
export function groupTargets<T extends { body: 'moon' | 'mars' }>(targets: readonly T[]): { label: string; items: T[] }[] {
  return [
    { label: 'Moon · south-pole landing regions', items: targets.filter((t) => t.body === 'moon') },
    { label: 'Mars', items: targets.filter((t) => t.body === 'mars') },
  ]
}
