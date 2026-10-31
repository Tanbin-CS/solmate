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
  learned: {
    label: 'Learned',
    description: 'Weights fitted by cross-validated non-negative logistic regression on documented analogs vs controls (see Method).',
  },
}

/** "qaidam-dalangtan" -> "Qaidam Dalangtan" */
export const siteName = (id: string): string => id.split(/[-_]/).map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w)).join(' ')

/** Target groups for the picker: Artemis III candidate regions, then Mars. */
export function groupTargets<T extends { body: 'moon' | 'mars' }>(targets: readonly T[]): { label: string; items: T[] }[] {
  return [
    { label: 'Moon · Artemis III base regions', items: targets.filter((t) => t.body === 'moon') },
    { label: 'Mars', items: targets.filter((t) => t.body === 'mars') },
  ]
}
