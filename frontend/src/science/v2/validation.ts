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

export const ValidationSchema = z.object({
  summary: z.record(z.enum(['moon', 'mars']), z.object({ auc_median: Num, positives_median_land_percentile: Num })),
  targets: z.record(z.string(), TargetValidationSchema),
})

export type TargetValidation = z.infer<typeof TargetValidationSchema>
export type Validation = z.infer<typeof ValidationSchema>
