import { PageHeader } from '@/components/layout/PageHeader'

// Placeholder until the terrain pipeline and similarity engine land (milestones 2-4).
export default function ExplorerPage() {
  return (
    <PageHeader
      kicker="Explorer · in development"
      title="The analog explorer is being built."
      lead="The terrain pipeline and similarity engine are in progress. This preview will show real results only once they are computed from elevation data."
    />
  )
}
