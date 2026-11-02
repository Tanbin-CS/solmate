/** Provenance for the Data page (pipeline/provenance.py -> data/v2/provenance.json). */
import { z } from 'zod'

const Num = z.number().finite()

export const ProvenanceSchema = z.object({
  version: z.literal(2),
  generated_at: z.string().nullable().optional(),
  grid: z.object({ res_deg: Num, rows: z.number().int(), cols: z.number().int(), origin: z.string() }).partial().nullable().optional(),
  datasets: z.array(z.object({ section: z.string(), name: z.string(), agency: z.string(), detail: z.string(), use: z.string(), terms: z.string() })),
  layers: z.array(
    z.object({ id: z.string(), name: z.string().optional(), units: z.string().nullable(), source: z.string().nullable(), land_coverage: Num.nullable(), p1: Num.nullable(), p50: Num.nullable(), p99: Num.nullable() }),
  ),
  raw: z.object({
    files: z.number().int(),
    bytes: Num,
    products: z.array(
      z.object({ product: z.string(), files: z.number().int(), bytes: Num, first: z.string().nullable(), last: z.string().nullable(), host: z.string().nullable() }),
    ),
  }),
  validation_sites: z.object({
    positives: z.record(z.string(), z.array(z.object({ id: z.string(), lat: Num, lon: Num, source: z.string().optional() }))),
    controls: z.array(z.object({ id: z.string(), lat: Num, lon: Num, biome: z.string().optional() })),
  }),
})

export type Provenance = z.infer<typeof ProvenanceSchema>

/** Only http(s) links from data files are rendered as links. */
export const safeUrl = (u: unknown): string | null => (typeof u === 'string' && /^https?:\/\//.test(u) ? u : null)
