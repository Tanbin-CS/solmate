/** Pre-registered validation results (validate_v2.py -> data/v2/validation.json). */
import { z } from 'zod'

const Num = z.number().finite()
const SiteScore = z.object({ sai: Num.nullable(), land_percentile: Num.nullable().optional() })

export const TargetValidationSchema = z.object({
  body: z.enum(['moon', 'mars']),
  n_positives: z.number().int(),
  n_controls: z.number().int(),
  auc_equal: Num,
  auc_ci95: z.tuple([Num, Num]),
  positives_median_land_percentile: Num,
  positives: z.record(z.string(), SiteScore),
  controls: z.record(z.string(), SiteScore),
  ablation_delta_auc: z.record(z.string(), Num),
  learned: z.object({ weights: z.record(z.string(), Num), cv_auc_median: Num, cv_auc_p5_p95: z.tuple([Num, Num]) }),
  random_weights_auc_p5_p50_p95: z.tuple([Num, Num, Num]),
})

const RegionalMetrics = z.object({
  auc: Num,
  auc_ci95_sites: z.tuple([Num, Num]),
  auc_region_weighted: Num,
  auc_ci95_regions: z.tuple([Num, Num]),
})

/** Addendum 1 (docs/VALIDATION.md): sites grouped into 500 km regions, and the Lunar ops weights. */
export const RegionalSchema = z.object({
  region_km: Num,
  lunar_ops_weights: z.record(z.string(), Num),
  regions: z.record(z.string(), z.array(z.array(z.string()))),
  summary: z.object({
    moon: z.object({
      equal: z.object({ auc_median: Num, auc_region_weighted_median: Num }),
      lunar_ops: z.object({ auc_median: Num, auc_region_weighted_median: Num }),
      decision: z.string(),
    }),
  }),
  targets: z.record(
    z.string(),
    z.object({
      body: z.enum(['moon', 'mars']),
      n_positive_regions: z.number().int(),
      n_control_regions: z.number().int(),
      equal: RegionalMetrics,
      learned_loro_auc: Num,
      lunar_ops: RegionalMetrics.optional(),
    }),
  ),
})

export const ValidationSchema = z.object({
  summary: z.record(z.enum(['moon', 'mars']), z.object({ auc_median: Num, positives_median_land_percentile: Num })),
  targets: z.record(z.string(), TargetValidationSchema),
  addendum_1: RegionalSchema.optional(),
})

export type TargetValidation = z.infer<typeof TargetValidationSchema>
export type Validation = z.infer<typeof ValidationSchema>
export type Regional = z.infer<typeof RegionalSchema>
