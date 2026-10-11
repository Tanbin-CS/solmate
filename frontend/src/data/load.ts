import { asset } from '@/lib/asset'
import { IndicatorsDoc, ProvenanceDoc, ValidationDoc } from './schema'

export interface AnalysisData {
  indicators: IndicatorsDoc
  validation: ValidationDoc
  provenance: ProvenanceDoc
}

async function fetchJson(path: string): Promise<unknown> {
  const res = await fetch(asset(path))
  if (!res.ok) throw new Error(`Could not load ${path} (HTTP ${res.status})`)
  return res.json()
}

let cache: Promise<AnalysisData> | null = null

/** Loads and validates the pipeline artifacts once per session. */
export function loadAnalysisData(): Promise<AnalysisData> {
  cache ??= Promise.all([fetchJson('data/indicators.v1.json'), fetchJson('data/validation.v1.json'), fetchJson('data/provenance.v1.json')])
    .then(([i, v, p]) => ({ indicators: IndicatorsDoc.parse(i), validation: ValidationDoc.parse(v), provenance: ProvenanceDoc.parse(p) }))
    .catch((err) => {
      cache = null // allow retry
      throw err
    })
  return cache
}
