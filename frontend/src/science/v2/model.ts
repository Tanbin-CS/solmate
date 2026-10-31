/**
 * Schemas for the v2 model files written by analysis/src/solmate/pipeline/export_web.py
 * (frontend/public/data/v2). Parsed with zod so a bad or stale file fails loudly instead
 * of producing wrong scores.
 */
import { z } from 'zod'

const Num = z.number().finite()

export const EarthStatsSchema = z.object({
  quantiles: z.array(Num).length(101),
  median: Num,
  sigma: Num,
})

const IndicatorSpec = z.object({
  weight: Num.optional(),
  direction: z.literal('lower_is_better').optional(),
})

export const DimensionSchema = z.object({
  name: z.string(),
  description: z.string(),
  applies_to: z.array(z.enum(['moon', 'mars'])),
  indicators: z.record(z.string(), IndicatorSpec),
})

const Rule = z.record(z.string(), z.partialRecord(z.enum(['gte', 'lt', 'gte_earth_quantile']), Num))

export const ProcessConfigSchema = z.object({
  tags: z.record(
    z.string(),
    z.object({ name: z.string(), when: Rule, analog: z.string(), bodies: z.array(z.enum(['moon', 'mars'])) }),
  ),
  uses: z.array(z.object({ id: z.string(), text: z.string(), when: Rule })),
})

export const TileLayoutSchema = z.object({
  cells_per_side: z.literal(100),
  res_deg: z.literal(0.1),
  layers: z.array(z.string()).min(1),
  ranges: z.record(z.string(), z.tuple([Num, Num])),
  transforms: z.record(z.string(), z.object({ kind: z.literal('log'), offset: Num })),
  available: z.array(z.string().regex(/^\d{2}_\d{2}$/)),
})

export const ModelSchema = z.object({
  version: z.literal(2),
  model_version: z.string().regex(/^[0-9a-f]{12}$/),
  dimensions: z.record(z.string(), DimensionSchema),
  presets: z.record(z.string(), z.record(z.string(), Num)),
  earth_stats: z.record(z.string(), EarthStatsSchema),
  processes: ProcessConfigSchema,
  tiles: TileLayoutSchema,
  known_analogs: z.object({
    novelty_km: Num,
    sites: z.array(z.object({ id: z.string(), lat: Num, lon: Num, source: z.string().optional() }).passthrough()),
  }),
})

const Value = z.object({ value: z.union([Num, z.null()]).optional() }).passthrough()

export const TargetSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_]+$/),
    name: z.string(),
    body: z.enum(['moon', 'mars']),
    indicators: z.record(z.string(), z.unknown()),
    breaks_down: z.record(z.string(), Value).optional(),
  })
  .passthrough()

export const TargetsSchema = z.object({ targets: z.array(TargetSchema).min(1) })

export type Model = z.infer<typeof ModelSchema>
export type Dimension = z.infer<typeof DimensionSchema>
export type ProcessConfig = z.infer<typeof ProcessConfigSchema>
export type TileLayout = z.infer<typeof TileLayoutSchema>
export type Target = z.infer<typeof TargetSchema>
export type Body = Target['body']

/** Indicator values for one place; null or NaN = no data. */
export type PlaceValues = Readonly<Record<string, number | null | undefined>>
