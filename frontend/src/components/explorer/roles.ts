import type { Site } from '@/data/schema'

export const ROLE: Record<Site['role'], { label: string; short: string; color: string; description: string }> = {
  documented: {
    label: 'NASA-documented analog',
    short: 'Documented',
    color: 'var(--data)',
    description: 'Earth field site featured in NASA’s Planetary Analog Explorer.',
  },
  candidate: {
    label: 'Literature candidate',
    short: 'Candidate',
    color: 'var(--derived)',
    description: 'Well-known analog site from the scientific literature, ranked but not used to score validation.',
  },
  control: {
    label: 'Negative control',
    short: 'Control',
    color: 'var(--slate-400)',
    description: 'Terrain with no planetary-analog use. The method should rank these low.',
  },
}

export const REFERENCE_COLOR = 'var(--reference)'
